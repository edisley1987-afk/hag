// ============================================================================
// SERVIDOR UNIVERSAL HAG — VERSÃO FINAL OTIMIZADA 2025
// Compatível com Gateway ITG, API Dog, Render e Dashboard Web
// ============================================================================

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ========================= MIDDLEWARE UNIVERSAL =========================
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ limit: "10mb", type: "*/*" }));
app.use(express.raw({ limit: "10mb", type: "*/*" }));

// ========================= ARQUIVOS =========================
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });


// ============================================================================
// TABELA DE SENSORES — REVISADA E OTIMIZADA
// ============================================================================
const SENSORES = {
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

  // PRESSÕES
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },

  // BOMBAS
  "Bomba_01_binary": { tipo: "bomba" },
  "Ciclos_Bomba_01_counter": { tipo: "ciclo" },
  "Bomba_02_binary": { tipo: "bomba" },
  "Ciclos_Bomba_02_counter": { tipo: "ciclo" }
};


// ============================================================================
// SALVAMENTO SEGURO
// ============================================================================
function salvarDados(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
  console.log("✔ Leituras salvas.");
}


// ============================================================================
// HISTÓRICO OTIMIZADO
// ============================================================================
function registrarHistorico(dados) {
  const hoje = new Date().toISOString().split("T")[0];

  let historico = {};
  if (fs.existsSync(HIST_FILE)) {
    historico = JSON.parse(fs.readFileSync(HIST_FILE));
  }

  if (!historico[hoje]) historico[hoje] = {};

  for (const [ref, valor] of Object.entries(dados)) {
    const sensor = SENSORES[ref];
    if (!sensor?.capacidade) continue;

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

    // Só salva variações relevantes
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
// NORMALIZAÇÃO UNIVERSAL — ACEITA QUALQUER FORMA DO GATEWAY
// ============================================================================
function normalizarEntrada(req) {
  let body = req.body;

  if (Buffer.isBuffer(body)) body = body.toString();

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      console.log("⚠ Corpo não JSON:", body.slice(0, 150));
    }
  }

  let arr = [];

  if (Array.isArray(body)) arr = body;

  else if (typeof body === "object") {
    arr = Object.entries(body).map(([ref, value]) => ({
      ref,
      value: Number(value)
    }));
  }

  return arr.filter(x => x.ref && !isNaN(x.value));
}


// ============================================================================
// ENDPOINT UNIVERSAL DE ATUALIZAÇÃO
// ============================================================================
app.all("/atualizar", (req, res) => {
  try {
    console.log(`➡ RECEBIDO ${req.method}`);

    const entradas = normalizarEntrada(req);

    if (!entradas.length)
      return res.status(400).json({ erro: "Nenhum dado válido" });

    let ultimo = {};
    if (fs.existsSync(DATA_FILE)) {
      ultimo = JSON.parse(fs.readFileSync(DATA_FILE));
    }

    const dados = {};

    for (const { ref, value } of entradas) {
      const sensor = SENSORES[ref];

      if (!sensor) {
        dados[ref] = value;
        continue;
      }

      let val = value;

      switch (sensor.tipo) {
        case "pressao":
          val = ((value - 0.004) / 0.016) * 20;
          val = Math.max(0, Math.min(20, val));
          val = Number(val.toFixed(2));
          break;

        case "bomba":
          val = value === 1 ? 1 : 0;
          break;

        case "ciclo":
          val = Math.max(0, Math.round(value));
          break;

        default:
          // RESERVATÓRIO
          val =
            ((value - sensor.leituraVazio) /
              (sensor.leituraCheio - sensor.leituraVazio)) *
            sensor.capacidade;

          val = Math.max(0, Math.min(sensor.capacidade, val));
          val = Math.round(val);
      }

      dados[ref] = val;
    }

    // Mantém últimos valores quando PATCH não envia tudo
    for (const ref in SENSORES) {
      if (dados[ref] === undefined && ultimo[ref] !== undefined) {
        dados[ref] = ultimo[ref];
      }
    }

    dados.timestamp = new Date().toISOString();

    salvarDados(dados);
    registrarHistorico(dados);

    return res.json({ status: "ok", dados });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
});


// ============================================================================
// /dados — Dashboard
// ============================================================================
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE)));
});


// ============================================================================
// /historico — Dashboard (5 dias / gráfico)
// ============================================================================
app.get("/historico", (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json("");
  res.json(JSON.parse(fs.readFileSync(HIST_FILE)));
});


// ============================================================================
// /api/dashboard — DADOS FORMATADOS
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

  const d = JSON.parse(fs.readFileSync(DATA_FILE));

  const reservatorios = [
    {
      nome: "Reservatório Elevador",
      setor: "elevador",
      percent: Math.round(d["Reservatorio_Elevador_current"] / 20000 * 100),
      current_liters: d["Reservatorio_Elevador_current"],
      capacidade: 20000
    },
    {
      nome: "Reservatório Osmose",
      setor: "osmose",
      percent: Math.round(d["Reservatorio_Osmose_current"] / 200 * 100),
      current_liters: d["Reservatorio_Osmose_current"],
      capacidade: 200
    },
    {
      nome: "Reservatório CME",
      setor: "cme",
      percent: Math.round(d["Reservatorio_CME_current"] / 1000 * 100),
      current_liters: d["Reservatorio_CME_current"],
      capacidade: 1000
    },
    {
      nome: "Água Abrandada",
      setor: "abrandada",
      percent: Math.round(d["Reservatorio_Agua_Abrandada_current"] / 9000 * 100),
      current_liters: d["Reservatorio_Agua_Abrandada_current"],
      capacidade: 9000
    },
    {
      nome: "Lavanderia",
      setor: "lavanderia",
      percent: Math.round(d["Reservatorio_lavanderia_current"] / 10000 * 100),
      current_liters: d["Reservatorio_lavanderia_current"],
      capacidade: 10000
    }
  ];

  const pressoes = [
    { setor: "saida_osmose", pressao: d["Pressao_Saida_Osmose_current"] },
    { setor: "retorno_osmose", pressao: d["Pressao_Retorno_Osmose_current"] },
    { setor: "saida_cme", pressao: d["Pressao_Saida_CME_current"] }
  ];

  const bombas = [
    {
      estado_num: d["Bomba_01_binary"],
      estado: d["Bomba_01_binary"] === 1 ? "ligada" : "desligada",
      ciclo: d["Ciclos_Bomba_01_counter"]
    },
    {
      estado_num: d["Bomba_02_binary"],
      estado: d["Bomba_02_binary"] === 1 ? "ligada" : "desligada",
      ciclo: d["Ciclos_Bomba_02_counter"]
    }
  ];

  res.json({
    lastUpdate: d.timestamp,
    reservatorios,
    pressoes,
    bombas
  });
});


// ============================================================================
// STATIC
// ============================================================================
app.use(express.static(path.join(__dirname, "public")));


// ============================================================================
// INICIAR SERVIDOR
// ============================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor HAG rodando na porta ${PORT}`);
});
