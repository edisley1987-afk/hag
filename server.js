// ======= Servidor Universal HAG - compatível com Gateway ITG e Render =======
// Versão estável ESModules + logs compatíveis com Render

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

// === Corrigir __dirname no ESModules (ESSENCIAL NO RENDER) ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === Prevenção de cache para garantir dados sempre frescos ===
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// === LOG DE TEMPO POR REQUISIÇÃO (melhor info) ===
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${req.method}] ${req.originalUrl} → ${ms}ms`);
  });
  next();
});

// === Middleware universal (aceita qualquer formato do Gateway) ===
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// === Pastas e arquivos de dados ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MANUT_FILE)) fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

// ============================================================================
// FUNÇÕES DE MANUTENÇÃO
// ============================================================================
function getManutencao() {
  try {
    return JSON.parse(fs.readFileSync(MANUT_FILE, "utf8"));
  } catch {
    return { ativo: false };
  }
}
function setManutencao(ativo) {
  fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo }, null, 2));
}

// ============================================================================
// TABELA DE SENSORES
// ============================================================================
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

// ============================================================================
// helpers: leitura / escrita segura
// ============================================================================
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

// ============================================================================
// registrarHistorico(): registra alteração por dia
// ============================================================================
function registrarHistorico(dadosConvertidos) {
  const hoje = new Date().toISOString().split("T")[0];
  const historico = safeReadJson(HIST_FILE, {});

  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dadosConvertidos).forEach(([ref, valor]) => {
    if (ref === "timestamp") return;
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

// ============================================================================
// processarPacote(): converte e mescla dados com patch anti-nulo
// ============================================================================
function processarPacote(rawBody) {
  let dataArray = [];

  if (Array.isArray(rawBody)) {
    dataArray = rawBody.map(i => ({ ref: i.ref ?? i.name ?? i.key, value: i.value ?? i.v ?? i.val ?? i }));
  } else if (rawBody?.data && Array.isArray(rawBody.data)) {
    dataArray = rawBody.data.map(i => ({ ref: i.ref ?? i.name ?? i.key, value: i.value ?? i.v ?? i.val ?? i }));
  } else if (rawBody && typeof rawBody === "object") {
    dataArray = Object.keys(rawBody).map(k => ({ ref: k, value: rawBody[k] }));
  } else {
    return null;
  }

  const ultimo = safeReadJson(DATA_FILE, {});
  const novo = { ...ultimo };

  for (const item of dataArray) {
    const ref = item.ref;
    const rawVal = item.value;
    if (!ref) continue;

    const valorNum = Number(rawVal);
    const sensor = SENSORES[ref];

    if (!sensor) {
      novo[ref] = valorNum;
      continue;
    }

    if (sensor.tipo === "pressao") {
      let convertido = ((valorNum - 0.004) / 0.016) * 20;
      convertido = Math.max(0, Math.min(20, convertido));
      novo[ref] = Number(convertido.toFixed(2));
    } else if (sensor.tipo === "bomba") {
      novo[ref] = valorNum === 1 ? 1 : 0;
    } else if (sensor.tipo === "ciclo") {
      novo[ref] = Math.max(0, Math.round(valorNum));
    } else if (sensor.capacidade) {
      const percentual = (valorNum - sensor.leituraVazio) / (sensor.leituraCheio - sensor.leituraVazio);
      let litros = percentual * sensor.capacidade;
      novo[ref] = Math.max(0, Math.min(sensor.capacidade, Math.round(litros)));
    } else {
      novo[ref] = valorNum;
    }
  }

  novo.timestamp = new Date().toISOString();
  return { novo, convertidoDoArray: dataArray };
}

// ============================================================================
// /atualizar — processa e salva
// ============================================================================
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  console.log(`➡️ Recebido ${req.method} em ${req.path}`);

  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    const processed = processarPacote(body);
    if (!processed) return res.status(400).json({ erro: "Nenhum dado válido encontrado" });

    const { novo, convertidoDoArray } = processed;

    safeWriteJson(DATA_FILE, novo);
    registrarHistorico(novo);

    console.log("Leituras salvas:", JSON.stringify(novo));
    return res.json({ status: "ok", dados: novo, recebido: convertidoDoArray });
  } catch (err) {
    console.error("Erro processar /atualizar:", err);
    return res.status(500).json({ erro: err.message });
  }
});

// ============================================================================
// /dados — retorna leituras atuais
// ============================================================================
app.get("/dados", (req, res) => {
  return res.json(safeReadJson(DATA_FILE, {}));
});

// ============================================================================
// MAPA RESERVATÓRIOS
// ============================================================================
const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

// ============================================================================
// /historico
// ============================================================================
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

// ============================================================================
// /historico/24h/:reservatorio
// ============================================================================
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
      if (agora - dt <= 24 * 60 * 60 * 1000) {
        saida.push({ reservatorio: nome, timestamp: dt, valor: p.valor });
      }
    }
  }

  saida.sort((a, b) => a.timestamp - b.timestamp);
  return res.json(saida);
});

// ============================================================================
// /consumo/5dias/:reservatorio
// ============================================================================
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

// ============================================================================
// /api/consumo_diario
// ============================================================================
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

// ============================================================================
// /api/dashboard
// ============================================================================
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
    {
      nome: "Reservatório Elevador",
      setor: "elevador",
      percent: Math.round((dados["Reservatorio_Elevador_current"] / 20000) * 100),
      current_liters: dados["Reservatorio_Elevador_current"],
      capacidade: 20000,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Reservatório Osmose",
      setor: "osmose",
      percent: Math.round((dados["Reservatorio_Osmose_current"] / 200) * 100),
      current_liters: dados["Reservatorio_Osmose_current"],
      capacidade: 200,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Reservatório CME",
      setor: "cme",
      percent: Math.round((dados["Reservatorio_CME_current"] / 1000) * 100),
      current_liters: dados["Reservatorio_CME_current"],
      capacidade: 1000,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Água Abrandada",
      setor: "abrandada",
      percent: Math.round((dados["Reservatorio_Agua_Abrandada_current"] / 9000) * 100),
      current_liters: dados["Reservatorio_Agua_Abrandada_current"],
      capacidade: 9000,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Lavanderia",
      setor: "lavanderia",
      percent: Math.round((dados["Reservatorio_lavanderia_current"] / 10000) * 100),
      current_liters: dados["Reservatorio_lavanderia_current"],
      capacidade: 10000,
      manutencao: getManutencao().ativo
    }
  ];

  const pressoes = [
    { nome: "Pressão Saída Osmose", pressao: dados["Pressao_Saida_Osmose_current"], manutencao: getManutencao().ativo },
    { nome: "Pressão Retorno Osmose", pressao: dados["Pressao_Retorno_Osmose_current"], manutencao: getManutencao().ativo },
    { nome: "Pressão Saída CME", pressao: dados["Pressao_Saida_CME_current"], manutencao: getManutencao().ativo }
  ];

  const bombas = [
    {
      nome: "Bomba 01",
      estado_num: Number(dados["Bomba_01_binary"]) || 0,
      estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada",
      ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Bomba 02",
      estado_num: Number(dados["Bomba_02_binary"]) || 0,
      estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada",
      ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0,
      manutencao: getManutencao().ativo
    }
  ];

  return res.json({
    lastUpdate: dados.timestamp,
    reservatorios,
    pressoes,
    bombas,
    manutencao: getManutencao().ativo
  });
});

// ============================================================================
// ROTAS DE MANUTENÇÃO
// ============================================================================
app.get("/manutencao", (req, res) => res.json(getManutencao()));

app.post("/manutencao", (req, res) => {
  const { ativo } = req.body;
  if (typeof ativo !== "boolean") return res.status(400).json({ erro: "Campo 'ativo' deve ser true/false" });
  setManutencao(ativo);
  res.json({ status: "ok", ativo });
});

// ============================================================================
// Arquivos estáticos (public)
// ============================================================================
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/login", (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// ============================================================================
// Keep Alive
// ============================================================================
app.get("/api/ping", (req, res) => res.json({ ok: true, timestamp: Date.now() }));

setInterval(() => {
  fetch("https://hag-9ki9.onrender.com/api/ping").catch(() => {});
}, 60000);

// ============================================================================
// Start Server
// ============================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor HAG ativo na porta ${PORT}`));
