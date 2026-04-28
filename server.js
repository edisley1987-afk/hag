/**
 * =========================================================
 * Sistema de Monitoramento de Reservatórios – HAG
 * =========================================================
 *
 * Autor: Edisley Afonso Costa
 * Projeto: Hospital Arnaldo Gavazza
 *
 * Descrição:
 * Servidor Node.js responsável pelo processamento
 * de dados IoT, histórico, consumo, alertas e dashboard
 * em tempo real (WebSocket).
 *
 * Tecnologias:
 * - Node.js (ESModules)
 * - Express
 * - WebSocket (ws)
 * - Render Cloud
 *
 * Criado em: 2025
 * Direitos autorais © 2025 Edisley Afonso Costa
 *
 * Uso autorizado exclusivamente para o projeto HAG.
 * =========================================================
 */
// @author: Edisley Afonso Costa
// @version: 1.0.1
// @last_update: 2026-04-27
// @environment: Production (Render)

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
import http from "http";

const server = http.createServer(app);

// ================= WEBSOCKET =================
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  console.log(chalk.blue("🔌 Cliente WebSocket conectado"));
  clients.add(ws);
  ws.on("close", () => {
    console.log(chalk.red("❌ Cliente desconectado"));
    clients.delete(ws);
  });
  ws.on("error", (err) => {
    console.error("WebSocket erro:", err);
    clients.delete(ws);
  });
});

function wsBroadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) {
      try {
        client.send(msg);
      } catch (e) {
        console.error("Erro ao enviar WS:", e);
      }
    }
  }
}

// ------------------------- ARQUIVOS E CONSTANTES -------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");
const CONSUMO_FILE = path.join(DATA_DIR, "consumo_osmose.json");
const ALERTA_FILE = path.join(DATA_DIR, "alerta_consumo.json");

const DATA_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos
const ALERTA_FATOR = 2.5;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANUT_FILE)) fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

// ------------------------- MIDDLEWARES -------------------------
// ------------------------- MIDDLEWARES -------------------------
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Basic Auth - só depois dos parsers
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from('118582:118582').toString('base64');
  
  if (!auth || auth !== expected) {
    res.setHeader('WWW-Authenticate', 'Basic realm="HAG"');
    return res.status(401).send('Unauthorized');
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(chalk.gray(`[${new Date().toISOString()}] [${req.method}] ${req.originalUrl} → ${ms}ms`));
  });
  next();
});

// ================= SENSORES / CALIBRAÇÃO =================
const SENSORES = {
  "Reservatorio_Elevador_current": {
    leituraVazio: 0.005250,
    leituraCheio: 0.009018,
    capacidade: 20000,
    altura: 1.45
  },

  "Reservatorio_Osmose_current": {
    leituraVazio: 0.00505,
    leituraCheio: 0.006853,
    capacidade: 200,
    altura: 1.0
  },

  "Reservatorio_CME_current": {
    leituraVazio: 0.004088,
    leituraCheio: 0.00537,
    capacidade: 1000,
    altura: 0.45
  },

  "Reservatorio_Agua_Abrandada_current": {
    leituraVazio: 0.004048,
    leituraCheio: 0.004929,
    capacidade: 9000,
    altura: 0.6
  },

  "Reservatorio_lavanderia_current": {
    leituraVazio: 0.006012,
    leituraCheio: 0.011623,
    capacidade: 10000,
    altura: 1.45
  },

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

// ================= CALIBRAÇÃO UNIFICADA =================
function calcularNivel(ref, leitura) {
  const sensor = SENSORES[ref];
  if (!sensor ||!sensor.capacidade) return { percentual: 0, litros: 0, altura: 0 };

  const span = sensor.leituraCheio - sensor.leituraVazio;
 let percentual = span > 0 ? (leitura - sensor.leituraVazio) / span : 0;

// SUAVIZAÇÃO (anti-piscada)
const ultimo = sensor._ultimoPercentual ?? percentual;
percentual = (ultimo * 0.7) + (percentual * 0.3);
sensor._ultimoPercentual = percentual;

// Limite final
percentual = Math.max(0, Math.min(1, percentual));

  if (percentual < 0.02) percentual = 0; // corte de ruído

  const litros = Math.round(percentual * sensor.capacidade);
  const alturaCm = Math.round(percentual * sensor.altura * 100);

  return { percentual, litros, altura: alturaCm };
}

// ================= PREVISÃO DE ESVAZIAMENTO =================
function preverEsvaziamento(nivelAtual, consumoPorMinuto) {
  if (!consumoPorMinuto || consumoPorMinuto <= 0) return null;
  const minutos = nivelAtual / consumoPorMinuto;
  const data = new Date(Date.now() + minutos * 60000);
  return {
    minutos_restantes: Math.round(minutos),
    previsao: data.toISOString()
  };
}

// tenta extrair JSON do body
function extractAnyPayload(req) {
  let raw = req.body;
  if (!raw || raw === "") raw = req._rawBody;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    try { return JSON.parse(s); } catch {}
    if (s.includes("=")) {
      const obj = {};
      s.split("&").forEach(p => {
        const [k, v] = p.split("=");
        if (k) obj[decodeURIComponent(k)] = decodeURIComponent(v || "");
      });
      return obj;
    }
    return { raw: s };
  }
  return {};
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
    arr = raw.map(i => ({
      ref: normalizarNomeSensor(i.ref),
      value: i.value,
      time: i.time || Date.now()
    }));
  } else if (typeof raw === "object") {
    arr = Object.keys(raw).map(k => ({
      ref: normalizarNomeSensor(k),
      value: raw[k],
      time: Date.now()
    }));
  }
  return arr.filter(x => x.ref!== undefined);
}

