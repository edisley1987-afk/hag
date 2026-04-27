/**
 * =========================================================
 * Sistema de Monitoramento de Reservatórios – HAG
 * =========================================================
 * Projeto: Hospital Arnaldo Gavazza
 * Versão: 1.1.0 (Correção de Compatibilidade Gateway)
 * =========================================================
 */

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import compression from "compression";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import chalk from "chalk";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

// ------------------------- CONFIGURAÇÕES -------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.005250, leituraCheio: 0.008742, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006734, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.005330, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004048, leituraCheio: 0.004849, capacidade: 9000 },
  "Reservatorio_lavanderia_current": { leituraVazio: 0.006012, leituraCheio: 0.011623, capacidade: 10000 },
  "Bomba_01_binary": { tipo: "bomba" },
  "Bomba_02_binary": { tipo: "bomba" },
  "Bomba_Osmose_binary": { tipo: "bomba" }
};

// ------------------------- WEBSOCKET -------------------------
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function wsBroadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ------------------------- AJUDANTES IO -------------------------
function safeReadJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
  } catch { return fallback; }
}

function safeWriteJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) { console.error("Erro escrita:", e); }
}

// ------------------------- PROCESSAMENTO -------------------------
function processarDados(payload) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = { ...ultimo, timestamp: new Date().toISOString() };

  // O seu gateway envia chaves diretas no JSON
  Object.keys(payload).forEach(key => {
    const sensor = SENSORES[key];
    let valor = Number(payload[key]);

    if (sensor && sensor.capacidade) {
      const span = sensor.leituraCheio - sensor.leituraVazio;
      let percentual = span > 0 ? (valor - sensor.leituraVazio) / span : 0;
      percentual = Math.max(0, Math.min(1, percentual));
      novo[key] = Math.round(percentual * sensor.capacidade);
    } else {
      novo[key] = valor;
    }
    novo[`${key}_timestamp`] = novo.timestamp;
  });

  safeWriteJson(DATA_FILE, novo);
  return novo;
}

// ------------------------- ROTAS -------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROTA PRINCIPAL PARA O SEU GATEWAY
app.post(["/iot", "/atualizar"], (req, res) => {
  console.log(chalk.green("📥 DADOS RECEBIDOS DO GATEWAY:"), req.body);
  
  const dadosAtualizados = processarDados(req.body);
  wsBroadcast({ type: "update", dados: dadosAtualizados });
  
  res.status(200).json({ ok: true });
});

app.get("/api/dashboard", (req, res) => {
  const dados = safeReadJson(DATA_FILE, {});
  // Estrutura simplificada para o dashboard.js ler
  const resposta = {
    lastUpdate: dados.timestamp || "-",
    reservatorios: Object.keys(SENSORES).filter(k => SENSORES[k].capacidade).map(k => ({
      nome: k.replace("_current", "").replace("Reservatorio_", ""),
      current_liters: dados[k] || 0,
      percent: Math.round(((dados[k] || 0) / SENSORES[k].capacidade) * 100),
      capacidade: SENSORES[k].capacidade
    })),
    bombas: Object.keys(SENSORES).filter(k => SENSORES[k].tipo === "bomba").map(k => ({
      nome: k.replace("_binary", ""),
      estado: dados[k] === 1 ? "ligada" : "desligada"
    }))
  };
  res.json(resposta);
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(chalk.blue(`🚀 HAG Server Online na porta ${PORT}`)));
