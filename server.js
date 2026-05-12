/**
 * =========================================================
 * Sistema de Monitoramento de Reservatórios – HAG
 * =========================================================
 *
 * Autor: Edisley Afonso Costa
 * Projeto: Hospital Arnaldo Gavazza
 * Versão: 1.0.2
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

// ------------------------- MIDDLEWARES -------------------------
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Basic Auth via ENV
const AUTH_USER = process.env.AUTH_USER || "118582";
const AUTH_PASS = process.env.AUTH_PASS || "118582";
const AUTH_HEADER = 'Basic ' + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');

app.use(["/api/dashboard", "/historico", "/dados", "/dashboard", "/historico-view", "/login", "/manutencao"], (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth!== AUTH_HEADER) {
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

// ================= WEBSOCKET COM HEARTBEAT =================
const wss = new WebSocketServer({ server });
const clients = new Set();
const lastPerType = {};

function heartbeat() {
  this.isAlive = true;
}

wss.on("connection", (ws) => {
  console.log("🔌 Cliente WebSocket conectado");
  ws.isAlive = true;
  ws.on("pong", heartbeat);
  clients.add(ws);

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

// Heartbeat a cada 30s - mata conexão zumbi
const wsInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(wsInterval));

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
const MEMORIA_FILE = path.join(DATA_DIR, "memoria_nivel.json"); // Persistência da memória

const DATA_TIMEOUT_MS = 2 * 60 * 1000;
const ALERTA_FATOR = 2.5;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANUT_FILE)) fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

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

// ================= SENSORES / CALIBRAÇÃO =================
const SENSORES = safeReadJson(
  path.join(DATA_DIR, "sensores.json"),
  {
    "Reservatorio_Elevador_current": { leituraVazio: 0.005170, leituraCheio: 0.010247, capacidade: 20000, altura: 1.45 },
    "Reservatorio_Osmose_current": { leituraVazio: 0.005050, leituraCheio: 0.007054, capacidade: 200, altura: 1.0 },
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

// ================= MEMÓRIA PERSISTENTE =================
let MEMORIA_NIVEL = safeReadJson(MEMORIA_FILE, {});
function salvarMemoria() {
  safeWriteJson(MEMORIA_FILE, MEMORIA_NIVEL);
}

// ================= CALIBRAÇÃO ESTÁVEL =================
function calcularNivel(ref, leitura) {
  const sensor = SENSORES[ref];
  if (!sensor ||!sensor.capacidade) return { percentual: 0, litros: 0, altura: 0 };

  const span = (sensor.leituraCheio - sensor.leituraVazio) || 1;
  let percentualBruto = (leitura - sensor.leituraVazio) / span;
  if (!isFinite(percentualBruto)) percentualBruto = 0;
  percentualBruto = Math.max(0, Math.min(1, percentualBruto));

  const key = ref;
  if (MEMORIA_NIVEL[key] === undefined) MEMORIA_NIVEL[key] = percentualBruto;

  const anterior = MEMORIA_NIVEL[key];
  let filtrado = (anterior * 0.85) + (percentualBruto * 0.15);
  const delta = Math.abs(filtrado - anterior);
  const LIMIAR = 0.01;

  if (delta < LIMIAR) filtrado = anterior;
  filtrado = Math.max(0, Math.min(1, filtrado));
  MEMORIA_NIVEL[key] = filtrado;

  const litros = Math.round(filtrado * sensor.capacidade);
  const alturaCm = Math.round(filtrado * sensor.altura * 100);

  return { percentual: filtrado, litros, altura: alturaCm };
}

// ================= CONSUMO HOJE =================
function calcularConsumoHoje(hist) {
  const calc = (ref) => {
    const sensor = SENSORES[ref];
    const reg = hist[ref];
    if (!sensor ||!reg ||!reg.pontos || reg.pontos.length < 2) return 0;

    let totalDescidaLitros = 0;
    const pontos = reg.pontos;

    for (let i = 1; i < pontos.length; i++) {
      const litrosAnterior = calcularNivel(ref, pontos[i - 1].valor).litros;
      const litrosAtual = calcularNivel(ref, pontos[i].valor).litros;
      if (litrosAtual < litrosAnterior) {
        totalDescidaLitros += (litrosAnterior - litrosAtual);
      }
    }
    return Math.round(totalDescidaLitros);
  };

  return {
    elevador_hoje: calc("Reservatorio_Elevador_current"),
    lavanderia_hoje: calc("Reservatorio_lavanderia_current"),
    osmose_hoje: calc("Reservatorio_Osmose_current")
  };
}

// =========================================================
// MONTAGEM DO DASHBOARD
// =========================================================
function buildDashboard(dados) {
  const hist = safeReadJson(HIST_FILE, {});
  const kpis = calcularConsumoHoje(hist);

  const reservatorios = Object.keys(MAPA_RESERVATORIOS).map(setor => {
    const ref = MAPA_RESERVATORIOS[setor];
    const leitura = Number(dados[ref] || 0);
    const { percentual, litros, altura } = calcularNivel(ref, leitura);
    return {
      nome: setor.charAt(0).toUpperCase() + setor.slice(1),
      setor,
      percent: Math.round(percentual * 100),
      current_liters: litros,
      altura_cm: altura,
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

  const bombasLigadas = bombas.filter(b => b.estado === "ligada").map(b => b.nome);

  return {
    lastUpdate: dados.timestamp || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    reservatorios,
    pressoes,
    bombas,
    bombasLigadas,
    kpis,
    manutencao: getManutencao().ativo,
    alerta_consumo: safeReadJson(ALERTA_FILE, {})
  };
}

// ================= PREVISÃO DE ESVAZIAMENTO =================
function preverEsvaziamento(nivelAtual, consumoPorMinuto) {
  if (!consumoPorMinuto || consumoPorMinuto <= 0) return null;
  const minutos = nivelAtual / consumoPorMinuto;
  const data = new Date(Date.now() + minutos * 60000);
  return { minutos_restantes: Math.round(minutos), previsao: data.toISOString() };
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

function parseTimestamp(t, fallback) {
  if (!t) return fallback;
  let ms = t > 1e14? Math.floor(t / 1000) : t > 1e10? t : t * 1000;
  const date = new Date(ms);
  return isNaN(date.getTime())? fallback : date.toISOString();
}

function convertAndMerge(dataArray) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = {...ultimo };
  const timestampNow = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    let rawVal = item.value;
    const tsAtual = new Date(parseTimestamp(item.time, timestampNow)).getTime();
    const tsAnterior = novo[`${ref}_timestamp`]? new Date(novo[`${ref}_timestamp`]).getTime() : 0;

    if (tsAnterior && tsAtual < tsAnterior) continue;

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
      const valorAtual = Number(rawVal) === 1? 1 : 0;
      const anterior = novo[ref]!== undefined? novo[ref] : valorAtual;
      const tsAnteriorBomba = novo[`${ref}_timestamp`]? new Date(novo[`${ref}_timestamp`]).getTime() : 0;
      const agora = Date.now();
      const TEMPO_LIGAR = 3000, TEMPO_DESLIGAR = 5000;
      if (valorAtual!== anterior) {
        const tempoNecessario = valorAtual === 1? TEMPO_LIGAR : TEMPO_DESLIGAR;
        if (agora - tsAnteriorBomba > tempoNecessario) novo[ref] = valorAtual;
      } else {
        novo[ref] = valorAtual;
      }
    } else if (sensor.tipo === "ciclo") {
      novo[ref] = Math.max(0, Math.round(Number(rawVal) || 0));
    } else if (sensor.capacidade) {
      const valorAtual = Number(rawVal) || 0;
      const anterior = Number(novo[ref]) || valorAtual;
      const suavizado = (anterior * 0.8) + (valorAtual * 0.2);
      novo[ref] = Number(suavizado.toFixed(6));
    } else {
      novo[ref] = rawVal;
    }

    novo[`${ref}_timestamp`] = parseTimestamp(item.time, timestampNow);
  }

  novo.timestamp = timestampNow;
  novo.version = Date.now();
  safeWriteJson(DATA_FILE, novo);
  salvarMemoria();
  return novo;
}

function registrarHistorico(dadosConvertidos) {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split('/').reverse().join('-');
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

    // Variação em corrente, não litros
    const span = sensor.leituraCheio - sensor.leituraVazio;
    const variacao = span * 0.01; // 1% do span
    const ultimo = reg.pontos.at(-1);
    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
      reg.pontos.push({
        timestamp: Date.now(),
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
    const ts = dados[tsKey]? new Date(dados[tsKey]).getTime() : null;
    const stale =!ts || (agora - ts > DATA_TIMEOUT_MS);
    dados[`${ref}_stale`] = stale;
  });
  return dados;
}

// =========================================================
// CÁLCULO DE CONSUMO E ALERTAS
// =========================================================
function calcularConsumoOsmose(nivelAtualCorrente) {
  const anterior = safeReadJson(CONSUMO_FILE, { ultimoNivel: nivelAtualCorrente, media_por_minuto: 0, historico: [] });
  const agora = Date.now();

  const nivelAnteriorLitros = calcularNivel("Reservatorio_Osmose_current", anterior.ultimoNivel).litros;
  const nivelAtualLitros = calcularNivel("Reservatorio_Osmose_current", nivelAtualCorrente).litros;
  const consumoMin = nivelAnteriorLitros > nivelAtualLitros? nivelAnteriorLitros - nivelAtualLitros : 0;

  const historico = anterior.historico || [];
  historico.push({ t: agora, v: consumoMin });
  if (historico.length > 60) historico.shift();

  const media = historico.reduce((s, i) => s + i.v, 0) / (historico.length || 1);
  const novo = { ultimoNivel: nivelAtualCorrente, media_por_minuto: Number(media.toFixed(4)), historico };
  safeWriteJson(CONSUMO_FILE, novo);
  return novo;
}

function detectarConsumoAnormal(consumoAtual, media) {
  if (!media || media <= 0) return false;
  return consumoAtual > media * ALERTA_FATOR;
}

// ------------------------- ROTEAMENTO PRINCIPAL ITG 200 -------------------------
app.use(["/atualizar/api/v1_2/json/itg/data", "/atualizar/api/v1_2/json/itg/connection_status"], async (req, res) => {
  try {
    console.log("🔥 CHEGOU DADO DO GATEWAY ITG");

    let parsed = req.body;
    if (!parsed || Object.keys(parsed).length === 0) {
      console.warn("⚠️ Payload vazio");
      return res.status(400).json({ erro: "Payload inválido ou vazio" });
    }

    if (parsed.seq && parsed.interface!== undefined &&!parsed.data) {
      console.log("📡 Status de conexão ITG - ignorando");
      return res.status(200).json({ ok: true });
    }

    const arr = normalizePacket(parsed);
    if (!arr.length) return res.status(400).json({ erro: "Nenhum dado encontrado no payload" });

    const novo = convertAndMerge(arr);
    aplicarFailSafeBombas(novo);

    // Auto desligamento osmose - CORRIGIDO
    const correnteOsmose = Number(novo["Reservatorio_Osmose_current"] || 0);
    const calcOsmose = calcularNivel("Reservatorio_Osmose_current", correnteOsmose);
    const percentualOsmose = calcOsmose.percentual * 100;

    if (percentualOsmose >= 99) {
      novo["Bomba_Osmose_binary"] = 0;
      novo["Bomba_Osmose_binary_timestamp"] = new Date().toISOString();
    }

    // Consumo osmose - CORRIGIDO
    const consumoData = calcularConsumoOsmose(correnteOsmose);
    const consumoAtualMin = consumoData.historico.at(-1)?.v || 0;
    const mediaMin = consumoData.media_por_minuto;

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
    wsBroadcast({ type: "update", dados: buildDashboard(novo) });
    return res.json({ ok: true, recebidos: arr.length, timestamp: novo.timestamp });

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

    let parsed = req.body;
    if (Object.keys(parsed).length === 0) parsed = req.query;
    if (!parsed || Object.keys(parsed).length === 0) {
      console.warn("⚠️ Payload vazio");
      return res.status(400).json({ erro: "Payload inválido ou vazio" });
    }

    const arr = normalizePacket(parsed);
    if (!arr.length) return res.status(400).json({ erro: "Nenhum dado encontrado no payload" });

    const novo = convertAndMerge(arr);
    aplicarFailSafeBombas(novo);

    const correnteOsmose = Number(novo["Reservatorio_Osmose_current"] || 0);
    const calcOsmose = calcularNivel("Reservatorio_Osmose_current", correnteOsmose);
    const percentualOsmose = calcOsmose.percentual * 100;

    if (percentualOsmose >= 99) {
      novo["Bomba_Osmose_binary"] = 0;
      novo["Bomba_Osmose_binary_timestamp"] = new Date().toISOString();
    }

    const consumoData = calcularConsumoOsmose(correnteOsmose);
    const consumoAtualMin = consumoData.historico.at(-1)?.v || 0;
    const mediaMin = consumoData.media_por_minuto;

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
    wsBroadcast({ type: "update", dados: buildDashboard(novo) });
    return res.json({ ok: true, recebidos: arr.length, timestamp: novo.timestamp });

  } catch (err) {
    console.error("Erro processar /atualizar:", err);
    return res.status(500).json({ erro: err?.message || "erro interno" });
  }
});

// ------------------------- ENDPOINTS DE LEITURA -------------------------
app.get("/dados", (req, res) => res.json(safeReadJson(DATA_FILE, {})));

app.get("/historico", (req, res) => {
  const historico = safeReadJson(HIST_FILE, {});
  const saida = {};
  for (const [data, sensores] of Object.entries(historico)) {
    for (const [ref, dados] of Object.entries(sensores || {})) {
      const setor = Object.keys(MAPA_RESERVATORIOS).find(key => MAPA_RESERVATORIOS[key] === ref);
      if (!setor ||!dados.pontos) continue;
      if (!saida[setor]) saida[setor] = [];
      for (const p of dados.pontos) {
        const ts = new Date(`${data}T${p.hora}-03:00`).getTime();
        if (!isNaN(ts)) {
          saida[setor].push({ x: ts, y: Math.round(calcularNivel(ref, p.valor).percentual * 100) });
        }
      }
    }
  }
  Object.keys(saida).forEach(setor => saida[setor].sort((a, b) => a.x - b.x));
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
    if (!reg ||!reg.pontos || reg.pontos.length < 2) return { dia, consumo: 0 };

    let total = 0;
    for (let i = 1; i < reg.pontos.length; i++) {
      const litrosAnterior = calcularNivel(ref, reg.pontos[i - 1].valor).litros;
      const litrosAtual = calcularNivel(ref, reg.pontos[i].valor).litros;
      if (litrosAtual < litrosAnterior) total += litrosAnterior - litrosAtual;
    }
    return { dia, consumo: Number(total.toFixed(2)) };
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
      if (!reg ||!reg.pontos || reg.pontos.length < 2) return 0;
      let total = 0;
      for (let i = 1; i < reg.pontos.length; i++) {
        const litrosAnterior = calcularNivel(ref, reg.pontos[i - 1].valor).litros;
        const litrosAtual = calcularNivel(ref, reg.pontos[i].valor).litros;
        if (litrosAtual < litrosAnterior) total += litrosAnterior - litrosAtual;
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

// ------------------------- DASHBOARD -------------------------
app.get("/api/dashboard", (req, res) => {
  res.setHeader("Cache-Control", "no-store, must-revalidate, max-age=0, private");
  const dados = safeReadJson(DATA_FILE, {});
  if (!dados || Object.keys(dados).length === 0) {
    return res.json({ lastUpdate: "-", reservatorios: [], manutencao: getManutencao().ativo });
  }
  res.json(buildDashboard(dados));
});

// ------------------------- MANUTENÇÃO -------------------------
app.get("/manutencao", (req, res) => res.json(getManutencao()));
app.post("/manutencao", (req, res) => {
  const { ativo } = req.body;
  if (typeof ativo!== "boolean") return res.status(400).json({ erro: "Campo 'ativo' deve ser true/false" });
  setManutencao(ativo);
  res.json({ status: "ok", ativo });
});

// ------------------------- DEBUG -------------------------
app.get("/api/debug-calculo", (req, res) => {
    const dados = safeReadJson(DATA_FILE, {});
    const debug = {};
    Object.keys(MAPA_RESERVATORIOS).forEach(setor => {
        const ref = MAPA_RESERVATORIOS[setor];
        const leitura = Number(dados[ref] || 0);
        debug[setor] = { ref, leitura_bruta: leitura, resultado: calcularNivel(ref, leitura) };
    });
    res.json(debug);
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
  console.log(chalk.green(`🚀 Servidor HAG v1.0.2 rodando na porta ${PORT}`));
});
