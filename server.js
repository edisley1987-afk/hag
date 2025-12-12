// server.js - Servidor HAG otimizado (ESModules) + WebSocket (tempo real)
// Requer: express, cors, compression, ws, chalk
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import compression from "compression";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------------------- ARQUIVOS E CONSTANTES -------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANUT_FILE)) fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

// ------------------------- MIDDLEWARES -------------------------
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: ["text/*", "application/*"], limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Log de requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(chalk.gray(`[${new Date().toISOString()}] [${req.method}] ${req.originalUrl} → ${Date.now() - start}ms`));
  });
  next();
});

// ------------------------- SENSORES / CALIBRAÇÃO -------------------------
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008742, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006492, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004048, leituraCheio: 0.004849, capacidade: 9000 },
  "Reservatorio_lavanderia_current": { leituraVazio: 0.006012, leituraCheio: 0.010607, capacidade: 10000 },

  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },

  "Bomba_01_binary": { tipo: "bomba" },
  "Ciclos_Bomba_01_counter": { tipo: "ciclo" },

  "Bomba_02_binary": { tipo: "bomba" },
  "Ciclos_Bomba_02_counter": { tipo: "ciclo" },

  // ⭐ NOVO — bomba da osmose
  "Bomba_Osmose_binary": { tipo: "bomba" },
  "Ciclos_Bomba_Osmose_counter": { tipo: "ciclo" }
};

// ------------------------- HELPERS IO -------------------------
function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8") || "{}");
  } catch { return fallback; }
}

function safeWriteJson(filePath, data) {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
  catch (e) { console.error("safeWriteJson error", filePath, e); }
}

function getManutencao() {
  try { return JSON.parse(fs.readFileSync(MANUT_FILE, "utf8")); }
  catch { return { ativo: false }; }
}

function setManutencao(ativo) {
  safeWriteJson(MANUT_FILE, { ativo });
}

function parseBodyGuess(body) {
  if (!body) return null;
  if (typeof body === "object") return body;
  if (typeof body === "string") {
    const s = body.trim();
    try { return JSON.parse(s); } catch {}
    if (s.includes("=") && s.includes("&")) {
      const obj = {};
      s.split("&").forEach(p => {
        const [k, v] = p.split("=");
        obj[decodeURIComponent(k)] = decodeURIComponent(v);
      });
      return obj;
    }
    return null;
  }
  return null;
}

function normalizePacket(raw) {
  let arr = [];
  if (!raw) return arr;

  if (Array.isArray(raw)) {
    arr = raw.map(i => ({
      ref: i.ref ?? i.name ?? i.key,
      value: i.value ?? i.v ?? i.val ?? i,
      dev_id: i.dev_id,
      time: i.time
    }));
  } else if (raw.data && Array.isArray(raw.data)) {
    arr = raw.data.map(i => ({
      ref: i.ref ?? i.name ?? i.key,
      value: i.value ?? i.v ?? i.val ?? i,
      dev_id: i.dev_id,
      time: i.time
    }));
  } else if (typeof raw === "object") {
    arr = Object.keys(raw).map(k => ({ ref: k, value: raw[k] }));
  }

  return arr.filter(x => x.ref);
}

