// @author: Edisley Afonso Costa
// @version: 1.0.3
// @last_update: 2026-05-06
// @environment: Production (Render)

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import compression from "compression";
import http from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ------------------------- MIDDLEWARES GLOBAIS - TEM QUE VIR ANTES -------------------------
app.use(cors());
app.use(compression());
// IMPORTANTE: strict: false salva o body bruto em req._rawBody
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ------------------------- GATEWAY TRACE - DEBUG -------------------------
// TEM QUE VIR DEPOIS do express.json pra não quebrar o parsing
app.use("/atualizar/api/v1_2/json/itg/data", (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const auth = req.headers['authorization'] || 'none';

  console.log(`[GATEWAY TRACE] =================================`);
  console.log(`[GATEWAY TRACE] IP: ${ip}`);
  console.log(`[GATEWAY TRACE] User-Agent: ${userAgent}`);
  console.log(`[GATEWAY TRACE] Authorization: ${auth}`);
  console.log(`[GATEWAY TRACE] Content-Type: ${req.headers['content-type']}`);
  console.log(`[GATEWAY TRACE] Raw Body: ${req._rawBody || 'vazio'}`);
  console.log(`[GATEWAY TRACE] Parsed Body: ${JSON.stringify(req.body)}`);
  console.log(`[GATEWAY TRACE] Timestamp: ${new Date().toISOString()}`);

  next();
});

