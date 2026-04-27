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

// Configuração dos seus sensores (calibração conforme seus logs)
const SENSORES = {
  "Reservatorio_Elevador_current": { vazio: 0.005250, cheio: 0.008742, cap: 20000 },
  "Reservatorio_Osmose_current": { vazio: 0.00505, cheio: 0.006734, cap: 200 },
  "Reservatorio_CME_current": { vazio: 0.004088, cheio: 0.005330, cap: 1000 },
  "Reservatorio_Agua_Abrandada_current": { vazio: 0.004048, cheio: 0.004849, cap: 9000 },
  "Reservatorio_lavanderia_current": { vazio: 0.006012, cheio: 0.011623, cap: 10000 }
};

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

app.use(cors());
app.use(express.json());

// Rota que recebe os dados do Gateway (Formato Array detectado no Log)
app.post(["/atualizar", "/iot"], (req, res) => {
  console.log(chalk.green("🔥 DADOS RECEBIDOS:"), req.body);
  
  const payload = Array.isArray(req.body) ? req.body : [];
  const leituraAnterior = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : {};
  const dadosNovos = { ...leituraAnterior, timestamp: new Date().toISOString() };

  payload.forEach(item => {
    const sensor = SENSORES[item.ref];
    const valorRaw = Number(item.value);

    if (sensor) {
      const span = sensor.cheio - sensor.vazio;
      let percent = (valorRaw - sensor.vazio) / span;
      percent = Math.max(0, Math.min(1, percent));
      dadosNovos[item.ref] = Math.round(percent * sensor.cap);
      dadosNovos[`${item.ref}_percent`] = Math.round(percent * 100);
    } else {
      dadosNovos[item.ref] = valorRaw;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(dadosNovos));
  
  // Envia para o dashboard via WebSocket
  const msg = JSON.stringify({ type: "update", dados: dadosNovos });
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });

  res.status(200).send("OK");
});

// Rota para o dashboard ler os dados iniciais
app.get("/api/dashboard", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({ lastUpdate: "-", reservatorios: [] });
  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  
  const resposta = {
    lastUpdate: dados.timestamp || "-",
    reservatorios: Object.keys(SENSORES).map(k => ({
      nome: k.replace("Reservatorio_", "").replace("_current", "").replace("_", " "),
      current_liters: dados[k] || 0,
      percent: dados[`${k}_percent`] || 0,
      capacidade: SENSORES[k].cap
    })),
    bombas: [
      { nome: "Bomba 01", estado: dados["Bomba_01_binary"] === 1 ? "ligada" : "desligada" },
      { nome: "Bomba 02", estado: dados["Bomba_02_binary"] === 1 ? "ligada" : "desligada" },
      { nome: "Bomba Osmose", estado: dados["Bomba_Osmose_binary"] === 1 ? "ligada" : "desligada" }
    ]
  };
  res.json(resposta);
});

// Adicionada a rota /dados para evitar o erro da sua Imagem 3
app.get("/dados", (req, res) => {
  const dados = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : {};
  res.json(dados);
});

app.use(express.static(path.join(__dirname, "public")));
server.listen(process.env.PORT || 3000, () => console.log("🚀 HAG ONLINE"));
