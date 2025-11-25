// ============================================================================
//  SERVER.JS — versão ES MODULE compatível com GATEWAY e com Render
// ============================================================================

import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Corrigir __dirname no ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
//  Middleware UNIVERSAL — aceita QUALQUER payload do gateway
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// ---------------------------------------------------------------------------
//  Arquivos
// ---------------------------------------------------------------------------
const DATA_FILE = path.join(__dirname, "data", "readings.json");
const HIST_FILE = path.join(__dirname, "data", "historico.json");

if (!fs.existsSync(path.join(__dirname, "data")))
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
if (!fs.existsSync(HIST_FILE)) fs.writeFileSync(HIST_FILE, "{}");

// ---------------------------------------------------------------------------
//  Tabela sensores
// ---------------------------------------------------------------------------
const SENSORES = {
  "Reservatorio_Elevador_current": {
    leituraVazio: 0.004168,
    leituraCheio: 0.009480,
    capacidade: 20000
  },
  "Reservatorio_Osmose_current": {
    leituraVazio: 0.005050,
    leituraCheio: 0.006693,
    capacidade: 200
  },
  "Reservatorio_CME_current": {
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    capacidade: 1000
  },
  "Reservatorio_Agua_Abrandada_current": {
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
    capacidade: 9000
  },

  // pressões
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// ---------------------------------------------------------------------------
//  Função salvar última leitura
// ---------------------------------------------------------------------------
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
}

// ---------------------------------------------------------------------------
//  Função registrar histórico
// ---------------------------------------------------------------------------
function registrarHistorico(dados) {
  const hoje = new Date().toISOString().split("T")[0];
  let historico = {};

  if (fs.existsSync(HIST_FILE)) {
    try {
      historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
    } catch {
      historico = {};
    }
  }

  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dados).forEach(([ref, valor]) => {
    if (ref === "timestamp" || typeof valor !== "number") return;

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

    const ultimo = reg.pontos.at(-1);
    if (!ultimo || Math.abs(valor - ultimo.valor) >= 5) {
      reg.pontos.push({
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor
      });
    }
  });

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// ============================================================================
//  🔥 ENDPOINT CRÍTICO — /atualizar  (gateway usa este!)
// ============================================================================
app.all("/atualizar", (req, res) => {
  console.log("📡 Dados recebidos do gateway");

  let body = req.body;

  // converter string → JSON
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      console.log("⚠ corpo não JSON:", body);
    }
  }

  let dataArray = [];

  if (Array.isArray(body)) {
    dataArray = body;
  } else if (body && Array.isArray(body.data)) {
    dataArray = body.data;
  } else if (typeof body === "object") {
    dataArray = Object.keys(body)
      .filter(k => k.includes("_current"))
      .map(k => ({ ref: k, value: Number(body[k]) }));
  }

  if (!dataArray.length) {
    console.warn("❌ Nenhum dado válido recebido");
    return res.status(400).json({ erro: "Nenhum dado válido" });
  }

  const dadosConvertidos = {};

  for (const item of dataArray) {
    const ref = item.ref || item.name;
    const valor = Number(item.value);
    if (!ref || isNaN(valor)) continue;

    const sensor = SENSORES[ref];
    if (!sensor) {
      dadosConvertidos[ref] = valor;
      continue;
    }

    let leitura;
    if (sensor.tipo === "pressao") {
      leitura = ((valor - 0.004) / 0.016) * 20;
      leitura = Math.max(0, Math.min(20, leitura));
      leitura = Number(leitura.toFixed(3));
    } else {
      leitura =
        ((valor - sensor.leituraVazio) /
          (sensor.leituraCheio - sensor.leituraVazio)) *
        sensor.capacidade;

      leitura = Math.max(0, Math.min(sensor.capacidade, leitura));
      leitura = Math.round(leitura);
    }

    dadosConvertidos[ref] = leitura;
  }

  dadosConvertidos.timestamp = new Date().toISOString();

  salvarDados(dadosConvertidos);
  registrarHistorico(dadosConvertidos);

  res.json({ status: "ok" });
});

// ============================================================================
//  /dados
// ============================================================================
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

// ============================================================================
//  Static
// ============================================================================
app.use(express.static(path.join(__dirname, "public")));

// ============================================================================
//  Start
// ============================================================================
app.listen(PORT, () => {
  console.log("🚀 Servidor ativo na porta " + PORT);
});
