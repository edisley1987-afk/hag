/**
 * =========================================================
 *  Sistema de Monitoramento de Reservatórios – HAG
 * =========================================================
 *
 *  Autor: Edisley Afonso Costa
 *  Projeto: Hospital Arnaldo Gavazza
 *
 *  Descrição:
 *    Servidor Node.js responsável pelo processamento
 *    de dados IoT, histórico, consumo, alertas e dashboard
 *    em tempo real (WebSocket).
 *
 *  Tecnologias:
 *    - Node.js (ESModules)
 *    - Express
 *    - WebSocket (ws)
 *    - Render Cloud
 *
 *  Criado em: 2025
 *  Direitos autorais © 2025 Edisley Afonso Costa
 *
 *  Uso autorizado exclusivamente para o projeto HAG.
 * =========================================================
 */
// @author: Edisley Afonso Costa
// @version: 1.0.0
// @last_update: 2025-12-18
// @environment: Production (Render)

// server.js - Servidor HAG otimizado (ESModules) + WebSocket (tempo real)
// Requer: express, cors, compression, ws, chalk
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import compression from "compression";
import { fileURLToPath } from "url";
import chalk from "chalk";

// ========================= IO QUEUE =========================
let writing = false;
const queue = [];
const MAX_QUEUE = 1000;

// 🔒 CONTROLE DE CONCORRÊNCIA (rota /atualizar)
let processing = false;

function safeWriteJson(filePath, data) {
  if (queue.length >= MAX_QUEUE) {
    console.warn("Fila cheia, descartando escrita:", filePath);
    return;
  }

  queue.push({ file: filePath, data });
  processQueue();
}

async function processQueue() {
  if (writing || queue.length === 0) return;

  writing = true;
  const { file, data } = queue.shift();

  try {
    const tmp = file + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.promises.rename(tmp, file);
  } catch (e) {
    console.error("Erro escrita JSON:", file, e);
  } finally {
    writing = false;
    setImmediate(processQueue);
  }
}




// ========================= PATHS =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================= APP =========================
const app = express();
// ------------------------- ARQUIVOS E CONSTANTES -------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");

// ------------------------- CONSUMO / ALERTAS -------------------------
const CONSUMO_FILE = path.join(DATA_DIR, "consumo_osmose.json");
const ALERTA_FILE = path.join(DATA_DIR, "alerta_consumo.json");
// ------------------------- INTELIGÊNCIA -------------------------
const INTELIGENCIA_FILE = path.join(DATA_DIR, "inteligencia.json");

if (!fs.existsSync(INTELIGENCIA_FILE)) {
  safeWriteJson(INTELIGENCIA_FILE, {
    historicoInicio: [],
    mediaInicio: 0,
    ultimoNivel: 0,
    ultimoTimestamp: null,
    alerta: false,
    mensagem: null
  });
}

// tempo máximo sem atualização de bomba (ms)
const DATA_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos

// fator para considerar consumo anormal
const ALERTA_FATOR = 2.5;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANUT_FILE)) fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

// ------------------------- MIDDLEWARES -------------------------
app.use(cors());
app.use(compression()); // gzip/deflate
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: ["text/*", "application/*"], limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Prevent caching of API responses (dashboard needs fresh) - global
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Request logging with timing
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
    capacidade: 20000 
  },

  "Reservatorio_Osmose_current": { 
    leituraVazio: 0.00505, 
    leituraCheio: 0.006853, 
    capacidade: 200 
  },

  "Reservatorio_CME_current": { 
    leituraVazio: 0.004088, 
    leituraCheio: 0.005370, 
    capacidade: 1000 
  },

  "Reservatorio_Agua_Abrandada_current": { 
    leituraVazio: 0.004048, 
    leituraCheio: 0.004929, 
    capacidade: 9000 
  },

  "Reservatorio_lavanderia_current": { 
    leituraVazio: 0.006012, 
    leituraCheio: 0.011623, 
    capacidade: 10000 
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


// ========================= CÁLCULO DE NÍVEL =========================
function calcularNivel(leitura, sensor) {

  const range = sensor.leituraCheio - sensor.leituraVazio;

  if (range <= 0) return { percent: 0, litros: 0 };

  let percent = (leitura - sensor.leituraVazio) / range;

  // proteção contra ruído físico
  percent = Math.max(0, Math.min(1, percent));

  return {
    percent: Number((percent * 100).toFixed(1)),
    litros: Math.round(percent * sensor.capacidade)
  };
}

// ------------------------- HELPERS IO -------------------------
function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const s = fs.readFileSync(filePath, "utf8");
    return JSON.parse(s || "{}");
  } catch (e) {
    console.error("Erro leitura JSON:", filePath, e);
    return fallback;
  }
}


