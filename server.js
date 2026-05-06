/**
 * =========================================================
 * Sistema de Monitoramento de Reservatórios – HAG
 * =========================================================
 * Autor: Edisley Afonso Costa
 * Versão: 1.0.9 FINAL COMPLETO
 * =========================================================
 */

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

// ================= CONFIG =================
const DEBUG = false;
let lastHealthLog = 0;

// ================= MIDDLEWARES =================
app.use(cors());
app.use(compression());

// Captura body bruto para o gateway
app.use("/atualizar/api/v1_2/json/itg/data", express.raw({ type: "*/*", limit: "10mb" }));
app.use("/atualizar", express.raw({ type: "*/*", limit: "10mb" }));
app.use("/iot", express.raw({ type: "*/*", limit: "10mb" }));

app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================= TRACE =================
app.use(["/atualizar/api/v1_2/json/itg/data", "/atualizar", "/iot"], (req, res, next) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers["user-agent"] || "";

  if (ua.includes("Python")) {
    const now = Date.now();
    if (DEBUG && now - lastHealthLog > 60000) {
      console.log(`[DEBUG] Healthcheck Python - IP: ${ip}`);
      lastHealthLog = now;
    }
    return res.status(200).json({ ok: true });
  }

  next();
});

// ================= AUTH =================
app.use(["/api/dashboard", "/historico", "/dados", "/dashboard"], (req, res, next) => {
  const auth = req.headers.authorization;
  const expected = "Basic " + Buffer.from("118582:118582").toString("base64");

  if (!auth || auth!== expected) {
    res.setHeader("WWW-Authenticate", 'Basic realm="HAG"');
    return res.status(401).send("Unauthorized");
  }
  next();
});

// ================= WEBSOCKET =================
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  console.log("🔌 Cliente WebSocket conectado");
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

function wsBroadcast(data) {
  const msg = JSON.stringify(data);
  for (const c of clients) {
    if (c.readyState === 1) c.send(msg);
  }
}

// ================= ARQUIVOS =================
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ================= SENSORES =================
const SENSORES = {
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
};

const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

// ================= HELPERS =================
function safeReadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8") || "{}");
  } catch {
    return fallback;
  }
}

function safeWriteJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("safeWriteJson error:", e);
  }
}

// ================= CALIBRAÇÃO =================
const MEMORIA_NIVEL = {};

function calcularNivel(ref, leitura) {
  const s = SENSORES[ref];
  if (!s?.capacidade) return { percentual: 0, litros: 0, altura: 0 };

  const span = s.leituraCheio - s.leituraVazio;
  let p = (leitura - s.leituraVazio) / span;
  p = Math.max(0, Math.min(1, p));

  if (!MEMORIA_NIVEL[ref]) MEMORIA_NIVEL[ref] = p;

  let f = MEMORIA_NIVEL[ref] * 0.85 + p * 0.15;

  if (Math.abs(f - MEMORIA_NIVEL[ref]) < 0.01) {
    f = MEMORIA_NIVEL[ref];
  }

  MEMORIA_NIVEL[ref] = f;

  return {
    percentual: f,
    litros: Math.round(f * s.capacidade),
    altura: Math.round(f * s.altura * 100)
  };
}

// ================= HISTÓRICO =================
const DIAS_HISTORICO = 7;

function registrarHistorico(dados) {
  const hist = safeReadJson(HIST_FILE, {});
  const agora = Date.now();

  Object.entries(dados).forEach(([k, v]) => {
    if (!k.endsWith("_current") ||!SENSORES[k]) return;

    if (!hist[k]) hist[k] = { pontos: [] };

    const pontos = hist[k].pontos;
    const ultimo = pontos[pontos.length - 1];

    const variacao = SENSORES[k].capacidade
     ? SENSORES[k].capacidade * 0.01
      : 0.01;

    if (!ultimo || Math.abs(v - ultimo.valor) > variacao || agora - ultimo.timestamp > 300000) {
      pontos.push({ valor: v, timestamp: agora });
    }

    hist[k].pontos = pontos.filter(p => agora - p.timestamp <= DIAS_HISTORICO * 86400000);
  });

  safeWriteJson(HIST_FILE, hist);
}