function parseTimestamp(t, fallback) {
  if (!t) return fallback;
  let ms;
  if (t > 1e14) ms = Math.floor(t / 1000); // nanos -> ms
  else if (t > 1e10) ms = t; // ms
  else ms = t * 1000; // sec -> ms
  const date = new Date(ms);
  if (isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

function convertAndMerge(dataArray) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = {...ultimo };
  const timestampNow = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    let rawVal = item.value;
    if (typeof rawVal === "string" && rawVal.trim()!== "" &&!isNaN(Number(rawVal))) {
      rawVal = Number(rawVal);
    }

    const sensor = SENSORES[ref];

    if (!sensor) {
      novo[ref] = rawVal;
      novo[`${ref}_timestamp`] = parseTimestamp(item.time, timestampNow);
      continue;
    }

    if (sensor.tipo === "pressao") {
      if (rawVal == null || rawVal === "") {
        novo[ref] = null;
      } else {
        let valorNum = Number(rawVal);
        let convertido = ((valorNum - 0.004) / 0.016) * 20;
        convertido = Math.max(0, Math.min(20, convertido));
        novo[ref] = Number(convertido.toFixed(2));
      }
    } else if (sensor.tipo === "bomba") {
      novo[ref] = Number(rawVal) === 1? 1 : 0;
    } else if (sensor.tipo === "ciclo") {
  novo[ref] = Math.max(0, Math.round(Number(rawVal) || 0));
} else if (sensor.capacidade) {
  // SALVA A LEITURA BRUTA (corrente)
  novo[ref] = Number(rawVal) || 0;

} else {
  // fallback
  novo[ref] = rawVal;
}

    novo[`${ref}_timestamp`] = parseTimestamp(item.time, timestampNow);
  }

  novo.timestamp = timestampNow;
  novo.version = Date.now();
  safeWriteJson(DATA_FILE, novo);
  return novo;
}

function registrarHistorico(dadosConvertidos) {
  const hoje = new Date().toISOString().split("T")[0];
  const historico = safeReadJson(HIST_FILE, {});
  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dadosConvertidos).forEach(([ref, valor]) => {
    if (ref.endsWith("_timestamp") || ref === "timestamp" || ref === "version") return;
    const sensor = SENSORES[ref];
    if (!sensor ||!sensor.capacidade) return;

    if (!historico[hoje][ref]) {
      historico[hoje][ref] = { min: valor, max: valor, pontos: [] };
    }
    const reg = historico[hoje][ref];
    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    const variacao = Math.max(1, sensor.capacidade * 0.02);
    const ultimo = reg.pontos.at(-1);
    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
      reg.pontos.push({
        hora: new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        valor
      });
    }
  });
  safeWriteJson(HIST_FILE, historico);
}

function aplicarFailSafeBombas(dados) {
  const agora = Date.now();
  const bombas = ["Bomba_01_binary", "Bomba_02_binary", "Bomba_Osmose_binary"];
  bombas.forEach(ref => {
    const tsKey = `${ref}_timestamp`;
    const ts = dados[tsKey] ? new Date(dados[tsKey]).getTime() : null;
const stale = !ts || (agora - ts > DATA_TIMEOUT_MS);
    dados[`${ref}_stale`] = stale;
    if (stale) dados[ref] = 0;
  });
  return dados;
}