function getManutencao() {
  try { return JSON.parse(fs.readFileSync(MANUT_FILE, "utf8")); } catch { return { ativo: false }; }
}
function setManutencao(ativo) { fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo }, null, 2)); }

// tenta extrair JSON do body (strings ou pares k=v)
function parseBodyGuess(body) {
  if (!body) return null;
  if (typeof body === "object") return body;
  if (typeof body === "string") {
    const s = body.trim();
    try { return JSON.parse(s); } catch {}
    if (s.includes("=") && s.includes("&")) {
      const parts = s.split("&");
      const obj = {};
      parts.forEach(p => {
        const [k, v] = p.split("=");
        obj[decodeURIComponent(k || "")] = decodeURIComponent(v || "");
      });
      return obj;
    }
    return null;
  }
  return null;
}

// normaliza vários formatos em [{ref,value,dev_id,time},...]
function normalizePacket(raw) {
  let arr = [];
  if (!raw) return arr;
  if (Array.isArray(raw)) {
    arr = raw.map(i => ({ ref: i.ref ?? i.name ?? i.key, value: i.value ?? i.v ?? i.val ?? i, dev_id: i.dev_id ?? i.devId ?? i.device, time: i.time }));
  } else if (raw.data && Array.isArray(raw.data)) {
    arr = raw.data.map(i => ({ ref: i.ref ?? i.name ?? i.key, value: i.value ?? i.v ?? i.val ?? i, dev_id: i.dev_id ?? i.devId ?? i.device, time: i.time }));
  } else if (typeof raw === "object") {
    arr = Object.keys(raw).map(k => ({ ref: k, value: raw[k] }));
  }
  return arr.filter(x => x.ref !== undefined);
}