function convertAndMerge(arr) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = { ...ultimo };
  const timestampNow = new Date().toISOString();

  for (const item of arr) {
    const ref = item.ref;
    let val = item.value;
    if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) val = Number(val);
    const sensor = SENSORES[ref];

    if (!sensor) {
      novo[ref] = val;
      novo[`${ref}_timestamp`] = item.time || timestampNow;
      continue;
    }

    if (sensor.tipo === "pressao") {
      let v = Number(val) || 0;
      v = ((v - 0.004) / 0.016) * 20;
      novo[ref] = Number(Math.max(0, Math.min(20, v)).toFixed(2));
    }

    else if (sensor.tipo === "bomba") {
      novo[ref] = Number(val) === 1 ? 1 : 0;
    }

    else if (sensor.tipo === "ciclo") {
      novo[ref] = Math.max(0, Math.round(Number(val) || 0));
    }

    else if (sensor.capacidade) {
      const leitura = Number(val) || 0;
      const p = (leitura - sensor.leituraVazio) /
                (sensor.leituraCheio - sensor.leituraVazio);
      let litros = p * sensor.capacidade;
      novo[ref] = Math.max(0, Math.min(sensor.capacidade, Math.round(litros)));
    }

    novo[`${ref}_timestamp`] = item.time || timestampNow;
  }

  novo.timestamp = `${new Date().toISOString()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return novo;
}

// ------------------------- HISTÓRICO -------------------------
function registrarHistorico(dados) {
  const hoje = new Date().toISOString().split("T")[0];
  const hist = safeReadJson(HIST_FILE, {});
  if (!hist[hoje]) hist[hoje] = {};

  for (const [ref, valor] of Object.entries(dados)) {
    if (!SENSORES[ref] || !SENSORES[ref].capacidade) continue;
    if (ref.endsWith("_timestamp")) continue;

    if (!hist[hoje][ref]) hist[hoje][ref] = { min: valor, max: valor, pontos: [] };
    const reg = hist[hoje][ref];

    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    const variacao = Math.max(1, SENSORES[ref].capacidade * 0.02);
    const ultimo = reg.pontos.at(-1);

    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
      reg.pontos.push({
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor
      });
    }
  }

  safeWriteJson(HIST_FILE, hist);
}

// ------------------------- WEBSOCKET -------------------------
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(chalk.green(`Servidor HAG otimizado ativo na porta ${process.env.PORT || 3000}`));
});

const wss = new WebSocketServer({ server });

function wsBroadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => c.readyState === c.OPEN && c.send(msg));
}

wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "init", dados: safeReadJson(DATA_FILE, {}) }));
});

// ------------------------- ROTA PRINCIPAL (Gateway) -------------------------
app.all(["/atualizar", "/iot"], (req, res) => {
  try {
    const parsed = parseBodyGuess(req.body);
    if (!parsed) return res.status(400).json({ erro: "Payload inválido" });

    const arr = normalizePacket(parsed);
    if (!arr.length) return res.status(400).json({ erro: "Nenhum dado encontrado" });

    const novo = convertAndMerge(arr);
    safeWriteJson(DATA_FILE, novo);

    try { registrarHistorico(novo); } catch {}

    wsBroadcast({ type: "update", dados: novo });

    res.json({ status: "ok", dados: novo, recebido: arr.length });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ------------------------- ROTA /api/dashboard -------------------------
app.get("/api/dashboard", (req, res) => {
  const dados = safeReadJson(DATA_FILE, {});
  const manut = getManutencao().ativo;

  const reservatorios = [
    { nome: "Reservatório Elevador", setor: "elevador", percent: Math.round((dados["Reservatorio_Elevador_current"] || 0) / 20000 * 100), current_liters: dados["Reservatorio_Elevador_current"] || 0, capacidade: 20000, manutencao: manut },
    { nome: "Reservatório Osmose", setor: "osmose", percent: Math.round((dados["Reservatorio_Osmose_current"] || 0) / 200 * 100), current_liters: dados["Reservatorio_Osmose_current"] || 0, capacidade: 200, manutencao: manut },
    { nome: "Reservatório CME", setor: "cme", percent: Math.round((dados["Reservatorio_CME_current"] || 0) / 1000 * 100), current_liters: dados["Reservatorio_CME_current"] || 0, capacidade: 1000, manutencao: manut },
    { nome: "Água Abrandada", setor: "abrandada", percent: Math.round((dados["Reservatorio_Agua_Abrandada_current"] || 0) / 9000 * 100), current_liters: dados["Reservatorio_Agua_Abrandada_current"] || 0, capacidade: 9000, manutencao: manut },
    { nome: "Lavanderia", setor: "lavanderia", percent: Math.round((dados["Reservatorio_lavanderia_current"] || 0) / 10000 * 100), current_liters: dados["Reservatorio_lavanderia_current"] || 0, capacidade: 10000, manutencao: manut }
  ];

  const pressoes = [
    { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: dados["Pressao_Saida_Osmose_current"] ?? null, manutencao: manut },
    { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: dados["Pressao_Retorno_Osmose_current"] ?? null, manutencao: manut },
    { nome: "Pressão Saída CME", setor: "saida_cme", pressao: dados["Pressao_Saida_CME_current"] ?? null, manutencao: manut }
  ];

  const bombas = [
    { nome: "Bomba 01", estado_num: Number(dados["Bomba_01_binary"]) || 0, estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0 },
    { nome: "Bomba 02", estado_num: Number(dados["Bomba_02_binary"]) || 0, estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0 },

    // ⭐ NOVA — BOMBA OSMOSE
    { nome: "Bomba Osmose", estado_num: Number(dados["Bomba_Osmose_binary"]) || 0, estado: Number(dados["Bomba_Osmose_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_Osmose_counter"]) || 0 }
  ];

  res.json({
    lastUpdate: dados.timestamp,
    reservatorios,
    pressoes,
    bombas,
    manutencao: manut
  });
});

// ------------------------- ROTA HISTÓRICO -------------------------
app.get("/historico", (req, res) => {
  res.json(safeReadJson(HIST_FILE, {}));
});

// ------------------------- MANUTENÇÃO -------------------------
app.get("/manutencao", (_, res) => res.json(getManutencao()));
app.post("/manutencao", (req, res) => {
  setManutencao(req.body.ativo === true);
  res.json({ status: "ok" });
});

// ------------------------- ESTÁTICOS -------------------------
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/login", (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// ------------------------- KEEP ALIVE -------------------------
setInterval(() => {
  if (typeof fetch === "function") {
    const host = process.env.RENDER_INTERNAL_HOSTNAME || "localhost";
    const port = process.env.PORT || 3000;
    fetch(`http://${host}:${port}/api/ping`).catch(() => {});
  }
}, 60000);
