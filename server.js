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

// Configuração exata baseada nos sensores da Khomp (Imagem 3)
const SENSORES = {
  "Reservatorio_Elevador": { vazio: 0.005250, cheio: 0.008742, cap: 20000 },
  "Reservatorio_Osmose": { vazio: 0.00505, cheio: 0.006734, cap: 200 },
  "Reservatorio_CME": { vazio: 0.004088, cheio: 0.005330, cap: 1000 },
  "Reservatorio_Agua_Abrandada": { vazio: 0.004048, cheio: 0.004849, cap: 9000 },
  "Reservatorio_lavanderia": { vazio: 0.006012, cheio: 0.011623, cap: 10000 }
};

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

app.use(cors());
app.use(express.json());

app.post(["/atualizar", "/iot"], (req, res) => {
  console.log(chalk.green("🔥 DADOS RECEBIDOS:"), JSON.stringify(req.body));
  
  const payload = Array.isArray(req.body) ? req.body : [];
  const dadosNovos = { timestamp: new Date().toISOString() };

  payload.forEach(item => {
    // Tratamento para remover o sufixo '_current' se existir e converter vírgula em ponto
    const ref = item.ref.replace("_current", "");
    let valorStr = String(item.value).replace(",", ".");
    const valorRaw = parseFloat(valorStr);
    const sensor = SENSORES[ref];

    if (sensor && !isNaN(valorRaw)) {
      const span = sensor.cheio - sensor.vazio;
      let percent = (valorRaw - sensor.vazio) / span;
      percent = Math.max(0, Math.min(1, percent));
      
      dadosNovos[ref] = Math.round(percent * sensor.cap);
      dadosNovos[`${ref}_percent`] = Math.round(percent * 100);
    } else {
      dadosNovos[ref] = item.value;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(dadosNovos));
  
  const msg = JSON.stringify({ type: "update", dados: dadosNovos });
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });

  res.status(200).send("OK");
});

app.get("/api/dashboard", (req, res) => {
  const dados = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : {};
  
  res.json({
    lastUpdate: dados.timestamp || "-",
    reservatorios: Object.keys(SENSORES).map(k => ({
      nome: k.replace("Reservatorio_", "").replace("_", " "),
      current_liters: dados[k] || 0,
      percent: dados[`${k}_percent`] || 0,
      capacidade: SENSORES[k].cap
    })),
    bombas: [
      { nome: "Bomba 01", estado: Number(dados["Bomba_01"]) === 1 ? "ligada" : "desligada" },
      { nome: "Bomba 02", estado: Number(dados["Bomba_02"]) === 1 ? "ligada" : "desligada" },
      { nome: "Bomba Osmose", estado: Number(dados["Bomba_Osmose"]) === 1 ? "ligada" : "desligada" }
    ]
  });
});

app.get("/dados", (req, res) => {
  res.json(fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : {});
});

app.use(express.static(path.join(__dirname, "public")));
server.listen(process.env.PORT || 3000, () => console.log("🚀 HAG ONLINE"));
