// ============================================================================
// SERVIDOR UNIVERSAL HAG — VERSÃO OTIMIZADA 2025
// Compatível com Gateway ITG, API Dog, Render e Dashboard Web
// ============================================================================

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

// === Corrigir __dirname no ESModules (obrigatório no Render) ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === Middlewares universais para aceitar QUALQUER formato do Gateway ===
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// === Pastas e arquivos ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ============================================================================
// TABELA DE SENSORES — corrigida e validada
// ============================================================================

const SENSORES = {
  // ================= RESERVATÓRIOS =================
  "Reservatorio_Elevador_current": {
    leituraVazio: 0.004168,
    leituraCheio: 0.008742,
    capacidade: 20000
  },
  "Reservatorio_Osmose_current": {
    leituraVazio: 0.005050,
    leituraCheio: 0.006492,
    capacidade: 200
  },
  "Reservatorio_CME_current": {
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    capacidade: 1000
  },
  "Reservatorio_Agua_Abrandada_current": {
    leituraVazio: 0.004048,
    leituraCheio: 0.004229,
    capacidade: 9000
  },
  "Reservatorio_lavanderia_current": {
    leituraVazio: 0.006012,
    leituraCheio: 0.010541,
    capacidade: 10000
  },

  // ================== PRESSÕES ==================
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },

  // ================== BOMBAS ====================
  "Bomba_01_binary": { tipo: "bomba" },
  "Ciclos_Bomba_01_counter": { tipo: "ciclo" },
  "Bomba_02_binary": { tipo: "bomba" },
  "Ciclos_Bomba_02_counter": { tipo: "ciclo" }
};

// ============================================================================
// Função segura de salvamento
// ============================================================================
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("✔ Leituras salvas:", JSON.stringify(dados));
}

// ============================================================================
// registro de histórico otimizado
// ============================================================================
function registrarHistorico(dados) {
  const hoje = new Date().toISOString().split("T")[0];

  let historico = {};
  try {
    if (fs.existsSync(HIST_FILE)) {
      historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
    }
  } catch {
    historico = {};
  }

  if (!historico[hoje]) historico[hoje] = {};

  for (const [ref, valor] of Object.entries(dados)) {
    if (ref === "timestamp") continue;

    const sensor = SENSORES[ref];
    if (!sensor || !sensor.capacidade) continue;

    if (typeof valor !== "number" || isNaN(valor)) continue;

    if (!historico[hoje][ref]) {
      historico[hoje][ref] = {
        min: valor,
        max: valor,
        pontos: []
      };
    }

    const reg = historico[hoje][ref];

    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    const variacaoMinima = sensor.capacidade * 0.02;
    const ultimo = reg.pontos.at(-1);

    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacaoMinima) {
      reg.pontos.push({
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor
      });
    }
  }

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// ============================================================================
// ENDPOINT UNIVERSAL — aceita GET, POST, PATCH, ANY
// ============================================================================
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  console.log(`➡️ Recebido ${req.method} em ${req.path}`);

  try {
    // -----------------------------
    // Normalização do corpo
    // -----------------------------
    let body = req.body;

    if (Buffer.isBuffer(body)) body = body.toString("utf8");

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        console.log("⚠ Corpo não JSON:", body.slice(0, 200));
      }
    }

    let dataArray = [];

    if (Array.isArray(body)) dataArray = body;
    else if (body?.data && Array.isArray(body.data)) dataArray = body.data;
    else if (body && typeof body === "object") {
      dataArray = Object.keys(body).map(k => ({ ref: k, value: Number(body[k]) }));
    }

    if (!dataArray.length) {
      return res.status(400).json({ erro: "Nenhum dado válido encontrado" });
    }

    // -----------------------------
    // Carrega último valor
    // -----------------------------
    let ultimo = {};
    if (fs.existsSync(DATA_FILE)) {
      try {
        ultimo = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      } catch {}
    }

    const dados = {};

    for (const item of dataArray) {
      const ref = String(item.ref).trim();
      const bruto = Number(item.value);

      if (!ref || isNaN(bruto)) continue;

      const sensor = SENSORES[ref];
      if (!sensor) {
        dados[ref] = bruto;
        continue;
      }

      let convertido = bruto;

      // -----------------------------
      // Tipos de sensores
      // -----------------------------
      if (sensor.tipo === "pressao") {
        convertido = ((bruto - 0.004) / 0.016) * 20;
        convertido = Math.min(20, Math.max(0, convertido));
        convertido = Number(convertido.toFixed(2));
      }

      else if (sensor.tipo === "bomba") {
        convertido = bruto === 1 ? 1 : 0;
      }

      else if (sensor.tipo === "ciclo") {
        convertido = Math.max(0, Math.round(bruto));
      }

      else if (sensor.capacidade) {
        convertido =
          ((bruto - sensor.leituraVazio) /
            (sensor.leituraCheio - sensor.leituraVazio)) *
          sensor.capacidade;

        convertido = Math.max(0, Math.min(sensor.capacidade, convertido));
        convertido = Math.round(convertido);
      }

      dados[ref] = convertido;
    }

    // -----------------------------
    // PATCH ANTI-NULL
    // mantém últimos valores válidos
    // -----------------------------
    for (const ref of Object.keys(SENSORES)) {
      if (dados[ref] === undefined && ultimo[ref] !== undefined) {
        dados[ref] = ultimo[ref];
      }
    }

    dados.timestamp = new Date().toISOString();

    salvarDados(dados);
    registrarHistorico(dados);

    return res.json({ status: "ok", dados });

  } catch (err) {
    console.error("❌ Erro:", err);
    return res.status(500).json({ erro: err.message });
  }
});

