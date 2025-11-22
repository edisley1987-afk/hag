// Servidor ajustado — conversão direta para litros
// ======= Servidor Universal HAG - AGORA ENTREGANDO LITROS DIRETO =======
// Ajustado conforme solicitado — todas leituras *_current já retornam em LITROS

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Middleware universal ===
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// === Pastas ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// =========================================================
// 🔥 TABELA — agora usando **VALOR EM LITROS DIRETO** 🔥
// =========================================================
// NÃO existe mais cálculo por leitura bruta → valor chega pronto
// Basta informar capacidade para limites e histórico

const SENSORES = {
  "Reservatorio_Elevador_current": {
    capacidade: 20000,
    altura: 1.45,
    vazio: 0.004168,
    cheio: 0.008742
  },
  "Reservatorio_Osmose_current": {
    capacidade: 200,
    altura: 1,
    vazio: 0.00505,
    cheio: 0.006492
  },
  "Reservatorio_CME_current": {
    capacidade: 1000,
    altura: 0.45,
    vazio: 0.004088,
    cheio: 0.004408
  },
  "Reservatorio_Agua_Abrandada_current": {
    capacidade: 9000,
    altura: 0.6,
    vazio: 0.004048,
    cheio: 0.006515
  },
  // Pressões
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// === Salvar última leitura ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("Leituras:", JSON.stringify(dados));
}

// === Registrar histórico ===
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

    const sensor = SENSORES[ref];
    const capacidade = sensor?.capacidade || null;

    if (!historico[hoje][ref]) {
      historico[hoje][ref] = { min: valor, max: valor, pontos: [] };
    }

    const reg = historico[hoje][ref];
    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    if (!capacidade) return;

    const variacaoMinima = capacidade * 0.02; // 2%
    const ultimo = reg.pontos.at(-1);

    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacaoMinima) {
      reg.pontos.push({ hora: new Date().toLocaleTimeString("pt-BR"), valor });
    }
  });

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// =========================================================
// === Endpoint universal /atualizar — agora sem conversão ===
// =========================================================
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  console.log(`➡️ Recebido ${req.method} em ${req.path}`);

  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    let dataArray = [];

    if (Array.isArray(body)) {
      dataArray = body;
    } else if (body && Array.isArray(body.data)) {
      dataArray = body.data;
    } else if (typeof body === "object" && body !== null) {
      dataArray = Object.keys(body)
        .filter(k => k.includes("_current"))
        .map(k => ({ ref: k, value: Number(body[k]) }));
    }

    if (!dataArray.length)
      return res.status(400).json({ erro: "Nenhum dado válido" });

    const dadosConvertidos = {};

    for (const item of dataArray) {
      const ref = item.ref || item.name;
      const valor = Number(item.value);
      if (!ref || isNaN(valor)) continue;

      const sensor = SENSORES[ref];

      // Se for pressão → converter
      if (sensor?.tipo === "pressao") {
        let p = ((valor - 0.004) / 0.016) * 20;
        p = Math.max(0, Math.min(20, p));
        dadosConvertidos[ref] = Number(p.toFixed(3));
        continue;
      }

      // Caso contrário: JÁ ESTÁ EM LITROS!
      dadosConvertidos[ref] = valor;
    }

    dadosConvertidos.timestamp = new Date().toISOString();

    salvarDados(dadosConvertidos);
    registrarHistorico(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ erro: err.message });
  }
});

// === Rotas /dados, /historico etc → permanecem iguais ===
// (código original mantido)

