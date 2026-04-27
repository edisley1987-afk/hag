import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

const DATA_FILE = path.join(__dirname, "data", "readings.json");
if (!fs.existsSync(path.join(__dirname, "data"))) fs.mkdirSync(path.join(__dirname, "data"));

// Tabela de Calibração HAG
const SENSORES = {
  "Reservatorio_Elevador": { vazio: 0.00525, cheio: 0.00874, cap: 20000 },
  "Reservatorio_Osmose": { vazio: 0.00505, cheio: 0.00673, cap: 200 },
  "Reservatorio_CME": { vazio: 0.00408, cheio: 0.00533, cap: 1000 },
  "Reservatorio_Agua_Abrandada": { vazio: 0.00404, cheio: 0.00484, cap: 9000 },
  "Reservatorio_lavanderia": { vazio: 0.00601, cheio: 0.01162, cap: 10000 }
};

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

app.use(cors());
app.use(express.json());

// Processa o Array que você enviou
app.post(["/atualizar", "/iot"], (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [];
  const dadosNovos = { timestamp: new Date().toISOString() };

  payload.forEach(item => {
    // Remove os sufixos para bater com a tabela SENSORES
    const refLimpa = item.ref.replace("_current", "").replace("_binary", "").replace("_counter", "");
    const valorRaw = parseFloat(String(item.value).replace(",", "."));
    
    const conf = SENSORES[refLimpa];
    if (conf && !isNaN(valorRaw)) {
      const span = conf.cheio - conf.vazio;
      let pct = (valorRaw - conf.vazio) / span;
      pct = Math.max(0, Math.min(1, pct)); // Garante que fique entre 0 e 100%
      
      dadosNovos[refLimpa] = Math.round(pct * conf.cap);
      dadosNovos[`${refLimpa}_percent`] = Math.round(pct * 100);
    } else {
      // Para bombas, pressões e contadores, salva o valor direto
      dadosNovos[refLimpa] = valorRaw;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(dadosNovos));
  
  // Atualiza o Dashboard via WebSocket
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
      { nome: "Bomba 01", estado: dados["Bomba_01"] === 1 ? "LIGADA" : "DESLIGADA", ciclos: dados["Ciclos_Bomba_01"] || 0 },
      { nome: "Bomba 02", estado: dados["Bomba_02"] === 1 ? "LIGADA" : "DESLIGADA", ciclos: dados["Ciclos_Bomba_02"] || 0 },
      { nome: "Bomba Osmose", estado: dados["Bomba_Osmose"] === 1 ? "LIGADA" : "DESLIGADA", ciclos: dados["Ciclos_Bomba_Osmose"] || 0 }
    ],
    pressoes: [
      { nome: "Saída Osmose", valor: dados["Pressao_Saida_Osmose"] || 0 },
      { nome: "Retorno Osmose", valor: dados["Pressao_Retorno_Osmose"] || 0 },
      { nome: "Saída CME", valor: dados["Pressao_Saida_CME"] || 0 }
    ]
  });
});

app.use(express.static(path.join(__dirname, "public")));
server.listen(process.env.PORT || 3000, () => console.log("🚀 HAG ONLINE"));