// ============================================================================
// Rotas de dados
// ============================================================================
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

// ============================================================================
// Histórico
// ============================================================================
const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

app.get("/historico", (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json([]);

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const saida = [];

  for (const [data, sensores] of Object.entries(historico)) {
    for (const [ref, d] of Object.entries(sensores)) {
      const nome = Object.keys(MAPA_RESERVATORIOS)
        .find(k => MAPA_RESERVATORIOS[k] === ref);

      if (!nome) continue;

      // ponto mínimo diário
      if (typeof d.min === "number") {
        saida.push({
          reservatorio: nome,
          timestamp: new Date(data).getTime(),
          valor: d.min
        });
      }

      // pontos ao longo do dia
      for (const p of d.pontos || []) {
        const dt = new Date(`${data} ${p.hora}`);
        if (!isNaN(dt.getTime())) {
          saida.push({
            reservatorio: nome,
            timestamp: dt.getTime(),
            valor: p.valor
          });
        }
      }
    }
  }

  saida.sort((a, b) => a.timestamp - b.timestamp);
  res.json(saida);
});

// ============================================================================
// /api/dashboard — otimizado
// ============================================================================
app.get("/api/dashboard", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({
      lastUpdate: "-",
      reservatorios: [],
      pressoes: [],
      bombas: []
    });
  }

  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  const reservatorios = [
    {
      nome: "Reservatório Elevador",
      setor: "elevador",
      percent: Math.round(dados["Reservatorio_Elevador_current"] / 20000 * 100),
      current_liters: dados["Reservatorio_Elevador_current"],
      capacidade: 20000,
      manutencao: false
    },
    {
      nome: "Reservatório Osmose",
      setor: "osmose",
      percent: Math.round(dados["Reservatorio_Osmose_current"] / 200 * 100),
      current_liters: dados["Reservatorio_Osmose_current"],
      capacidade: 200,
      manutencao: false
    },
    {
      nome: "Reservatório CME",
      setor: "cme",
      percent: Math.round(dados["Reservatorio_CME_current"] / 1000 * 100),
      current_liters: dados["Reservatorio_CME_current"],
      capacidade: 1000,
      manutencao: false
    },
    {
      nome: "Água Abrandada",
      setor: "abrandada",
      percent: Math.round(dados["Reservatorio_Agua_Abrandada_current"] / 9000 * 100),
      current_liters: dados["Reservatorio_Agua_Abrandada_current"],
      capacidade: 9000,
      manutencao: false
    },
    {
      nome: "Lavanderia",
      setor: "lavanderia",
      percent: Math.round(dados["Reservatorio_lavanderia_current"] / 10000 * 100),
      current_liters: dados["Reservatorio_lavanderia_current"],
      capacidade: 10000,
      manutencao: false
    }
  ];

  const pressoes = [
    {
      nome: "Pressão Saída Osmose",
      setor: "saida_osmose",
      pressao: dados["Pressao_Saida_Osmose_current"]
    },
    {
      nome: "Pressão Retorno Osmose",
      setor: "retorno_osmose",
      pressao: dados["Pressao_Retorno_Osmose_current"]
    },
    {
      nome: "Pressão Saída CME",
      setor: "saida_cme",
      pressao: dados["Pressao_Saida_CME_current"]
    }
  ];

  const bombas = [
    {
      nome: "Bomba 01",
      estado_num: dados["Bomba_01_binary"] || 0,
      estado: dados["Bomba_01_binary"] === 1 ? "ligada" : "desligada",
      ciclo: dados["Ciclos_Bomba_01_counter"] || 0
    },
    {
      nome: "Bomba 02",
      estado_num: dados["Bomba_02_binary"] || 0,
      estado: dados["Bomba_02_binary"] === 1 ? "ligada" : "desligada",
      ciclo: dados["Ciclos_Bomba_02_counter"] || 0
    }
  ];

  res.json({
    lastUpdate: dados.timestamp,
    reservatorios,
    pressoes,
    bombas
  });
});

// ============================================================================
// Interface estática
// ============================================================================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/dashboard", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);

app.get("/historico-view", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "historico.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

// ============================================================================
// Inicialização
// ============================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor HAG rodando na porta ${PORT}`);
});