// =========================================================
// MONTAGEM DO DASHBOARD (Sincronizado com Frontend)
// =========================================================
function buildDashboard(dados) {
  const reservatorios = Object.keys(MAPA_RESERVATORIOS).map(setor => {
    const ref = MAPA_RESERVATORIOS[setor];
    const sensor = SENSORES[ref];
    const leitura = Number(dados[ref] || 0);

    // Aqui acontece a mágica: transforma a corrente em % e Litros
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
    { nome: "Pressão Saída Osmose", pressao: dados["Pressao_Saida_Osmose_current"] ?? null },
    { nome: "Pressão Retorno Osmose", pressao: dados["Pressao_Retorno_Osmose_current"] ?? null },
    { nome: "Pressão Saída CME", pressao: dados["Pressao_Saida_CME_current"] ?? null }
  ];

  const bombas = [
    { nome: "Bomba 01", estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0 },
    { nome: "Bomba 02", estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0 },
    { nome: "Bomba Osmose", estado: Number(dados["Bomba_Osmose_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_Osmose_counter"]) || 0 }
  ];

  return {
    lastUpdate: dados.timestamp || new Date().toLocaleString("pt-BR"),
    reservatorios,
    pressoes,
    bombas
  };
}

// =========================================================
// CÁLCULO DE CONSUMO E ALERTAS
// =========================================================
function calcularConsumoOsmose(nivelAtual) {
  const anterior = safeReadJson(CONSUMO_FILE, {
    ultimoNivel: nivelAtual,
    media_por_minuto: 0,
    historico: []
  });

  const agora = Date.now();
  // Só conta consumo se o nível baixou (evita contar enchimento como consumo)
  let consumoMin = anterior.ultimoNivel > nivelAtual ? anterior.ultimoNivel - nivelAtual : 0;
  
  const historico = anterior.historico || [];
  historico.push({ t: agora, v: consumoMin });

  if (historico.length > 60) historico.shift(); // Mantém última hora

  const media = historico.reduce((s, i) => s + i.v, 0) / (historico.length || 1);
  
  const novo = {
    ultimoNivel: nivelAtual,
    media_por_minuto: Number(media.toFixed(4)),
    historico
  };

  safeWriteJson(CONSUMO_FILE, novo);
  return novo;
}

function detectarConsumoAnormal(consumoAtual, media) {
  if (!media || media <= 0) return false;
  // ALERTA_FATOR geralmente é 2.5 (250% acima da média)
  return consumoAtual > media * (typeof ALERTA_FATOR !== 'undefined' ? ALERTA_FATOR : 2.5);
}

// ------------------------- ROTEAMENTO PRINCIPAL ITG 200 -------------------------
app.use(["/atualizar/api/v1_2/json/itg/data", "/atualizar/api/v1_2/json/itg/connection_status"], async (req, res) => {
  try {
    console.log("🔥 CHEGOU DADO DO GATEWAY ITG");
    console.log("📥 BODY:", req.body);

    let parsed = extractAnyPayload(req);
    
    // Se for só status de conexão, ignora
    if (parsed.seq && parsed.interface !== undefined && !parsed.data) {
      console.log("📡 Status de conexão ITG - ignorando");
      return res.status(200).json({ ok: true });
    }

    if (!parsed || Object.keys(parsed).length === 0) {
      console.warn("⚠️ Payload vazio");
      return res.status(400).json({ erro: "Payload inválido ou vazio" });
    }

    const arr = normalizePacket(parsed);
    if (!arr.length) {
      return res.status(400).json({ erro: "Nenhum dado encontrado no payload" });
    }

    const novo = convertAndMerge(arr);
    aplicarFailSafeBombas(novo);

    // auto desligamento osmose
    const nivelAtualOsmose = Number(novo["Reservatorio_Osmose_current"] || 0);
    const percentualOsmose = (nivelAtualOsmose / SENSORES["Reservatorio_Osmose_current"].capacidade) * 100;
    if (percentualOsmose >= 99) {
      novo["Bomba_Osmose_binary"] = 0;
      novo["Bomba_Osmose_binary_timestamp"] = new Date().toISOString();
    }

    // consumo osmose
    const consumoData = calcularConsumoOsmose(nivelAtualOsmose);
    const consumoAtualMin = consumoData.historico.at(-1)?.v || 0;
    const mediaMin = consumoData.media_por_minuto;

    // alerta
    const alertas = safeReadJson(ALERTA_FILE, {});
    if (detectarConsumoAnormal(consumoAtualMin, mediaMin)) {
      if (!alertas.ativo) {
        alertas.ativo = true;
        alertas.tipo = "CONSUMO_ANORMAL";
        alertas.mensagem = "Consumo acima do padrão";
        alertas.desde = new Date().toISOString();
      }
    } else {
      alertas.ativo = false;
      alertas.tipo = null;
      alertas.mensagem = null;
      alertas.desde = null;
    }
    safeWriteJson(ALERTA_FILE, alertas);

    registrarHistorico(novo);
   wsBroadcast({
  type: "update",
  dados: buildDashboard(novo)
});
    return res.json({ ok: true });

  } catch (err) {
    console.error("Erro processar /atualizar/itg:", err);
    return res.status(500).json({ erro: err?.message || "erro interno" });
  }
});

// ------------------------- ROTEAMENTO PRINCIPAL LEGADO -------------------------
app.use(["/atualizar", "/iot"], async (req, res) => {
  try {
    if (req.method === "GET" && Object.keys(req.query).length === 0) {
      return res.status(200).send("OK");
    }

    console.log("🔥 CHEGOU DADO DO GATEWAY");
    console.log("📥 BODY:", req.body);

    let parsed = extractAnyPayload(req);
    if (Object.keys(parsed).length === 0) parsed = req.query;
    if (!parsed || Object.keys(parsed).length === 0) {
      console.warn("⚠️ Payload vazio");
      return res.status(400).json({ erro: "Payload inválido ou vazio" });
    }
    const arr = normalizePacket(parsed);
    if (!arr.length) {
      return res.status(400).json({ erro: "Nenhum dado encontrado no payload" });
    }

    const novo = convertAndMerge(arr);
    aplicarFailSafeBombas(novo);

    // auto desligamento osmose
    const nivelAtualOsmose = Number(novo["Reservatorio_Osmose_current"] || 0);
    const percentualOsmose = (nivelAtualOsmose / SENSORES["Reservatorio_Osmose_current"].capacidade) * 100;
    if (percentualOsmose >= 99) {
      novo["Bomba_Osmose_binary"] = 0;
      novo["Bomba_Osmose_binary_timestamp"] = new Date().toISOString();
    }

    // consumo osmose
    const consumoData = calcularConsumoOsmose(nivelAtualOsmose);
    const consumoAtualMin = consumoData.historico.at(-1)?.v || 0;
    const mediaMin = consumoData.media_por_minuto;

    // alerta
    const alertas = safeReadJson(ALERTA_FILE, {});
    if (detectarConsumoAnormal(consumoAtualMin, mediaMin)) {
      if (!alertas.ativo) {
        alertas.ativo = true;
        alertas.tipo = "CONSUMO_ANORMAL";
        alertas.mensagem = "Consumo acima do padrão";
        alertas.desde = new Date().toISOString();
      }
    } else {
      alertas.ativo = false;
      alertas.tipo = null;
      alertas.mensagem = null;
      alertas.desde = null;
    }
    safeWriteJson(ALERTA_FILE, alertas);

    registrarHistorico(novo);
    wsBroadcast({
  type: "update",
  dados: buildDashboard(novo)
});
    return res.json({ ok: true });

  } catch (err) {
    console.error("Erro processar /atualizar:", err);
    return res.status(500).json({ erro: err?.message || "erro interno" });
  }
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/dados' || req.path.startsWith('/historico')) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, private, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});
// ------------------------- ENDPOINTS DE LEITURA -------------------------
app.get("/dados", (req, res) => {
  return res.json(safeReadJson(DATA_FILE, {}));
});

const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

app.get("/historico", (req, res) => {
  const historico = safeReadJson(HIST_FILE, {});
  const saida = [];
  for (const [data, sensores] of Object.entries(historico)) {
    for (const [ref, dados] of Object.entries(sensores || {})) {
      const nome = Object.keys(MAPA_RESERVATORIOS).find(key => MAPA_RESERVATORIOS[key] === ref);
      if (!nome ||!dados) continue;
      if (typeof dados.min === "number") {
        saida.push({ reservatorio: nome, timestamp: new Date(data).getTime(), valor: dados.min });
      }
      for (const p of dados.pontos || []) {
        const ts = new Date(`${data}T${p.hora}-03:00`).getTime();
        if (!isNaN(ts)) saida.push({ reservatorio: nome, timestamp: ts, valor: p.valor });
      }
    }
  }
  saida.sort((a, b) => a.timestamp - b.timestamp);
  return res.json(saida);
});

app.get("/historico/24h/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();
  const ref = MAPA_RESERVATORIOS[nome];
  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });
  const historico = safeReadJson(HIST_FILE, {});
  const agora = Date.now();
  const saida = [];
  for (const [data, sensores] of Object.entries(historico)) {
    const pontos = sensores?.[ref]?.pontos || [];
    for (const p of pontos) {
      const ts = new Date(`${data}T${p.hora}-03:00`).getTime();
      if (!isNaN(ts) && (agora - ts <= 24 * 60 * 60 * 1000)) {
        saida.push({ reservatorio: nome, timestamp: ts, valor: p.valor });
      }
    }
  }
  saida.sort((a, b) => a.timestamp - b.timestamp);
  return res.json(saida);
});

