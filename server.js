/**
    * =========================================================
    * Sistema de Monitoramento de Reservatórios – HAG
    * =========================================================
    * Autor: Edisley Afonso Costa
    * Projeto: Hospital Arnaldo Gavazza
    * Versão: 1.0.7
    * Atualização: 2026-05-06
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

// ------------------------- MIDDLEWARES GLOBAIS -------------------------
app.use(cors());
app.use(compression());

// Captura body bruto para debug do gateway
app.use("/atualizar/api/v1_2/json/itg/data", express.raw({type: "*/*", limit: "10mb"}));

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
app.use("/atualizar/api/v1_2/json/itg/data", (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || 'desconhecido';
  const rawBody = req.body?.toString("utf8") || "";

  // Ignora healthcheck do Python pra não poluir log
  if (ua.includes('Python')) {
    console.log(`[GATEWAY TRACE] Healthcheck Python ignorado - IP: ${ip}`);
    return res.status(200).json({ ok: true, msg: "healthcheck" });
  }

  console.log(`[GATEWAY TRACE] IP: ${ip} | UA: ${ua} | Body: ${rawBody.slice(0, 200)}`);
  next();
});

// ------------------------- BASIC AUTH - SÓ PARA DASHBOARD -------------------------
app.use(["/api/dashboard", "/historico", "/dados", "/dashboard"], (req, res, next) => {
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

const DIAS_HISTORICO = 7;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ================= SENSORES / CALIBRAÇÃO =================
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

// ================= CALIBRAÇÃO NÍVEL =================
const MEMORIA_NIVEL = {};

function calcularNivel(ref, leitura) {
  const sensor = SENSORES[ref];
  if (!sensor?.capacidade) return { percentual: 0, litros: 0, altura: 0 };

  const span = (sensor.leituraCheio - sensor.leituraVazio) || 1;
  let p = Math.max(0, Math.min(1, (leitura - sensor.leituraVazio) / span));
  if (!isFinite(p)) p = 0;

  const key = ref;
  if (MEMORIA_NIVEL[key] === undefined) MEMORIA_NIVEL[key] = p;
  let filtrado = (MEMORIA_NIVEL[key] * 0.85) + (p * 0.15);
  if (Math.abs(filtrado - MEMORIA_NIVEL[key]) < 0.01) filtrado = MEMORIA_NIVEL[key];
  MEMORIA_NIVEL[key] = filtrado;

  return {
    percentual: filtrado,
    litros: Math.round(filtrado * sensor.capacidade),
    altura: Math.round(filtrado * sensor.altura * 100)
  };
}

// Converte timestamp do gateway para ISO - timestamp vem em nanossegundos
function parseTimestamp(ts, fallback) {
  if (!ts) return fallback;
  let ms = ts;
  if (ts > 1e14) ms = Math.floor(ts / 1000);
  else if (ts < 1e10) ms = ts * 1000;
  const date = new Date(ms);
  return isNaN(date.getTime())? fallback : date.toISOString();
}

// Normaliza payload do ITG200
function normalizePacket(raw) {
  if (!raw?.data ||!Array.isArray(raw.data)) return [];
  return raw.data.map(i => ({
    ref: i.ref,
    value: typeof i.value === "string" &&!isNaN(Number(i.value))? Number(i.value) : i.value,
    time: i.time || Date.now()
  }));
}

// Mescla dados e salva em readings.json
function convertAndMerge(dataArray) {
  const novo = safeReadJson(DATA_FILE, {});
  const ts = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    const sensor = SENSORES[ref];
    if (!sensor) continue;

    const tsAtual = new Date(parseTimestamp(item.time, ts)).getTime();
    const tsAnterior = novo[`${ref}_timestamp`]? new Date(novo[`${ref}_timestamp`]).getTime() : 0;
    if (tsAnterior && tsAtual < tsAnterior - 120000) continue;

    let valor = item.value;

    if (sensor.tipo === "pressao") {
      let c = ((Number(valor) - 0.004) / 0.016) * 20;
      valor = Number(Math.max(0, Math.min(20, c)).toFixed(2));
    } else if (sensor.tipo === "bomba") {
      valor = Number(valor) === 1? 1 : 0;
    } else if (sensor.tipo === "ciclo") {
      valor = Math.max(0, Math.round(Number(valor) || 0));
    } else if (sensor.capacidade) {
      const atual = Number(valor) || 0;
      const ant = Number(novo[ref]) || atual;
      valor = Number(((ant * 0.8) + (atual * 0.2)).toFixed(6));
    }

    novo[ref] = valor;
    novo[`${ref}_timestamp`] = parseTimestamp(item.time, ts);
  }

  novo.timestamp = ts;
  novo.version = Date.now();
  safeWriteJson(DATA_FILE, novo);
  return novo;
}

// Registra histórico com retenção de 7 dias
function registrarHistorico(dados) {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split('/').reverse().join('-');
  const hist = safeReadJson(HIST_FILE, {});

  Object.entries(dados).forEach(([k, v]) => {
    if (k.endsWith("_current") && SENSORES[k]) {
      if (!hist[k]) hist[k] = { pontos: [] };

      const ultimo = hist[k].pontos.at(-1);
      const variacaoMinima = SENSORES[k].capacidade? SENSORES[k].capacidade * 0.01 : 0.01;
      if (!ultimo || Math.abs(v - ultimo.valor) > variacaoMinima || Date.now() - ultimo.timestamp > 300000) {
        hist[k].pontos.push({
          hora: new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          valor: v,
          timestamp: Date.now()
        });
      }
    }
  });

  const datas = Object.keys(hist).sort().reverse();
  if (datas.length > DIAS_HISTORICO) {
    const datasParaRemover = datas.slice(DIAS_HISTORICO);
    datasParaRemover.forEach(d => delete hist[d]);
  }

  safeWriteJson(HIST_FILE, hist);
}

// Calcula consumo do dia
function calcularConsumoHoje(hist, hoje) {
  const consumo = { elevador_hoje: 0, lavanderia_hoje: 0, osmose_hoje: 0 };

  const calc = (ref) => {
    const pontos = hist[ref]?.pontos || [];
    if (pontos.length < 2) return 0;
    const primeiro = pontos[0].valor;
    const ultimo = pontos.at(-1).valor;
    return Math.max(0, primeiro - ultimo) * SENSORES[ref].capacidade;
  };

  consumo.elevador_hoje = calc("Reservatorio_Elevador_current");
  consumo.lavanderia_hoje = calc("Reservatorio_lavanderia_current");
  consumo.osmose_hoje = calc("Reservatorio_Osmose_current");
  return consumo;
}

// Monta dados para o dashboard
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

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split('/').reverse().join('-');
  const hist = safeReadJson(HIST_FILE, {});
  const kpis = calcularConsumoHoje(hist, hoje);

  return {
    lastUpdate: dados.timestamp || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    reservatorios,
    pressoes,
    bombas,
    kpis
  };
}

