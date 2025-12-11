// server.js
// HAG — Servidor otimizado (RAM cache, debounce I/O, SSE, WebSocket, cluster, diagnostics)
// Requer: npm i express cors compression ws chalk

import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import cluster from "cluster";
import { WebSocketServer } from "ws";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CPU_COUNT = os.cpus().length || 1;
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// ------------------------- CONFIG (executa no master e workers) -------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ------------------------- cluster (master/worker) -------------------------
if (cluster.isPrimary && CPU_COUNT > 1) {
  console.log(chalk.green.bold(`Master process iniciando (${CPU_COUNT} workers)`));
  for (let i = 0; i < CPU_COUNT; i++) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    console.log(chalk.yellow(`Worker ${worker.process.pid} finalizado (code=${code} signal=${signal}). Reiniciando...`));
    setTimeout(() => cluster.fork(), 1000);
  });

} else {
  // ------------------------- App e middlewares -------------------------
  const app = express();
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "12mb", strict: false }));
  app.use(express.text({ type: ["text/*", "application/*"], limit: "12mb" }));
  app.use(express.urlencoded({ extended: true, limit: "12mb" }));

  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // logs simples
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      console.log(chalk.cyan(`[${new Date().toISOString()}] [${process.pid}] ${req.method} ${req.originalUrl} → ${ms}ms`));
    });
    next();
  });

  // ------------------------- RAM CACHE (carrega arquivos) -------------------------
  const CACHE = {
    leitura: {},
    historico: {},
    manutencao: { ativo: false }
  };

  function loadSync(file, fallback) {
    try {
      if (!fs.existsSync(file)) return fallback;
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.warn("loadSync error", file, e.message);
      return fallback;
    }
  }

  CACHE.leitura = loadSync(DATA_FILE, {});
  CACHE.historico = loadSync(HIST_FILE, {});
  CACHE.manutencao = loadSync(MANUT_FILE, { ativo: false });

  // ------------------------- debounce write (async) -------------------------
  let writes = {};
  function scheduleWrite(file, data, delay = 50) {
    if (writes[file]) clearTimeout(writes[file]);
    writes[file] = setTimeout(() => {
      fs.writeFile(file, JSON.stringify(data, null, 2), (err) => {
        if (err) console.error(chalk.red("Erro escrita arquivo:"), file, err.message);
      });
      delete writes[file];
    }, delay);
  }

  // ------------------------- SENSORES (sua calibração) -------------------------
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
    "Ciclos_Bomba_02_counter": { tipo: "ciclo" }
  };

  // ------------------------- parser / normalizer -------------------------
  function tryParse(body) {
    if (!body) return null;
    if (typeof body === "object") return body;
    const s = String(body).trim();
    try { return JSON.parse(s); } catch {}
    // form-encoded fallback
    if (s.includes("=") && s.includes("&")) {
      const obj = {};
      s.split("&").forEach(p => {
        const [k, v] = p.split("=");
        obj[decodeURIComponent(k||"")] = decodeURIComponent(v||"");
      });
      return obj;
    }
    return null;
  }

  function normalize(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map(i => ({ ref: i.ref ?? i.key ?? i.name, value: i.value ?? i.v ?? i.val ?? i }));
    }
    if (raw.data && Array.isArray(raw.data)) {
      return raw.data.map(i => ({ ref: i.ref ?? i.key ?? i.name, value: i.value ?? i.v ?? i.val ?? i }));
    }
    if (typeof raw === "object") {
      return Object.keys(raw).map(k => ({ ref: k, value: raw[k] }));
    }
    return [];
  }

  // ------------------------- converter (converte leituras) -------------------------
  function convertArray(arr) {
    const novo = { ...CACHE.leitura }; // start with cached values
    const now = new Date().toISOString();

    for (const item of arr) {
      const ref = item.ref;
      let val = item.value;
      if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) val = Number(val);
      const sensor = SENSORES[ref];

      if (!sensor) {
        novo[ref] = val;
        novo[`${ref}_timestamp`] = now;
        continue;
      }

      if (sensor.tipo === "pressao") {
        let n = Number(val) || 0;
        let conv = ((n - 0.004) / 0.016) * 20;
        conv = Math.max(0, Math.min(20, conv));
        novo[ref] = Number(conv.toFixed(2));
      } else if (sensor.tipo === "bomba") {
        novo[ref] = Number(val) === 1 ? 1 : 0;
      } else if (sensor.tipo === "ciclo") {
        novo[ref] = Math.max(0, Math.round(Number(val) || 0));
      } else if (sensor.capacidade) {
        const leitura = Number(val) || 0;
        const percentual = (leitura - sensor.leituraVazio) / (sensor.leituraCheio - sensor.leituraVazio);
        let litros = percentual * sensor.capacidade;
        litros = Math.max(0, Math.min(sensor.capacidade, litros));
        novo[ref] = Math.round(litros);
      } else {
        novo[ref] = val;
      }

      novo[`${ref}_timestamp`] = now;
    }

    novo.timestamp = now;
    CACHE.leitura = novo;
    scheduleWrite(DATA_FILE, CACHE.leitura);
    return novo;
  }

  // ------------------------- historico (RAM + debounce) -------------------------
  function registrarHistorico(dados) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (!CACHE.historico[hoje]) CACHE.historico[hoje] = {};

    for (const [ref, valor] of Object.entries(dados)) {
      if (!SENSORES[ref] || !SENSORES[ref].capacidade) continue;
      if (!CACHE.historico[hoje][ref]) CACHE.historico[hoje][ref] = { min: valor, max: valor, pontos: [] };

      const reg = CACHE.historico[hoje][ref];
      reg.min = Math.min(reg.min, valor);
      reg.max = Math.max(reg.max, valor);

      const ultimo = reg.pontos.at(-1);
      const variacao = Math.max(1, SENSORES[ref].capacidade * 0.02);
      if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
        reg.pontos.push({ hora: new Date().toLocaleTimeString("pt-BR"), valor });
      }
    }

    scheduleWrite(HIST_FILE, CACHE.historico);
  }

  // ------------------------- SSE (Server-Sent Events) -------------------------
  const sseClients = new Set();
  app.get("/status-stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders && res.flushHeaders();

    const id = Date.now() + Math.random();
    sseClients.add(res);
    // enviar estado inicial
    res.write(`data: ${JSON.stringify({ lastUpdate: CACHE.leitura.timestamp || new Date().toISOString(), leitura: CACHE.leitura })}\n\n`);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  function broadcastSSE(payload) {
    const s = `data: ${JSON.stringify(payload)}\n\n`;
    for (const r of sseClients) {
      try { r.write(s); } catch (e) { sseClients.delete(r); }
    }
  }

  // ------------------------- WebSocket (opcional) -------------------------
  // vamos criar WS no mesmo server quando o httpServer for criado (mais abaixo)
  let wss = null;
  function broadcastWS(obj) {
    if (!wss) return;
    const s = JSON.stringify(obj);
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(s); });
  }

  // ------------------------- rotas de ingestão (/atualizar /iot) -------------------------
  app.all(["/atualizar", "/atualizar/*", "/iot", "/iot/*"], async (req, res) => {
    try {
      let raw = req.body;
      // se body estiver vazio, tentar texto bruto (alguns gateways enviam text)
      if ((!raw || Object.keys(raw).length === 0) && req.get("content-type") && req._readableState && req._readableState.length) {
        raw = req.body || req.rawBody || "";
      }
      const parsed = tryParse(raw);
      if (!parsed) {
        console.warn(chalk.yellow("Payload inválido:"), typeof raw === "string" ? raw.slice(0, 200) : raw);
        return res.status(400).json({ erro: "Payload inválido" });
      }

      const arr = normalize(parsed);
      if (!arr.length) return res.status(400).json({ erro: "Nenhum dado" });

      const novo = convertArray(arr);
      // histórico em background (rápido)
      try { registrarHistorico(novo); } catch (e) { console.error("erro historico", e.message); }

      // notificar SSE / WS
      const emit = { lastUpdate: novo.timestamp, leitura: novo };
      broadcastSSE(emit);
      broadcastWS(emit);

      return res.json({ status: "ok", recebido: arr.length, timestamp: novo.timestamp });
    } catch (e) {
      console.error("Erro processar /atualizar:", e);
      return res.status(500).json({ erro: "interno" });
    }
  });

  // ------------------------- rotas de leitura -------------------------
  app.get("/dados", (req, res) => res.json(CACHE.leitura));

  app.get("/historico", (req, res) => {
    const out = [];
    for (const [data, sensores] of Object.entries(CACHE.historico)) {
      for (const [ref, dados] of Object.entries(sensores)) {
        const nome = Object.keys({
          elevador: "Reservatorio_Elevador_current",
          osmose: "Reservatorio_Osmose_current",
          cme: "Reservatorio_CME_current",
          abrandada: "Reservatorio_Agua_Abrandada_current",
          lavanderia: "Reservatorio_lavanderia_current"
        }).find(k => false); // we keep same transformation as lightweight; frontend uses own historico route if needed
        // simplified: return raw historico
        out.push({ data, ref, dados });
      }
    }
    res.json(out);
  });

  // dashboard simplificado (compatível com seu frontend)
  app.get("/api/dashboard", (req, res) => {
    const d = CACHE.leitura || {};
    const reservatorios = [
      { nome: "Reservatório Elevador", setor: "elevador", percent: Math.round((d["Reservatorio_Elevador_current"] || 0) / 20000 * 100), current_liters: d["Reservatorio_Elevador_current"] || 0, capacidade: 20000, manutencao: CACHE.manutencao.ativo },
      { nome: "Reservatório Osmose", setor: "osmose", percent: Math.round((d["Reservatorio_Osmose_current"] || 0) / 200 * 100), current_liters: d["Reservatorio_Osmose_current"] || 0, capacidade: 200, manutencao: CACHE.manutencao.ativo },
      { nome: "Reservatório CME", setor: "cme", percent: Math.round((d["Reservatorio_CME_current"] || 0) / 1000 * 100), current_liters: d["Reservatorio_CME_current"] || 0, capacidade: 1000, manutencao: CACHE.manutencao.ativo },
      { nome: "Água Abrandada", setor: "abrandada", percent: Math.round((d["Reservatorio_Agua_Abrandada_current"] || 0) / 9000 * 100), current_liters: d["Reservatorio_Agua_Abrandada_current"] || 0, capacidade: 9000, manutencao: CACHE.manutencao.ativo },
      { nome: "Lavanderia", setor: "lavanderia", percent: Math.round((d["Reservatorio_lavanderia_current"] || 0) / 10000 * 100), current_liters: d["Reservatorio_lavanderia_current"] || 0, capacidade: 10000, manutencao: CACHE.manutencao.ativo }
    ];

    const pressoes = [
      { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: d["Pressao_Saida_Osmose_current"] ?? null, manutencao: CACHE.manutencao.ativo },
      { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: d["Pressao_Retorno_Osmose_current"] ?? null, manutencao: CACHE.manutencao.ativo },
      { nome: "Pressão Saída CME", setor: "saida_cme", pressao: d["Pressao_Saida_CME_current"] ?? null, manutencao: CACHE.manutencao.ativo }
    ];

    const bombas = [
      { nome: "Bomba 01", estado_num: Number(d["Bomba_01_binary"]) || 0, estado: Number(d["Bomba_01_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(d["Ciclos_Bomba_01_counter"]) || 0, manutencao: CACHE.manutencao.ativo },
      { nome: "Bomba 02", estado_num: Number(d["Bomba_02_binary"]) || 0, estado: Number(d["Bomba_02_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(d["Ciclos_Bomba_02_counter"]) || 0, manutencao: CACHE.manutencao.ativo }
    ];

    res.json({ lastUpdate: d.timestamp || "-", reservatorios, pressoes, bombas, manutencao: CACHE.manutencao.ativo });
  });

  // manutencao
  app.get("/manutencao", (_, res) => res.json(CACHE.manutencao));
  app.post("/manutencao", (req, res) => {
    const ativo = Boolean(req.body.ativo);
    CACHE.manutencao.ativo = ativo;
    scheduleWrite(MANUT_FILE, CACHE.manutencao);
    res.json({ ok: true, ativo });
  });

  // diagnostics
  app.get("/diagnostics", (req, res) => {
    const diag = {
      pid: process.pid,
      worker: cluster.isWorker ? cluster.worker.id : null,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      sseClients: sseClients.size,
      wsClients: wss ? wss.clients.size : 0,
      lastUpdate: CACHE.leitura.timestamp || null
    };
    res.json(diag);
  });

  // simple ping
  app.get("/api/ping", (req, res) => res.json({ ok: true, pid: process.pid, timestamp: Date.now() }));

  // static
  app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

  // ------------------------- START HTTP + WS -------------------------
  const server = app.listen(PORT, () => {
    // ajustes de keepAlive/headers
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    console.log(chalk.green(`Worker ${process.pid} rodando - porta ${PORT}`));
  });

  // WebSocketServer ligado no mesmo server
  try {
    wss = new WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (socket, req) => {
      console.log(chalk.magenta(`WS conectado (pid=${process.pid})`));
      socket.on("message", (m) => {
        // opcional: cliente pode pedir 'ping' ou 'status'
        try {
          const msg = JSON.parse(m.toString());
          if (msg && msg.cmd === "status") socket.send(JSON.stringify({ lastUpdate: CACHE.leitura.timestamp, leitura: CACHE.leitura }));
        } catch {}
      });
      socket.on("close", () => console.log(chalk.magenta("WS desconectado")));
    });
  } catch (e) {
    console.warn("WebSocket init error:", e.message);
  }

  // ------------------------- Graceful shutdown -------------------------
  function shutdown() {
    console.log(chalk.yellow(`Worker ${process.pid} encerrando...`));
    server.close(() => {
      console.log("HTTP server fechado");
      try { wss && wss.close(); } catch {}
      process.exit(0);
    });
    setTimeout(() => {
      console.warn("Forçando exit");
      process.exit(1);
    }, 5000).unref();
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