app.get("/consumo/5dias/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();
  const mapa = {
    elevador: "Reservatorio_Elevador_current",
    osmose: "Reservatorio_Osmose_current",
    lavanderia: "Reservatorio_lavanderia_current"
  };
  const ref = mapa[nome];
  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });
  const historico = safeReadJson(HIST_FILE, {});
  const datas = Object.keys(historico).sort().slice(-5);
  const resposta = datas.map(dia => {
    const reg = historico[dia]?.[ref];
    if (!reg) return { dia, consumo: 0 };
    const valores = [];
    if (typeof reg.min === "number") valores.push(reg.min);
    if (Array.isArray(reg.pontos)) reg.pontos.forEach(p => valores.push(p.valor));
    if (valores.length < 2) return { dia, consumo: 0 };
    let consumo = 0;
    for (let i = 1; i < valores.length; i++) {
      if (valores[i] < valores[i - 1]) consumo += valores[i - 1] - valores[i];
    }
    return { dia, consumo: Number(consumo.toFixed(2)) };
  });
  return res.json(resposta);
});

app.get("/api/consumo_diario", (req, res) => {
  const diasReq = Number(req.query.dias || 5);
  const historico = safeReadJson(HIST_FILE, {});
  const dias = Object.keys(historico).sort().slice(-diasReq);
  function consumo(ref) {
    return dias.map(data => {
      const reg = historico[data]?.[ref];
      if (!reg) return 0;
      const valores = [];
      if (typeof reg.min === "number") valores.push(reg.min);
      if (Array.isArray(reg.pontos)) reg.pontos.forEach(p => valores.push(p.valor));
      if (valores.length < 2) return 0;
      let total = 0;
      for (let i = 1; i < valores.length; i++) {
        if (valores[i] < valores[i - 1]) total += valores[i - 1] - valores[i];
      }
      return Number(total.toFixed(2));
    });
  }
  return res.json({
    dias,
    elevador: consumo("Reservatorio_Elevador_current"),
    osmose: consumo("Reservatorio_Osmose_current"),
    lavanderia: consumo("Reservatorio_lavanderia_current")
  });
});

