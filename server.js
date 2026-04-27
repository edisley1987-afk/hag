import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import http from "http";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Configuração exata dos seus sensores
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.005250, leituraCheio: 0.008742, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006734, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.005330, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004048, leituraCheio: 0.004849, capacidade: 9000 },
  "Reservatorio_lavanderia_current": { leituraVazio: 0.006012, leituraCheio: 0.011623, capacidade: 10000 }
};

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

app.use(cors());
app.use(express.json());

// Rota que processa o formato [ {ref: '...', value: ...}, ... ]
app.post(["/atualizar", "/iot"], (req, res) => {
  console.log(chalk.green("🔥 DADOS RECEBIDOS:"), req.body);
  
  const payload = Array.isArray(req.body) ? req.body : [];
  const dadosAtuais = {};
  const timestamp = new Date().toISOString();

  payload.forEach(item => {
    const ref = item.ref;
    const valorRaw = Number(item.value);
    const sensor = SENSORES[ref];

    if (sensor) {
      const span = sensor.leituraCheio - sensor.leituraVazio;
      let percentual = (valorRaw - sensor.leituraVazio) / span;
      percentual = Math.max(0, Math.min(1, percentual));
      dadosAtuais[ref] = Math.round(percentual * sensor.capacidade);
      dadosAtuais[`${ref}_percent`] = Math.round(percentual * 100);
    } else {
      dadosAtuais[ref] = valorRaw;
    }
  });

  const finalData = { ...dadosAtuais, timestamp };
  fs.writeFileSync(DATA_FILE, JSON.stringify(finalData));
  
  // Avisa o Dashboard em tempo real
  const msg = JSON.stringify({ type: "update", dados: finalData });
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });

  res.status(200).send("OK");
});

app.get("/api/dashboard", (req, res) => {
  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8") || "{}");
  res.json({
    lastUpdate: dados.timestamp || "-",
    reservatorios: Object.keys(SENSORES).map(k => ({
      nome: k.split("_")[1], // Pega apenas 'Elevador', 'Osmose', etc.
      current_liters: dados[k] || 0,
      percent: dados[`${k}_percent`] || 0,
      capacidade: SENSORES[k].capacidade
    })),
    bombas: [
        { nome: "Bomba 01", estado: dados["Bomba_01_binary"] === 1 ? "ligada" : "desligada" },
        { nome: "Bomba 02", estado: dados["Bomba_02_binary"] === 1 ? "ligada" : "desligada" },
        { nome: "Bomba Osmose", estado: dados["Bomba_Osmose_binary"] === 1 ? "ligada" : "desligada" }
    ]
  });
});

app.use(express.static(path.join(__dirname, "public")));
server.listen(process.env.PORT || 3000, () => console.log("🚀 HAG ONLINE"));
