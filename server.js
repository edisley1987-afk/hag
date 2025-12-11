// ======= Servidor Universal HAG - otimizado para Gateway ITG 200 + Render =======
// ESModules, logs claros, rota /atualizar e /iot, timestamps por sensor, sem raw buffering

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------------------- MIDDLEWARES -------------------------
app.use(cors());

// aceitar json padrão e text/plain (alguns gateways enviam text)
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: ["text/*", "application/*"], limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Prevenção de cache
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Log de requisição (tempo)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${req.method}] ${req.originalUrl} → ${ms}ms`);
  });
  next();
});

// ------------------------- ARQUIVOS E CONST -------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANUT_FILE)) fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

// Sensores / calibrações (mantive seu mapa)
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008742, capacidade: 20000, altura: 1.45 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006492, capacidade: 200, altura: 1 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000, altura: 0.45 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004048, leituraCheio: 0.004849, capacidade: 9000, altura: 0.6 },
  "Reservatorio_lavanderia_current": { leituraVazio: 0.006012, leituraCheio: 0.010607, capacidade: 10000, altura: 1.45 },

  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },

  "Bomba_01_binary": { tipo: "bomba" },
  "Ciclos_Bomba_01_counter": { tipo: "ciclo" },
  "Bomba_02_binary": { tipo: "bomba" },
  "Ciclos_Bomba_02_counter": { tipo: "ciclo" }
};

// ------------------------- HELPERS -------------------------
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

// tenta extrair um JSON do corpo (suporta string JSON e objetos)
function parseBodyGuess(body) {
  if (!body) return null;
  if (typeof body === "object") return body;
  if (typeof body === "string") {
    // já em plain text -> tentar parse
    body = body.trim();
    try {
      return JSON.parse(body);
    } catch (e) {
      // tentar matches simples: k1=v1&k2=v2  -> transformar em objeto
      if (body.includes("=") && body.includes("&")) {
        const parts = body.split("&");
        const obj = {};
        parts.forEach(p => {
          const [k, v] = p.split("=");
          obj[decodeURIComponent(k || "")] = decodeURIComponent(v || "");
        });
        return obj;
      }
      // não conseguimos parsear
      return null;
    }
  }
  return null;
}

// transforma pacote em array uniforme [{ ref, value, dev_id, time }, ...]
function normalizePacket(raw) {
  let arr = [];
  if (!raw) return arr;

  if (Array.isArray(raw)) {
    arr = raw.map(i => ({ ref: i.ref ?? i.name ?? i.key, value: i.value ?? i.v ?? i.val ?? i, dev_id: i.dev_id, time: i.time }));
  } else if (raw.data && Array.isArray(raw.data)) {
    arr = raw.data.map(i => ({ ref: i.ref ?? i.name ?? i.key, value: i.value ?? i.v ?? i.val ?? i, dev_id: i.dev_id ?? i.devId ?? i.device, time: i.time }));
  } else if (typeof raw === "object") {
    // object map: { key: value, ... }
    arr = Object.keys(raw).map(k => ({ ref: k, value: raw[k] }));
  }
  // filtrar nulos
  return arr.filter(x => x.ref !== undefined);
}

// processa array normalizado e retorna objeto mesclado (novo)
function convertAndMerge(dataArray) {
  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = { ...ultimo };

  const timestampNow = new Date().toISOString();

  for (const item of dataArray) {
    const ref = item.ref;
    let rawVal = item.value;

    // tentar converter para número quando possível
    if (typeof rawVal === "string" && rawVal.trim() !== "" && !isNaN(Number(rawVal))) rawVal = Number(rawVal);

    const sensor = SENSORES[ref];

    if (!sensor) {
      // grava cru
      novo[ref] = rawVal;
      // timestamp individual
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

    // timestamp por sensor (usa item.time se fornecido, senão agora)
    novo[`${ref}_timestamp`] = item.time ? new Date(item.time).toISOString() : timestampNow;
  }

  // timestamp global (último processamento)
  novo.timestamp = timestampNow;

  return novo;
}

// registra histórico (apenas sensores com capacidade definidos)
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

// ------------------------- ROTEAMENTO PRINCIPAL -------------------------
// Aceita POST/PUT em /atualizar e /iot (compatibilidade com Gateway)
app.all(["/atualizar", "/atualizar/*", "/iot", "/iot/*"], async (req, res) => {
  try {
    // body pode vir como objeto (express.json), ou texto (express.text)
    let rawBody = req.body;
    if (!rawBody || (typeof rawBody === "string" && rawBody.trim() === "")) {
      // tentar ler raw payload do stream (fallback)
      rawBody = req._rawBody || req.body;
    }

    const parsed = parseBodyGuess(rawBody);
    if (!parsed) {
      console.warn("⚠️ Payload não entendível:", typeof rawBody === "string" ? rawBody.slice(0, 500) : rawBody);
      return res.status(400).json({ erro: "Payload inválido ou vazio" });
    }

    const arr = normalizePacket(parsed);
    if (!arr.length) {
      return res.status(400).json({ erro: "Nenhum dado encontrado no payload" });
    }

    // Converter e mesclar
    const novo = convertAndMerge(arr);

    // salvar em disco (atomicidade simples)
    safeWriteJson(DATA_FILE, novo);

    // registrar histórico assíncrono mas rápido
    try { registrarHistorico(novo); } catch (e) { console.error("Erro historico:", e); }

    console.log(`➡️ Pacote processado: itens=${arr.length} | timestamp=${novo.timestamp}`);
    return res.json({ status: "ok", dados: novo, recebido: arr.length });
  } catch (err) {
    console.error("Erro processar /atualizar:", err);
    return res.status(500).json({ erro: (err && err.message) ? err.message : "erro interno" });
  }
});

// ------------------------- ROTAS DE LEITURA -------------------------
app.get("/dados", (req, res) => res.json(safeReadJson(DATA_FILE, {})));

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
    for (const [ref, dados] of Object.entries(sensores)) {
      const nome = Object.keys(MAPA_RESERVATORIOS).find(key => MAPA_RESERVATORIOS[key] === ref);
      if (!nome) continue;
      if (typeof dados.min === "number") {
        saida.push({ reservatorio: nome, timestamp: new Date(data).getTime(), valor: dados.min });
      }
      for (const p of dados.pontos || []) {
        const dt = new Date(`${data} ${p.hora}`);
        saida.push({ reservatorio: nome, timestamp: dt.getTime(), valor: p.valor });
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
    const pontos = sensores[ref]?.pontos || [];
    for (const p of pontos) {
      const dt = new Date(`${data} ${p.hora}`).getTime();
      if (agora - dt <= 24 * 60 * 60 * 1000) saida.push({ reservatorio: nome, timestamp: dt, valor: p.valor });
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
    const reg = historico[dia][ref];
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
      const reg = historico[data][ref];
      if (!reg) return 0;
      const valores = [];
      if (typeof reg.min === "number") valores.push(reg.min);
      if (Array.isArray(reg.pontos)) reg.pontos.forEach(p => valores.push(p.valor));
      if (valores.length < 2) return 0;
      let t = 0;
      for (let i = 1; i < valores.length; i++) {
        if (valores[i] < valores[i - 1]) t += valores[i - 1] - valores[i];
      }
      return Number(t.toFixed(2));
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
app.get("/api/dashboard", (req, res) => {
  const dados = safeReadJson(DATA_FILE, {});
  if (!dados || Object.keys(dados).length === 0) {
    return res.json({
      lastUpdate: "-",
      reservatorios: [],
      pressoes: [],
      bombas: [],
      manutencao: getManutencao().ativo
    });
  }

  const reservatorios = [
    { nome: "Reservatório Elevador", setor: "elevador", percent: Math.round((dados["Reservatorio_Elevador_current"] / 20000) * 100), current_liters: dados["Reservatorio_Elevador_current"], capacidade: 20000, manutencao: getManutencao().ativo },
    { nome: "Reservatório Osmose", setor: "osmose", percent: Math.round((dados["Reservatorio_Osmose_current"] / 200) * 100), current_liters: dados["Reservatorio_Osmose_current"], capacidade: 200, manutencao: getManutencao().ativo },
    { nome: "Reservatório CME", setor: "cme", percent: Math.round((dados["Reservatorio_CME_current"] / 1000) * 100), current_liters: dados["Reservatorio_CME_current"], capacidade: 1000, manutencao: getManutencao().ativo },
    { nome: "Água Abrandada", setor: "abrandada", percent: Math.round((dados["Reservatorio_Agua_Abrandada_current"] / 9000) * 100), current_liters: dados["Reservatorio_Agua_Abrandada_current"], capacidade: 9000, manutencao: getManutencao().ativo },
    { nome: "Lavanderia", setor: "lavanderia", percent: Math.round((dados["Reservatorio_lavanderia_current"] / 10000) * 100), current_liters: dados["Reservatorio_lavanderia_current"], capacidade: 10000, manutencao: getManutencao().ativo }
  ];

  const pressoes = [
    { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: dados["Pressao_Saida_Osmose_current"] ?? null, manutencao: getManutencao().ativo },
    { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: dados["Pressao_Retorno_Osmose_current"] ?? null, manutencao: getManutencao().ativo },
    { nome: "Pressão Saída CME", setor: "saida_cme", pressao: dados["Pressao_Saida_CME_current"] ?? null, manutencao: getManutencao().ativo }
  ];

  const bombas = [
    { nome: "Bomba 01", estado_num: Number(dados["Bomba_01_binary"]) || 0, estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0, manutencao: getManutencao().ativo },
    { nome: "Bomba 02", estado_num: Number(dados["Bomba_02_binary"]) || 0, estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0, manutencao: getManutencao().ativo }
  ];

  return res.json({
    lastUpdate: dados.timestamp,
    reservatorios,
    pressoes,
    bombas,
    manutencao: getManutencao().ativo
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

// ------------------------- ESTÁTICOS E START -------------------------
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/login", (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// ping simples
app.get("/api/ping", (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// Keep-alive opcional (mantém Render acordado)
setInterval(() => {
  try {
    // Node 18+ tem fetch global
    if (typeof fetch === "function") {
      fetch(`https://${process.env.RENDER_INTERNAL_HOSTNAME || process.env.HOSTNAME || "localhost"}:${process.env.PORT || 443}/api/ping`)
        .catch(() => {});
    }
  } catch (e) { /* ignorar */ }
}, 60 * 1000);

// iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor HAG otimizado ativo na porta ${PORT}`));