// ================= ROTA PRINCIPAL GATEWAY ITG 200 =================
app.post(["/atualizar/api/v1_2/json/itg/data", "/atualizar", "/iot"], async (req, res) => {
  try {
    console.log("🔥 DADO RECEBIDO DO GATEWAY");

    // Parse do body bruto capturado pelo express.raw
    const rawBody = req.body?.toString("utf8") || "{}";
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch (e) {
      console.error("Body inválido:", rawBody.slice(0, 200));
      return res.status(400).json({ erro: "JSON inválido" });
    }

    // Ack de conexão do ITG200
    if (parsed.seq && (!parsed.data || parsed.signal!== undefined)) {
      return res.status(200).json({ ok: true, msg: "connection_ack" });
    }

    const arr = normalizePacket(parsed);
    if (!arr.length) return res.status(200).json({ ok: true, msg: "empty_payload" });

    const novo = convertAndMerge(arr);
    registrarHistorico(novo);
    wsBroadcast({ type: "update", dados: buildDashboard(novo) });

    console.log(`[GATEWAY] ${arr.length} sensores salvos - ${novo.timestamp}`);
    res.json({ ok: true, recebidos: arr.length, timestamp: novo.timestamp });
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
  const hist = safeReadJson(HIST_FILE, {});
  const datas = Object.keys(hist).sort().reverse().slice(0, DIAS_HISTORICO);

  const saida = {};
  datas.forEach(data => {
    saida[data] = {};
    Object.entries(hist[data] || {}).forEach(([ref, dados]) => {
      const setor = Object.keys(MAPA_RESERVATORIOS).find(k => MAPA_RESERVATORIOS[k] === ref);
      if (setor && dados.pontos) {
        saida[data][setor] = dados.pontos.map(p => ({
          x: p.timestamp,
          y: Math.round(calcularNivel(ref, p.valor).percentual * 100)
        }));
      }
    });
  });

  res.json(saida);
});

app.get("/historico/24h/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();
  const ref = MAPA_RESERVATORIOS[nome];
  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });

  const hist = safeReadJson(HIST_FILE, {});
  const agora = Date.now();
  const saida = [];

  Object.entries(hist).forEach(([data, sensores]) => {
    const pontos = sensores?.[ref]?.pontos || [];
    pontos.forEach(p => {
      if (agora - p.timestamp <= 24 * 60 * 60 * 1000) {
        saida.push({ reservatorio: nome, timestamp: p.timestamp, valor: Math.round(calcularNivel(ref, p.valor).percentual * 100) });
      }
    });
  });

  saida.sort((a, b) => a.timestamp - b.timestamp);
  res.json(saida);
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