// ------------------------- DASHBOARD CORRIGIDO -------------------------
app.get("/api/dashboard", (req, res) => {
  res.setHeader("Cache-Control", "no-store, must-revalidate, max-age=0, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");

  const dados = safeReadJson(DATA_FILE, {});
  if (!dados || Object.keys(dados).length === 0) {
    return res.json({
      lastUpdate: "-",
      reservatorios: [],
      manutencao: getManutencao().ativo
    });
  }

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

  const bombasLigadas = bombas.filter(b => b.estado === "ligada").map(b => b.nome);

  res.json({
    lastUpdate: dados.timestamp || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    reservatorios,
    pressoes,
    bombas,
    bombasLigadas,
    manutencao: getManutencao().ativo,
    alerta_consumo: safeReadJson(ALERTA_FILE, {})
  });
});

// ------------------------- MANUTENÇÃO -------------------------
app.get("/manutencao", (req, res) => res.json(getManutencao()));
app.post("/manutencao", (req, res) => {
  const { ativo } = req.body;
  if (typeof ativo!== "boolean") return res.status(400).json({ erro: "Campo 'ativo' deve ser true/false" });
  setManutencao(ativo);
  res.json({ status: "ok", ativo });
});

// ------------------------- ARQUIVOS ESTÁTICOS -------------------------
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/login", (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// ------------------------- PING / KEEP ALIVE -------------------------
app.get("/api/ping", (req, res) => res.json({ ok: true, timestamp: Date.now() }));
setInterval(() => {
  try {
    if (typeof fetch === "function") {
      const host = process.env.RENDER_INTERNAL_HOSTNAME || process.env.HOSTNAME || "localhost";
      const port = process.env.PORT || 3000;
      fetch(`http://${host}:${port}/api/ping`).catch(() => {});
    }
  } catch (e) {}
}, 60 * 1000);

// ------------------------- START SERVER -------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(chalk.green(`🚀 Servidor rodando na porta ${PORT}`));
});
