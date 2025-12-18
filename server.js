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

const DATA_TIMEOUT_MS = 2 * 60 * 1000;
const ALERTA_FATOR = 2.5;

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

  "Bomba_Osmose_binary": { tipo: "bomba" },
  "Ciclos_Bomba_Osmose_counter": { tipo: "ciclo" }
};

// ------------------------- HELPERS IO -------------------------
function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8") || "{}");
  } catch {
    return fallback;
  }
}
function safeWriteJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getManutencao() {
  try { return JSON.parse(fs.readFileSync(MANUT_FILE, "utf8")); } catch { return { ativo: false }; }
}
function setManutencao(ativo) {
  fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo }, null, 2));
}

// ------------------------- NORMALIZAÇÃO -------------------------
const TOL_ANALOGICA = 0.00005;

// converte valores segundo SENSORES e mescla com ultimo estado (patch)
function convertAndMerge(dataArray) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = { ...ultimo };
  const timestampNow = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    let rawVal = item.value;

    if (typeof rawVal === "string" && rawVal.trim() !== "" && !isNaN(Number(rawVal))) {
      rawVal = Number(rawVal);
    }

    const sensor = SENSORES[ref];

    if (!sensor) {
      novo[ref] = rawVal;
    } else if (sensor.tipo === "pressao") {
      let convertido = ((Number(rawVal) - 0.004) / 0.016) * 20;
      novo[ref] = Math.max(0, Math.min(20, convertido)).toFixed(2);
    } else if (sensor.tipo === "bomba") {
      novo[ref] = Number(rawVal) === 1 ? 1 : 0;
    } else if (sensor.tipo === "ciclo") {
      novo[ref] = Math.max(0, Math.round(Number(rawVal) || 0));
    } else if (sensor.capacidade) {
      const leitura = Math.min(
        sensor.leituraCheio,
        Math.max(sensor.leituraVazio, Number(rawVal) || 0)
      );
      const pct = (leitura - sensor.leituraVazio) / (sensor.leituraCheio - sensor.leituraVazio);
      novo[ref] = Math.round(Math.max(0, Math.min(sensor.capacidade, pct * sensor.capacidade)));
    }

    novo[`${ref}_timestamp`] = item.time
      ? new Date(item.time).toISOString()
      : timestampNow;
  }

  // 🔧 CORREÇÃO CRÍTICA
  novo.timestamp = timestampNow;
  return novo;
}

// ------------------------- HISTÓRICO (FORA DA FUNÇÃO) -------------------------
function registrarHistorico(dadosConvertidos) {
  const hoje = new Date().toISOString().split("T")[0];
  const historico = safeReadJson(HIST_FILE, {});
  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dadosConvertidos).forEach(([ref, valor]) => {
    if (ref.endsWith("_timestamp") || ref === "timestamp") return;
    const sensor = SENSORES[ref];
    if (!sensor || !sensor.capacidade) return;

    if (!historico[hoje][ref]) {
      historico[hoje][ref] = { min: valor, max: valor, pontos: [] };
    }

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