// ================= PROCESSAMENTO =================
function convertAndMerge(arr) {
  const dados = safeReadJson(DATA_FILE, {});
  const ts = new Date().toISOString();

  for (const i of arr) {
    const ref = i.ref;
    const s = SENSORES[ref];
    if (!s) continue;

    let v = Number(i.value);

    if (s.tipo === "pressao") {
      v = ((v - 0.004) / 0.016) * 20;
      v = Math.max(0, Math.min(20, v));
    } else if (s.tipo === "bomba") {
      v = Number(v) === 1? 1 : 0;
    } else if (s.tipo === "ciclo") {
      v = Math.max(0, Math.round(Number(v) || 0));
    }

    dados[ref] = v;
    dados[ref + "_timestamp"] = ts;
  }

  dados.timestamp = ts;
  safeWriteJson(DATA_FILE, dados);

  return dados;
}

// ================= DASHBOARD =================
function buildDashboard(dados) {
  const hist = safeReadJson(HIST_FILE, {});

  const reservatorios = Object.keys(MAPA_RESERVATORIOS).map(k => {
    const ref = MAPA_RESERVATORIOS[k];
    const leitura = Number(dados[ref] || 0);
    const n = calcularNivel(ref, leitura);

    return {
      nome: k.charAt(0).toUpperCase() + k.slice(1),
      setor: k,
      percent: Math.round(n.percentual * 100),
      current_liters: n.litros,
      altura_cm: n.altura,
      capacidade: SENSORES[ref].capacidade
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
    lastUpdate: dados.timestamp || new Date().toISOString(),
    reservatorios,
    pressoes,
    bombas,
    consumo: calcularConsumoHoje(hist)
  };
}

function calcularConsumoHoje(hist) {
  const calc = (ref) => {
    const p = hist[ref]?.pontos || [];
    if (p.length < 2) return 0;
    return Math.max(0, p[0].valor - p[p.length - 1].valor) * SENSORES[ref].capacidade;
  };

  return {
    elevador_hoje: calc("Reservatorio_Elevador_current"),
    lavanderia_hoje: calc("Reservatorio_lavanderia_current"),
    osmose_hoje: calc("Reservatorio_Osmose_current")
  };
}

// ================= ROTAS =================
app.get("/", (_, res) => res.send("Servidor HAG Online"));
app.get("/ping", (_, res) => res.send("pong"));

app.post(["/atualizar/api/v1_2/json/itg/data", "/atualizar", "/iot"], (req, res) => {
  console.log("🔥 DADO RECEBIDO DO GATEWAY");

  const raw = req.body?.toString("utf8") || "{}";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return res.status(400).json({ erro: "JSON inválido" });
  }

  // Ack de conexão do ITG200
  if (parsed.seq && (!parsed.data || parsed.signal!== undefined)) {
    return res.status(200).json({ ok: true, msg: "connection_ack" });
  }

  if (!parsed.data ||!Array.isArray(parsed.data)) {
    return res.json({ ok: true, msg: "empty_payload" });
  }

  const dados = convertAndMerge(parsed.data);

  registrarHistorico(dados);

  wsBroadcast({ type: "update", dados: buildDashboard(dados) });

  console.log(`[GATEWAY] ${parsed.data.length} sensores salvos - ${dados.timestamp}`);
  res.json({ ok: true, recebidos: parsed.data.length, timestamp: dados.timestamp });
});

// ================= HISTÓRICO =================
app.get("/historico", (req, res) => {
  const hist = safeReadJson(HIST_FILE, {});
  const saida = {};

  Object.entries(hist).forEach(([ref, dados]) => {
    const setor = Object.keys(MAPA_RESERVATORIOS)
     .find(k => MAPA_RESERVATORIOS[k] === ref);

    if (!setor) return;

    saida[setor] = (dados.pontos || []).map(p => ({
      x: p.timestamp,
      y: Math.round(calcularNivel(ref, p.valor).percentual * 100)
    }));
  });

  res.json(saida);
});

app.get("/historico/24h/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();
  const ref = MAPA_RESERVATORIOS[nome];

  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });

  const hist = safeReadJson(HIST_FILE, {});
  const agora = Date.now();

  const pontos = hist[ref]?.pontos || [];

  const saida = pontos
   .filter(p => agora - p.timestamp <= 86400000)
   .map(p => ({
      timestamp: p.timestamp,
      valor: Math.round(calcularNivel(ref, p.valor).percentual * 100)
    }));

  res.json(saida);
});

// ================= OUTROS =================
app.get("/dados", (_, res) => res.json(safeReadJson(DATA_FILE, {})));

app.get("/api/dashboard", (_, res) => {
  const dados = safeReadJson(DATA_FILE, {});
  res.json(buildDashboard(dados));
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/dashboard", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);

// ================= START =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(chalk.green(`🚀 Servidor HAG rodando na porta ${PORT}`));
});