// ------------------------- RAW TRACE GERAL -------------------------
app.use((req, res, next) => {
  if (req.originalUrl.includes('/atualizar')) {
    console.log(`[RAW] ${req.method} ${req.originalUrl} - IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
  }
  next();
});

// ------------------------- BASIC AUTH - SÓ PARA DASHBOARD -------------------------
app.use(["/api/dashboard", "/historico", "/dados", "/consumo", "/manutencao", "/dashboard", "/historico-view", "/login"], (req, res, next) => {
  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from('118582:118582').toString('base64');
  if (!auth || auth!== expected) {
    res.setHeader('WWW-Authenticate', 'Basic realm="HAG"');
    return res.status(401).send('Unauthorized');
  }
  next();
});

// ================= WEBSOCKET =================
const wss = new WebSocketServer({ server });
const clients = new Set();
const lastPerType = {};

wss.on("connection", (ws) => {
  console.log("🔌 Cliente WebSocket conectado");
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

function wsBroadcast(data) {
  const key = data.type || "default";
  const now = Date.now();
  if (now - (lastPerType[key] || 0) < 300) return;
  lastPerType[key] = now;
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// ------------------------- ARQUIVOS E CONSTANTES -------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");
const CONSUMO_FILE = path.join(DATA_DIR, "consumo_osmose.json");
const ALERTA_FILE = path.join(DATA_DIR, "alerta_consumo.json");

const DATA_TIMEOUT_MS = 2 * 60 * 1000;
const ALERTA_FATOR = 2.5;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANUT_FILE)) fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

// ================= SENSORES / CALIBRAÇÃO =================
const SENSORES = safeReadJson(
  path.join(DATA_DIR, "sensores.json"),
  {
    "Reservatorio_Elevador_current": { leituraVazio: 0.005170, leituraCheio: 0.010247, capacidade: 20000, altura: 1.45 },
    "Reservatorio_Osmose_current": { leituraVazio: 0.005050, leituraCheio: 0.006973, capacidade: 200, altura: 1.0 },
    "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.005370, capacidade: 1000, altura: 0.45 },
    "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004048, leituraCheio: 0.004970, capacidade: 9000, altura: 0.6 },
    "Reservatorio_lavanderia_current": { leituraVazio: 0.006012, leituraCheio: 0.011623, capacidade: 10000, altura: 1.45 },
    "Pressao_Saida_Osmose_current": { tipo: "pressao" },
    "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
    "Pressao_Saida_CME_current": { tipo: "pressao" },
    "Bomba_01_binary": { tipo: "bomba" },
    "Ciclos_Bomba_01_counter": { tipo: "ciclo" },
    "Bomba_02_binary": { tipo: "bomba" },
    "Ciclos_Bomba_02_counter": { tipo: "ciclo" },
    "Bomba_Osmose_binary": { tipo: "bomba" },
    "Ciclos_Bomba_Osmose_counter": { tipo: "ciclo" }
  }
);

const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

// ------------------------- HELPERS IO -------------------------
function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const s = fs.readFileSync(filePath, "utf8");
    return JSON.parse(s || "{}");
  } catch (e) {
    console.error("safeReadJson error", filePath, e);
    return fallback;
  }
}
function safeWriteJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("safeWriteJson error", filePath, e);
  }
}

function getManutencao() {
  try { return JSON.parse(fs.readFileSync(MANUT_FILE, "utf8")); } catch { return { ativo: false }; }
}
function setManutencao(ativo) { fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo }, null, 2)); }

// ================= CALIBRAÇÃO ESTÁVEL =================
const MEMORIA_NIVEL = {};

function calcularNivel(ref, leitura) {
  const sensor = SENSORES[ref];
  if (!sensor ||!sensor.capacidade) return { percentual: 0, litros: 0, altura: 0 };
  const span = (sensor.leituraCheio - sensor.leituraVazio) || 1;
  let p = Math.max(0, Math.min(1, (leitura - sensor.leituraVazio) / span));
  if (!isFinite(p)) p = 0;

  const key = ref;
  if (MEMORIA_NIVEL[key] === undefined) MEMORIA_NIVEL[key] = p;
  const anterior = MEMORIA_NIVEL[key];
  let filtrado = (anterior * 0.85) + (p * 0.15);
  if (Math.abs(filtrado - anterior) < 0.01) filtrado = anterior;
  filtrado = Math.max(0, Math.min(1, filtrado));
  MEMORIA_NIVEL[key] = filtrado;

  return {
    percentual: filtrado,
    litros: Math.round(filtrado * sensor.capacidade),
    altura: Math.round(filtrado * sensor.altura * 100)
  };
}

function parseTimestamp(ts, fallback) {
  if (!ts) return fallback;
  const date = new Date(ts);
  return isNaN(date.getTime())? fallback : date.toISOString();
}

function extractAnyPayload(req) {
  return req.body || {};
}

function normalizarNomeSensor(ref) {
  const mapa = {
    "Reservatorio_Elevador": "Reservatorio_Elevador_current",
    "Reservatorio_Osmose": "Reservatorio_Osmose_current",
    "Reservatorio_CME": "Reservatorio_CME_current",
    "Reservatorio_Agua_Abrandada": "Reservatorio_Agua_Abrandada_current",
    "Reservatorio_lavanderia": "Reservatorio_lavanderia_current",
    "Pressao_Saida_Osmose": "Pressao_Saida_Osmose_current",
    "Pressao_Retorno_Osmose": "Pressao_Retorno_Osmose_current",
    "Pressao_Saida_CME": "Pressao_Saida_CME_current",
    "Bomba_01": "Bomba_01_binary",
    "Bomba_02": "Bomba_02_binary",
    "Bomba_Osmose": "Bomba_Osmose_binary",
    "Ciclos_Bomba_01": "Ciclos_Bomba_01_counter",
    "Ciclos_Bomba_02": "Ciclos_Bomba_02_counter",
    "Ciclos_Bomba_Osmose": "Ciclos_Bomba_Osmose_counter"
  };
  return mapa[ref] || ref;
}

function normalizePacket(raw) {
  let arr = [];
  if (!raw) return arr;
  if (raw.data && Array.isArray(raw.data)) {
    arr = raw.data.map(i => ({
      ref: normalizarNomeSensor(i.ref || i.name || i.key),
      value: i.value!== undefined? i.value : i.v,
      dev_id: i.dev_id || raw.dev_id,
      time: i.time || Date.now()
    }));
  } else if (Array.isArray(raw)) {
    arr = raw.map(i => ({ ref: normalizarNomeSensor(i.ref), value: i.value, time: i.time || Date.now() }));
  } else if (typeof raw === "object") {
    arr = Object.keys(raw).map(k => ({ ref: normalizarNomeSensor(k), value: raw[k], time: Date.now() }));
  }
  return arr.filter(x => x.ref!== undefined);
}

function convertAndMerge(dataArray) {
  const novo = safeReadJson(DATA_FILE, {});
  const ts = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    let rawVal = item.value;
    const tsAtual = new Date(parseTimestamp(item.time, ts)).getTime();
    const tsAnterior = novo[`${ref}_timestamp`]? new Date(novo[`${ref}_timestamp`]).getTime() : 0;

    if (tsAnterior && tsAtual < tsAnterior - 120000) continue;
    if (typeof rawVal === "string" &&!isNaN(Number(rawVal))) rawVal = Number(rawVal);

    const sensor = SENSORES[ref];
    if (!sensor) {
      novo[ref] = rawVal;
    } else if (sensor.tipo === "pressao") {
      let c = ((Number(rawVal) - 0.004) / 0.016) * 20;
      novo[ref] = Number(Math.max(0, Math.min(20, c)).toFixed(2));
    } else if (sensor.tipo === "bomba") {
      novo[ref] = Number(rawVal) === 1? 1 : 0;
    } else if (sensor.tipo === "ciclo") {
      novo[ref] = Math.max(0, Math.round(Number(rawVal) || 0));
    } else if (sensor.capacidade) {
      const atual = Number(rawVal) || 0;
      const ant = Number(novo[ref]) || atual;
      novo[ref] = Number(((ant * 0.8) + (atual * 0.2)).toFixed(6));
    } else {
      novo[ref] = rawVal;
    }
    novo[`${ref}_timestamp`] = parseTimestamp(item.time, ts);
  }

  novo.timestamp = ts;
  novo.version = Date.now();
  safeWriteJson(DATA_FILE, novo);
  return novo;
}

function registrarHistorico(dados) {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split('/').reverse().join('-');
  const hist = safeReadJson(HIST_FILE, {});
  if (!hist[hoje]) hist[hoje] = {};

  Object.entries(dados).forEach(([k, v]) => {
    if (k.endsWith("_current") && SENSORES[k]?.capacidade) {
      if (!hist[hoje][k]) hist[hoje][k] = { pontos: [] };
      hist[hoje][k].pontos.push({ hora: new Date().toLocaleTimeString(), valor: v });
    }
  });
  safeWriteJson(HIST_FILE, hist);
}

function buildDashboard(dados) {
  const reservatorios = Object.keys(MAPA_RESERVATORIOS).map(setor => {
    const ref = MAPA_RESERVATORIOS[setor];
    const sensor = SENSORES[ref];
    const leitura = Number(dados[ref] || 0);
    const { percentual, litros, altura } = calcularNivel(ref, leitura);
    return {
      nome: setor.charAt(0).toUpperCase() + setor.slice(1),
      setor,
      percent: Math.round(percentual * 100),
      current_liters: litros,
      altura_cm: altura,
      capacidade: sensor.capacidade
    };
  });

  const pressoes = [
    { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: dados["Pressao_Saida_Osmose_current"]?? null },
    { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: dados["Pressao_Retorno_Osmose_current"]?? null },
    { nome: "Pressão Saída CME", setor: "saida_cme", pressao: dados["Pressao_Saida_CME_current"]?? null }
  ];

  const bombas = [
    { nome: "Bomba 01", estado: Number(dados["Bomba_01_binary"]) === 1? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0 },
    { nome: "Bomba 02", estado: Number(dados["Bomba_02_binary"]) === 1? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0 },
    { nome: "Bomba Osmose", estado: Number(dados["Bomba_Osmose_binary"]) === 1? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_Osmose_counter"]) || 0 }
  ];

  return {
    lastUpdate: dados.timestamp || new Date().toLocaleString("pt-BR"),
    reservatorios,
    pressoes,
    bombas
  };
}

// ================= ROTEAMENTO GATEWAY ITG 200 =================
app.post(["/atualizar/api/v1_2/json/itg/data", "/atualizar/api/v1_2/json/itg/connection_status", "/atualizar", "/iot"], async (req, res) => {
  try {
    console.log("🔥 CHEGOU DADO DO GATEWAY");
    console.log("📥 BODY:", req.body);

    let parsed = extractAnyPayload(req);
    if (parsed.seq && parsed.interface!== undefined &&!parsed.data) {
      return res.status(200).json({ ok: true });
    }

    const arr = normalizePacket(parsed);
    if (!arr.length) return res.status(400).json({ erro: "Nenhum dado encontrado" });

    const novo = convertAndMerge(arr);
    registrarHistorico(novo);
    wsBroadcast({ type: "update", dados: buildDashboard(novo) });
    res.json({ ok: true });
  } catch (e) {
    console.error("Erro processar:", e);
    res.status(500).json({ erro: e.message });
  }
});

// ================= ENDPOINTS DE LEITURA =================
app.get("/api/dashboard", (req, res) => {
  const dados = safeReadJson(DATA_FILE, {});
  res.json(buildDashboard(dados));
});

app.get("/dados", (req, res) => {
  res.json(safeReadJson(DATA_FILE, {}));
});

app.get("/historico", (req, res) => {
  res.json(safeReadJson(HIST_FILE, {}));
});

app.get("/api/debug-calculo", (req, res) => {
  const dados = safeReadJson(DATA_FILE, {});
  const debug = {};
  Object.keys(MAPA_RESERVATORIOS).forEach(setor => {
    const ref = MAPA_RESERVATORIOS[setor];
    const leitura = Number(dados[ref] || 0);
    debug[setor] = { ref, leitura_bruta: leitura, config: SENSORES[ref], resultado: calcularNivel(ref, leitura) };
  });
  res.json(debug);
});

// ------------------------- ARQUIVOS ESTÁTICOS -------------------------
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// ------------------------- PING / KEEP ALIVE -------------------------
app.get("/api/ping", (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// ------------------------- START SERVER -------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(chalk.green(`🚀 Servidor HAG rodando na porta ${PORT}`));
});
