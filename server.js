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

// ------------------------- CONSUMO / ALERTAS -------------------------
const CONSUMO_FILE = path.join(DATA_DIR, "consumo_osmose.json");
const ALERTA_FILE = path.join(DATA_DIR, "alerta_consumo.json");

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

  // ✅ NOVO — BOMBA DE OSMOSE
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
      const percentual = (leitura - sensor.leituraVazio) / (sensor.leituraCheio - sensor.leituraVazio);
      let litros = percentual * sensor.capacidade;
      litros = Math.max(0, Math.min(sensor.capacidade, litros));
      novo[ref] = Math.round(litros);
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
function registrarHistorico(dadosConvertidos) {
  const hoje = new Date().toISOString().split("T")[0];
  const historico = safeReadJson(HIST_FILE, {});
  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dadosConvertidos).forEach(([ref, valor]) => {
    if (ref.endsWith("_timestamp") || ref === "timestamp") return;
    const sensor = SENSORES[ref];
    if (!sensor || !sensor.capacidade) return;

    if (!historico[hoje][ref]) historico[hoje][ref] = { min: valor, max: valor, pontos: [] };
    const reg = historico[hoje][ref];
    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    const variacao = Math.max(1, sensor.capacidade * 0.02);
    const ultimo = reg.pontos.at(-1);
    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
      reg.pontos.push({ hora: new Date().toLocaleTimeString("pt-BR"), valor });
    }
  });

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

    if (!ts || agora - ts > DATA_TIMEOUT_MS) {
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

function calcularConsumoOsmose(nivelAtual) {
  const consumo = safeReadJson(CONSUMO_FILE, {});
  let consumido = 0;

  if (consumo.ultimoNivel > 0 && nivelAtual < consumo.ultimoNivel) {
    consumido = consumo.ultimoNivel - nivelAtual;
    consumo.totalConsumido += consumido;
  }

  const agora = Date.now();
  if (consumo.timestamp) {
    const minutos = (agora - new Date(consumo.timestamp).getTime()) / 60000;
    if (minutos > 0) {
      consumo.media_por_minuto =
        Number(((consumido / minutos) || consumo.media_por_minuto).toFixed(3));
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
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(chalk.green(`Servidor HAG otimizado ativo na porta ${process.env.PORT || 3000}`));
});

// WebSocket server ligado ao mesmo HTTP server
const wss = new WebSocketServer({ server });
function wsBroadcast(obj) {
  const msg = JSON.stringify(obj);
  let count = 0;
  wss.clients.forEach(c => {
    if (c.readyState === c.OPEN) {
      try { c.send(msg); count++; } catch (e) { /* ignore */ }
    }
  });
  if (count) console.log(chalk.cyan(`WS broadcast → ${count} clients`));
}
wss.on("connection", ws => {
  console.log(chalk.cyan("WS client connected"));
  // enviar estado atual assim que conectar
  const dados = safeReadJson(DATA_FILE, {});
  try { ws.send(JSON.stringify({ type: "init", dados })); } catch (e) {}
});

// ------------------------- ROTEAMENTO PRINCIPAL -------------------------
// Aceita POST/PUT em /atualizar e /iot (compatibilidade com Gateway)
app.all(["/atualizar", "/atualizar/*", "/iot", "/iot/*"], async (req, res) => {
  try {
    let rawBody = req.body;
    if (!rawBody || (typeof rawBody === "string" && rawBody.trim() === "")) {
      rawBody = req._rawBody || req.body;
    }

    const parsed = parseBodyGuess(rawBody);
    if (!parsed) {
      console.warn(
        chalk.yellow("Payload não entendível:"),
        typeof rawBody === "string" ? (rawBody || "").slice(0, 500) : rawBody
      );
      return res.status(400).json({ erro: "Payload inválido ou vazio" });
    }

    const arr = normalizePacket(parsed);
    if (!arr.length) {
      return res.status(400).json({ erro: "Nenhum dado encontrado no payload" });
    }

    // converter e mesclar
    const novo = convertAndMerge(arr);
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
    const consumoAnterior = safeReadJson(CONSUMO_FILE, {});
const consumoAtualMin =
  consumoAnterior.ultimoNivel > nivelAtualOsmose
    ? consumoAnterior.ultimoNivel - nivelAtualOsmose
    : 0;

// agora sim atualiza consumo
const consumo = calcularConsumoOsmose(nivelAtualOsmose);
const mediaMin = consumo.media_por_minuto || 0;


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

    // salva alerta (uma única vez)
    safeWriteJson(ALERTA_FILE, alertas);

    // ============================================================
    // 📊 HISTÓRICO + WEBSOCKET
    // ============================================================
    try {
      registrarHistorico(novo);
    } catch (e) {
      console.error("Erro historico:", e);
    }

    wsBroadcast({ type: "update", dados: novo, recebido: arr.length });

    console.log(
      chalk.green(
        `➡️ Pacote processado: itens=${arr.length} | timestamp=${novo.timestamp}`
      )
    );

    return res.json({ status: "ok", dados: novo, recebido: arr.length });
  } catch (err) {
    console.error("Erro processar /atualizar:", err);
    return res.status(500).json({
      erro: err?.message || "erro interno"
    });
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
        const ts = new Date(`${data} ${p.hora}`).getTime();
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
      const ts = new Date(`${data} ${p.hora}`).getTime();
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

  const reservatorios = [
    { nome: "Reservatório Elevador", setor: "elevador", percent: Math.round((Number(dados["Reservatorio_Elevador_current"] || 0) / 20000) * 100), current_liters: Number(dados["Reservatorio_Elevador_current"] || 0), capacidade: 20000, manutencao: getManutencao().ativo },
    { nome: "Reservatório Osmose", setor: "osmose", percent: Math.round((Number(dados["Reservatorio_Osmose_current"] || 0) / 200) * 100), current_liters: Number(dados["Reservatorio_Osmose_current"] || 0), capacidade: 200, manutencao: getManutencao().ativo },
    { nome: "Reservatório CME", setor: "cme", percent: Math.round((Number(dados["Reservatorio_CME_current"] || 0) / 1000) * 100), current_liters: Number(dados["Reservatorio_CME_current"] || 0), capacidade: 1000, manutencao: getManutencao().ativo },
    { nome: "Água Abrandada", setor: "abrandada", percent: Math.round((Number(dados["Reservatorio_Agua_Abrandada_current"] || 0) / 9000) * 100), current_liters: Number(dados["Reservatorio_Agua_Abrandada_current"] || 0), capacidade: 9000, manutencao: getManutencao().ativo },
    { nome: "Lavanderia", setor: "lavanderia", percent: Math.round((Number(dados["Reservatorio_lavanderia_current"] || 0) / 10000) * 100), current_liters: Number(dados["Reservatorio_lavanderia_current"] || 0), capacidade: 10000, manutencao: getManutencao().ativo }
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
      fetch(`http://${host}:${port}/api/ping`).catch(() => {});
    }
  } catch (e) {}
}, 60 * 1000);

