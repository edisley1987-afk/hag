/**
 * =========================================================
 * Sistema de Monitoramento de Reservatórios – HAG
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

// MIDDLEWARES
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Basic Auth
app.use(["/api/dashboard", "/historico", "/dados", "/dashboard", "/historico-view", "/login", "/manutencao"], (req, res, next) => {
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

// WEBSOCKET
const wss = new WebSocketServer({ server });
const clients = new Set();
const lastPerType = {}; 

wss.on("connection", (ws) => {
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

// ARQUIVOS E CONSTANTES
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

// HELPERS IO - Robustez aprimorada para evitar corrupção
function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, "utf8");
    if (!content || content.trim() === "") return fallback;
    return JSON.parse(content);
  } catch (e) {
    console.error("Erro ao ler JSON, reiniciando estado:", filePath);
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erro ao escrever JSON", e);
  }
}

function getManutencao() { return safeReadJson(MANUT_FILE, { ativo: false }); }
function setManutencao(ativo) { fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo }, null, 2)); }

// SENSORES
const SENSORES = safeReadJson(path.join(DATA_DIR, "sensores.json"), {
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
});

const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

// CALIBRAÇÃO E FILTRO DE SUAVIZAÇÃO (AJUSTADO PARA MAIOR AGILIDADE)
const MEMORIA_NIVEL = {};

function calcularNivel(ref, leitura) {
  const sensor = SENSORES[ref];
  if (!sensor || !sensor.capacidade) return { percentual: 0, litros: 0, altura: 0 };

  const span = (sensor.leituraCheio - sensor.leituraVazio) || 1;
  let percentualBruto = (leitura - sensor.leituraVazio) / span;
  if (!isFinite(percentualBruto)) percentualBruto = 0;
  percentualBruto = Math.max(0, Math.min(1, percentualBruto));

  if (MEMORIA_NIVEL[ref] === undefined) MEMORIA_NIVEL[ref] = percentualBruto;

  // AJUSTE: Peso de 0.4 para memória anterior e 0.6 para novo valor (mais responsivo)
  let filtrado = (MEMORIA_NIVEL[ref] * 0.4) + (percentualBruto * 0.6);
  
  // Limiar de 0.5% para evitar trepidação irrelevante
  if (Math.abs(filtrado - MEMORIA_NIVEL[ref]) < 0.005) {
      filtrado = MEMORIA_NIVEL[ref];
  }

  filtrado = Math.max(0, Math.min(1, filtrado));
  MEMORIA_NIVEL[ref] = filtrado;

  return {
    percentual: filtrado,
    litros: Math.round(filtrado * sensor.capacidade),
    altura: Math.round(filtrado * sensor.altura * 100)
  };
}

// ... [MANTER RESTANTE DAS FUNÇÕES AUXILIARES IGUAIS] ...
// (Nota: mantive as funções parseTimestamp, convertAndMerge, etc. omitidas aqui por brevidade, 
// mas você deve manter as originais no arquivo.)

function convertAndMerge(dataArray) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = { ...ultimo };
  const timestampNow = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    let rawVal = item.value;
    const tsAtual = new Date(parseTimestamp(item.time, timestampNow)).getTime();
    const tsAnterior = novo[`${ref}_timestamp`] ? new Date(novo[`${ref}_timestamp`]).getTime() : 0;

    if (tsAnterior && tsAtual < tsAnterior) continue;
    if (typeof rawVal === "string" && rawVal.trim() !== "" && !isNaN(Number(rawVal))) rawVal = Number(rawVal);

    const sensor = SENSORES[ref];
    if (!sensor) {
        novo[ref] = rawVal;
        novo[`${ref}_timestamp`] = parseTimestamp(item.time, timestampNow);
        continue;
    }

    if (sensor.tipo === "pressao") {
        if (rawVal == null || rawVal === "") novo[ref] = null;
        else {
            let convertido = ((Number(rawVal) - 0.004) / 0.016) * 20;
            novo[ref] = Number(Math.max(0, Math.min(20, convertido)).toFixed(2));
        }
    } else if (sensor.tipo === "bomba") {
        novo[ref] = Number(rawVal) === 1 ? 1 : 0;
    } else if (sensor.capacidade) {
        // AJUSTE: Também suavizar aqui para 0.5/0.5
        const valorAtual = Number(rawVal) || 0;
        const anterior = Number(novo[ref]) || valorAtual;
        novo[ref] = Number(((anterior * 0.5) + (valorAtual * 0.5)).toFixed(6));
    } else {
        novo[ref] = rawVal;
    }
    novo[`${ref}_timestamp`] = parseTimestamp(item.time, timestampNow);
  }
  novo.timestamp = timestampNow;
  novo.version = Date.now();
  safeWriteJson(DATA_FILE, novo);
  return novo;
}

// ... [MANTER AS DEMAIS FUNÇÕES DE ROTEAMENTO EXATAMENTE COMO ESTAVAM] ...

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(chalk.green(`🚀 Servidor rodando na porta ${PORT}`)));