// converte valores segundo SENSORES e mescla com ultimo estado (patch)
function convertAndMerge(dataArray) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = { ...ultimo };
  const timestampNow = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    let rawVal = item.value;

    if (typeof rawVal === "string" && rawVal.trim() !== "" && !isNaN(Number(rawVal))) rawVal = Number(rawVal);

    const sensor = SENSORES[ref];

    if (!sensor) {
      novo[ref] = rawVal;
      novo[`${ref}_timestamp`] = item.time ? new Date(item.time).toISOString() : timestampNow;
      continue;
    }

    if (sensor.tipo === "pressao") {
      let valorNum = Number(rawVal) || 0;
      let convertido = ((valorNum - 0.004) / 0.016) * 20;
      convertido = Math.max(0, Math.min(20, convertido));
      novo[ref] = Number(convertido.toFixed(2));
    } else if (sensor.tipo === "bomba") {
      novo[ref] = Number(rawVal) === 1 ? 1 : 0;
    } else if (sensor.tipo === "ciclo") {
      novo[ref] = Math.max(0, Math.round(Number(rawVal) || 0));
    } else if (sensor.capacidade) {
      const leitura = Number(rawVal) || 0;

// 🔍 DEBUG (pode remover depois)
if (ref === "Reservatorio_Elevador_current") {
  console.log("DEBUG ELEVADOR:", {
    leitura,
    vazio: sensor.leituraVazio,
    cheio: sensor.leituraCheio
  });
}

// 🧠 CÁLCULO COM TOLERÂNCIA
const tolerancia = 0.0002;

const resultado = calcularNivel(leitura, sensor);

novo[ref] = resultado.litros;
novo[`${ref}_percent`] = resultado.percent;
novo[`${ref}_raw`] = leitura;


// 🔧 Correção por faixa inválida
const leitura = Number(rawVal) || 0;
const tolerancia = 0.0002;

let resultado = calcularNivel(leitura, sensor);

// proteção de limites físicos
if (leitura > sensor.leituraCheio + tolerancia) {
  resultado.percent = 100;
  resultado.litros = sensor.capacidade;
}

if (leitura < sensor.leituraVazio - tolerancia) {
  resultado.percent = 0;
  resultado.litros = 0;
}

novo[ref] = Math.round(resultado.litros);
novo[`${ref}_percent`] = Number(resultado.percent.toFixed(1));
novo[`${ref}_raw`] = leitura;

// clamp final
percent = Math.max(0, Math.min(100, percent));

// litros
const litros = (percent / 100) * sensor.capacidade;

// salvar
novo[ref] = Math.round(litros);
novo[`${ref}_percent`] = Number(percent.toFixed(1));

// opcional (fortemente recomendado)
novo[`${ref}_raw`] = leitura;


    } else {
      novo[ref] = rawVal;
    }

    novo[`${ref}_timestamp`] = item.time ? new Date(item.time).toISOString() : timestampNow;
  }

  // *** CORREÇÃO: gerar timestamp sempre único (evita dashboard congelado) ***
  // Usamos ISO + millis + pequeno sufixo aleatório para garantir unicidade.
  novo.timestamp = `${new Date().toISOString()}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  return novo;
}

// registra histórico diário (min/max + pontos relevantes)
// ------------------------- LIMPEZA DE HISTÓRICO -------------------------
function limparHistoricoAntigo() {
  const historico = safeReadJson(HIST_FILE, {});
  const limiteDias = 7;

  const datas = Object.keys(historico).sort();

  if (datas.length > limiteDias) {
    const remover = datas.slice(0, datas.length - limiteDias);
    remover.forEach(d => delete historico[d]);

    safeWriteJson(HIST_FILE, historico);
    console.log("🧹 Histórico antigo removido:", remover.length, "dias");
  }
}

// ------------------------- HISTÓRICO -------------------------
function registrarHistorico(dadosConvertidos) {
  const hoje = new Date().toISOString().split("T")[0];
  const historico = safeReadJson(HIST_FILE, {});

  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dadosConvertidos).forEach(([ref, valor]) => {
    if (ref.endsWith("_timestamp") || ref === "timestamp") return;

    const sensor = SENSORES[ref];
    if (!sensor || !sensor.capacidade) return;

    const percent = dadosConvertidos[`${ref}_percent`] || 0;

    if (!historico[hoje][ref]) {
      historico[hoje][ref] = {
        min: valor,
        max: valor,
        min_percent: percent,
        max_percent: percent,
        pontos: []
      };
    }

    const reg = historico[hoje][ref];

    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    reg.min_percent = Math.min(reg.min_percent, percent);
    reg.max_percent = Math.max(reg.max_percent, percent);

    const variacao = Math.max(1, sensor.capacidade * 0.02);
    const ultimo = reg.pontos.at(-1);

    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
      reg.pontos.push({
        hora: new Date().toISOString(),
        valor,
        percent
      });

      if (reg.pontos.length > 200) {
        reg.pontos.shift();
      }
    }
  });

  limparHistoricoAntigo();
  safeWriteJson(HIST_FILE, historico);
}

function aplicarFailSafeBombas(dados) {
  const agora = Date.now();

  const bombas = [
    "Bomba_01_binary",
    "Bomba_02_binary",
    "Bomba_Osmose_binary"
  ];

  bombas.forEach(ref => {
    const tsKey = `${ref}_timestamp`;
    const ts = dados[tsKey] ? new Date(dados[tsKey]).getTime() : 0;

    if (!ts || (agora - ts > DATA_TIMEOUT_MS && dados[ref] === 1)) {
      dados[ref] = 0;
      dados[tsKey] = new Date().toISOString();
    }
  });

  return dados;
}

// ------------------------- CONSUMO / ALERTAS -------------------------
if (!fs.existsSync(CONSUMO_FILE)) {
  safeWriteJson(CONSUMO_FILE, {
    ultimoNivel: 0,
    totalConsumido: 0,
    media_por_minuto: 0,
    timestamp: null
  });
}

if (!fs.existsSync(ALERTA_FILE)) {
  safeWriteJson(ALERTA_FILE, {
    ativo: false,
    tipo: null,
    mensagem: null,
    desde: null
  });
}

// ========================= INTELIGÊNCIA =========================
function analisarEnchimento(nivelAtual, bombaLigada) {
  const intel = safeReadJson(INTELIGENCIA_FILE, {});
  const agora = Date.now();

  let subindo = false;

  if (intel.ultimoNivel && nivelAtual > intel.ultimoNivel + 0.5) {
    subindo = true;

    intel.historicoInicio.push(intel.ultimoNivel);

    if (intel.historicoInicio.length > 50) {
      intel.historicoInicio.shift();
    }

    const soma = intel.historicoInicio.reduce((a, b) => a + b, 0);
    intel.mediaInicio = soma / intel.historicoInicio.length;
  }

  let minutosSemSubir = 0;

  if (intel.ultimoTimestamp) {
    minutosSemSubir = (agora - new Date(intel.ultimoTimestamp).getTime()) / 60000;
  }

  if (
    intel.mediaInicio > 0 &&
    bombaLigada === 1 &&
    minutosSemSubir > 5 &&
    !subindo
  ) {
    intel.alerta = true;
    intel.mensagem = "⚠️ Bomba ligada mas nível não sobe";
  } else {
    intel.alerta = false;
    intel.mensagem = null;
  }

  intel.ultimoNivel = nivelAtual;
  intel.ultimoTimestamp = new Date().toISOString();

  safeWriteJson(INTELIGENCIA_FILE, intel);

  return intel;
}

// ========================= CONSUMO =========================
function calcularConsumoOsmose(nivelAtual) {
  const consumo = safeReadJson(CONSUMO_FILE, {});
  let consumido = 0;

  if (consumo.ultimoNivel > 0 && nivelAtual < consumo.ultimoNivel) {
    const diff = consumo.ultimoNivel - nivelAtual;

    // filtro de ruído
    if (diff > 1 && diff < 50) {
      consumido = diff;
      consumo.totalConsumido += consumido;
    }
  }

  const agora = Date.now();

  if (consumo.timestamp) {
    const minutos = (agora - new Date(consumo.timestamp).getTime()) / 60000;

    if (minutos > 0 && consumido > 0) {
      consumo.media_por_minuto = Number((consumido / minutos).toFixed(3));
    }
  }

  consumo.ultimoNivel = nivelAtual;
  consumo.timestamp = new Date().toISOString();

  safeWriteJson(CONSUMO_FILE, consumo);

  return consumo;
}
function detectarConsumoAnormal(consumoAtual, media) {
  if (!media || media <= 0) return false;
  return consumoAtual > media * ALERTA_FATOR;
}

function preverEsvaziamento(litros, consumoPorMinuto) {
  if (!consumoPorMinuto || consumoPorMinuto <= 0) return null;

  const minutos = litros / consumoPorMinuto;
  return {
    minutos: Math.round(minutos),
    horas: Number((minutos / 60).toFixed(2)),
    previsao: new Date(Date.now() + minutos * 60000).toISOString()
  };
}

// ------------------------- WEBSOCKET (tempo real) -------------------------
 import { WebSocketServer, WebSocket } from "ws"; 
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(chalk.green(`Servidor HAG otimizado ativo na porta ${process.env.PORT || 3000}`));
});
// WebSocket server ligado ao mesmo HTTP server
const wss = new WebSocketServer({ server });
function wsBroadcast(obj) {
  const msg = JSON.stringify(obj);
  let count = 0;

  wss.clients.forEach(c => {
    try {
      if (c.readyState === WebSocket.OPEN) {
        c.send(msg);
        count++;
      }
    } catch (e) {}
  });

  if (count) {
    console.log(chalk.cyan(`WS broadcast → ${count} clients`));
  }
}


// 🔁 HEARTBEAT (AGORA NO LUGAR CERTO)
setInterval(() => {

  const dados = safeReadJson(DATA_FILE, {});

  if (dados && Object.keys(dados).length > 0) {
    wsBroadcast({
      type: "heartbeat",
      dados
    });
  }

}, 3000);

// conexão
wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;

  console.log(chalk.cyan(`WS client connected: ${ip}`));

  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }

    } catch (e) {}
  });

  ws.on("close", () => {
    console.log(chalk.yellow(`WS client disconnected: ${ip}`));
  });

  const dados = safeReadJson(DATA_FILE, {});

  try {
    ws.send(JSON.stringify({ type: "init", dados }));
  } catch (e) {}
});

// 💓 MONITORAMENTO DE CONEXÃO
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);


// ------------------------- ROTEAMENTO PRINCIPAL -------------------------
// Aceita POST/PUT em /atualizar e /iot (compatibilidade com Gateway)
app.all(["/atualizar", "/atualizar/*", "/iot", "/iot/*"], async (req, res) => {

  // 🔒 SEGURANÇA
  const apiKey = req.headers["x-api-key"];
  if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
    return res.status(403).json({ erro: "Não autorizado" });
  }

  // 🔒 LOCK DE PROCESSAMENTO
  if (processing) {
    return res.status(429).json({ erro: "Servidor ocupado, tente novamente" });
  }

  processing = true;

  try {
    let rawBody = req.body;

    if (!rawBody || (typeof rawBody === "string" && rawBody.trim() === "")) {
      rawBody = req._rawBody || req.body;
    }

    const parsed = parseBodyGuess(rawBody);

    if (!parsed) {
      console.warn(
        chalk.yellow("Payload não entendível:"),
        typeof rawBody === "string"
          ? (rawBody || "").slice(0, 500)
          : rawBody
      );
      return res.status(400).json({ erro: "Payload inválido ou vazio" });
    }

    const arr = normalizePacket(parsed);

    if (!arr.length) {
      return res.status(400).json({ erro: "Nenhum dado encontrado no payload" });
    }

    // ============================================================
    // 🔄 CONVERSÃO + MERGE
    // ============================================================
    const novo = convertAndMerge(arr);

    // ============================================================
    // 🛡 FAIL SAFE BOMBAS
    // ============================================================
    aplicarFailSafeBombas(novo);

    // ============================================================
    // 🔴 AUTO DESLIGAMENTO – BOMBA OSMOSE
    // ============================================================
    const CAPACIDADE_OSMOSE = 200; // litros
    const nivelAtualOsmose = Number(novo["Reservatorio_Osmose_current"] || 0);
    const percentualOsmose = (nivelAtualOsmose / CAPACIDADE_OSMOSE) * 100;

    // 🚫 Desliga bomba ao atingir 99%
    if (percentualOsmose >= 99) {
      novo["Bomba_Osmose_binary"] = 0;
      novo["Bomba_Osmose_binary_timestamp"] = new Date().toISOString();
    }

    // (Histerese futura – religar só abaixo de 95%)
    if (percentualOsmose <= 95) {
      // reservado para automação futura
    }

    // ============================================================
    // 💾 SALVA ESTADO FINAL
    // ============================================================
    safeWriteJson(DATA_FILE, novo);

    // ============================================================
    // 📉 CONSUMO OSMOSE
    // ============================================================

    // calcula consumo atual
    const consumo = calcularConsumoOsmose(nivelAtualOsmose);

    // pega histórico anterior para média real
    const consumoAnterior = safeReadJson(CONSUMO_FILE, {});

    // valores para análise
    const consumoAtualMin = consumo.media_por_minuto || 0;
    const mediaMin = consumoAnterior.media_por_minuto || 0;

    // ============================================================
    // 🧠 INTELIGÊNCIA DE ENCHIMENTO
    // ============================================================
    const nivelPercent = novo["Reservatorio_Osmose_current_percent"] || 0;

    const inteligencia = analisarEnchimento(
      nivelPercent,
      novo["Bomba_Osmose_binary"]
    );

    novo.inteligencia = inteligencia;

    // ============================================================
    // 🚨 ALERTA DE CONSUMO ANORMAL
    // ============================================================
    const alertas = safeReadJson(ALERTA_FILE, {});

    if (detectarConsumoAnormal(consumoAtualMin, mediaMin)) {
      if (!alertas.ativo) {
        alertas.ativo = true;
        alertas.tipo = "CONSUMO_ANORMAL";
        alertas.mensagem = "Consumo acima do padrão (possível vazamento)";
        alertas.desde = new Date().toISOString();
      }
    } else {
      alertas.ativo = false;
      alertas.tipo = null;
      alertas.mensagem = null;
      alertas.desde = null;
    }

    safeWriteJson(ALERTA_FILE, alertas);

    // ============================================================
    // 📊 HISTÓRICO + WEBSOCKET
    // ============================================================
    try {
      registrarHistorico(novo);
    } catch (e) {
      console.error("Erro historico:", e);
    }

    wsBroadcast({
      type: "update",
      dados: novo,
      recebido: arr.length
    });

    console.log(
      chalk.green(
        `➡️ Pacote processado: itens=${arr.length} | timestamp=${novo.timestamp}`
      )
    );

    return res.json({
      status: "ok",
      dados: novo,
      recebido: arr.length
    });

  } catch (err) {
    console.error("Erro processar /atualizar:", err);

    return res.status(500).json({
      erro: err?.message || "erro interno"
    });

  } finally {
    // 🔓 LIBERA O LOCK SEMPRE
    processing = false;
  }
});



// ------------------------- ENDPOINTS DE LEITURA -------------------------
app.get("/dados", (req, res) => {
  return res.json(safeReadJson(DATA_FILE, {}));
});

// Mapa fixo dos reservatórios
const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

// ------------------------- HISTÓRICO SIMPLIFICADO -------------------------
app.get("/historico", (req, res) => {
  const historico = safeReadJson(HIST_FILE, {});
  const saida = [];

  for (const [data, sensores] of Object.entries(historico)) {
    for (const [ref, dados] of Object.entries(sensores || {})) {
      const nome = Object.keys(MAPA_RESERVATORIOS)
        .find(key => MAPA_RESERVATORIOS[key] === ref);

      if (!nome || !dados) continue;

      // ponto mínimo do dia
      if (typeof dados.min === "number") {
        saida.push({
          reservatorio: nome,
          timestamp: new Date(data).getTime(),
          valor: dados.min
        });
      }

      // pontos relevantes
      for (const p of dados.pontos || []) {
        const ts = new Date(p.hora).getTime();

        if (!isNaN(ts)) {
          saida.push({
            reservatorio: nome,
            timestamp: ts,
            valor: p.valor
          });
        }
      }
    }
  }

  saida.sort((a, b) => a.timestamp - b.timestamp);
  return res.json(saida);
});

// ------------------------- HISTÓRICO 24H -------------------------
app.get("/historico/24h/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();
  const ref = MAPA_RESERVATORIOS[nome];

  if (!ref) {
    return res.status(400).json({ erro: "Reservatório inválido" });
  }

  const historico = safeReadJson(HIST_FILE, {});
  const agora = Date.now();
  const saida = [];

  for (const [data, sensores] of Object.entries(historico)) {
    const pontos = sensores?.[ref]?.pontos || [];

    for (const p of pontos) {
      const ts = new Date(p.hora).getTime();
      if (!isNaN(ts) && (agora - ts <= 24 * 60 * 60 * 1000)) {
        saida.push({
          reservatorio: nome,
          timestamp: ts,
          valor: p.valor
        });
      }
    }
  }

  saida.sort((a, b) => a.timestamp - b.timestamp);
  return res.json(saida);
});

// ------------------------- CONSUMO 5 DIAS -------------------------
app.get("/consumo/5dias/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();

  const mapa = {
    elevador: "Reservatorio_Elevador_current",
    osmose: "Reservatorio_Osmose_current",
    lavanderia: "Reservatorio_lavanderia_current"
  };

  const ref = mapa[nome];
  if (!ref) {
    return res.status(400).json({ erro: "Reservatório inválido" });
  }

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
      if (valores[i] < valores[i - 1]) {
        consumo += valores[i - 1] - valores[i];
      }
    }

    return { dia, consumo: Number(consumo.toFixed(2)) };
  });

  return res.json(resposta);
});

// ------------------------- CONSUMO DIÁRIO (API) -------------------------
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
        if (valores[i] < valores[i - 1]) {
          total += valores[i - 1] - valores[i];
        }
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
// ------------------------- DASHBOARD SIMPLIFICADO -------------------------
// Reforçamos headers anti-cache específicos desta rota também.
app.get("/api/dashboard", (req, res) => {
  res.setHeader("Cache-Control", "no-store, must-revalidate, max-age=0, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  // cabeçalhos extras que ajudam CDNs/Proxies (Akamai/Render)
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vary", "Accept-Encoding");

  const dados = safeReadJson(DATA_FILE, {});
  if (!dados || Object.keys(dados).length === 0) {
    return res.json({
      lastUpdate: "-",
      reservatorios: [],
      pressoes: [],
      bombas: [],
      manutencao: getManutencao().ativo,
      previsao_esvaziamento: null,
      alerta_consumo: safeReadJson(ALERTA_FILE, {})
    });
  }

 function getReservatorio(ref, capacidade) {
  return {
    litros: Number(dados[ref] || 0),
    percent: Number(dados[`${ref}_percent`] || 0),
    capacidade
  };
}

const rElevador = getReservatorio("Reservatorio_Elevador_current", 20000);
const rOsmose = getReservatorio("Reservatorio_Osmose_current", 200);
const rCME = getReservatorio("Reservatorio_CME_current", 1000);
const rAbrandada = getReservatorio("Reservatorio_Agua_Abrandada_current", 9000);
const rLavanderia = getReservatorio("Reservatorio_lavanderia_current", 10000);

const reservatorios = [
  {
    nome: "Reservatório Elevador",
    setor: "elevador",
    percent: rElevador.percent ?? 0,
    current_liters: rElevador.litros ?? 0,
    capacidade: 20000,
    manutencao: getManutencao().ativo
  },
  {
    nome: "Reservatório Osmose",
    setor: "osmose",
    percent: rOsmose.percent ?? 0,
    current_liters: rOsmose.litros ?? 0,
    capacidade: 200,
    manutencao: getManutencao().ativo
  },
  {
    nome: "Reservatório CME",
    setor: "cme",
    percent: rCME.percent ?? 0,
    current_liters: rCME.litros ?? 0,
    capacidade: 1000,
    manutencao: getManutencao().ativo
  },
  {
    nome: "Água Abrandada",
    setor: "abrandada",
    percent: rAbrandada.percent ?? 0,
    current_liters: rAbrandada.litros ?? 0,
    capacidade: 9000,
    manutencao: getManutencao().ativo
  },
  {
    nome: "Lavanderia",
    setor: "lavanderia",
    percent: rLavanderia.percent ?? 0,
    current_liters: rLavanderia.litros ?? 0,
    capacidade: 10000,
    manutencao: getManutencao().ativo
  }
];

  const pressoes = [
    { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: dados["Pressao_Saida_Osmose_current"] ?? null, manutencao: getManutencao().ativo },
    { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: dados["Pressao_Retorno_Osmose_current"] ?? null, manutencao: getManutencao().ativo },
    { nome: "Pressão Saída CME", setor: "saida_cme", pressao: dados["Pressao_Saida_CME_current"] ?? null, manutencao: getManutencao().ativo }
  ];

  const bombas = [
    { nome: "Bomba 01", estado_num: Number(dados["Bomba_01_binary"]) || 0, estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0, manutencao: getManutencao().ativo },
    { nome: "Bomba 02", estado_num: Number(dados["Bomba_02_binary"]) || 0, estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0, manutencao: getManutencao().ativo },
    { nome: "Bomba Osmose", estado_num: Number(dados["Bomba_Osmose_binary"]) || 0, estado: Number(dados["Bomba_Osmose_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_Osmose_counter"]) || 0, manutencao: getManutencao().ativo }
  ];

  const bombasLigadas = bombas
    .filter(b => b.estado === "ligada")
    .map(b => b.nome);

  // 🧠 consumo + previsão
  const consumo = safeReadJson(CONSUMO_FILE, {});
  const previsao = preverEsvaziamento(
    Number(dados["Reservatorio_Osmose_current"] || 0),
    consumo.media_por_minuto
  );

  return res.json({
    lastUpdate: dados.timestamp,
    reservatorios,
    pressoes,
    bombas,
    manutencao: getManutencao().ativo,
    bombasLigadas,

    // 🧠 previsão de esvaziamento
    previsao_esvaziamento: previsao,

    // 🚨 alerta de consumo anormal
    alerta_consumo: safeReadJson(ALERTA_FILE, {})
  });
});

// ------------------------- MANUTENÇÃO -------------------------
app.get("/manutencao", (req, res) => res.json(getManutencao()));
app.post("/manutencao", (req, res) => {
  const { ativo } = req.body;
  if (typeof ativo !== "boolean") return res.status(400).json({ erro: "Campo 'ativo' deve ser true/false" });
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

// Keep-alive opcional para evitar spin-down em providers free (tente evitar loops infinitos)
setInterval(() => {
  try {
    if (typeof fetch === "function") {
      const host = process.env.RENDER_INTERNAL_HOSTNAME || process.env.HOSTNAME || "localhost";
      const port = process.env.PORT || 3000;
      // não await para não bloquear
   if (host == "localhost") return;

fetch(`http://${host}:${port}/api/ping`).catch(() => {});

    }
  } catch (e) {}
}, 60 * 1000);
process.on("uncaughtException", err => {
  console.error("🔥 ERRO CRÍTICO:", err);
});

process.on("unhandledRejection", err => {
  console.error("🔥 PROMISE NÃO TRATADA:", err);
});

