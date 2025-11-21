// ======= Servidor Universal HAG - compatível com Gateway ITG e Render =======
// Versão estável ESModules + logs compatíveis com Render

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Middleware universal (aceita qualquer formato do Gateway) ===
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

// === Tabela de sensores calibrados ===
const SENSORES = {
  "Reservatorio_Elevador_current": {
    leituraVazio: 0.004168,
    leituraCheio: 0.008400,
    capacidade: 20000
  },
  "Reservatorio_Osmose_current": {
    leituraVazio: 0.00505,
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

  // Sensores de pressão
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// === Função para salvar última leitura ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("Leituras:", JSON.stringify(dados));
}

// ============================================================================
// === Função registrarHistorico() — REGISTRO REAL COM VARIAÇÃO > 2% ==========
// ============================================================================

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
      historico[hoje][ref] = {
        min: valor,
        max: valor,
        pontos: []
      };
    }

    const reg = historico[hoje][ref];

    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    if (!capacidade || capacidade <= 1) return;

    const variacaoMinima = capacidade * 0.02;
    const ultimo = reg.pontos.at(-1);

    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacaoMinima) {
      reg.pontos.push({
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor: valor
      });
    }
  });

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// === Endpoint universal do Gateway /atualizar ===
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  console.log(`➡️ Recebido ${req.method} em ${req.path}`);

  try {
    let body = req.body;

    if (Buffer.isBuffer(body)) body = body.toString("utf8");

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        console.log("Corpo não JSON:", body.slice(0, 200));
      }
    }

    let dataArray = [];

    if (Array.isArray(body)) {
      dataArray = body;
    } else if (body && Array.isArray(body.data)) {
      dataArray = body.data;
    } else if (typeof body === "object" && body !== null) {
      dataArray = Object.keys(body)
        .filter((k) => k.includes("_current"))
        .map((k) => ({ ref: k, value: Number(body[k]) }));
    }

    if (!dataArray.length) {
      console.warn("Nenhum dado válido:", body);
      return res.status(400).json({ erro: "Nenhum dado válido encontrado" });
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

      const { leituraVazio, leituraCheio, capacidade, tipo } = sensor;

      let leituraConvertida;

      if (tipo === "pressao") {
        leituraConvertida = ((valor - 0.004) / 0.016) * 20;
        leituraConvertida = Math.max(0, Math.min(20, leituraConvertida));
        leituraConvertida = Number(leituraConvertida.toFixed(3));
      } else if (capacidade > 1) {
        leituraConvertida =
          ((valor - leituraVazio) / (leituraCheio - leituraVazio)) *
          capacidade;

        leituraConvertida = Math.max(0, Math.min(capacidade, leituraConvertida));
        leituraConvertida = Math.round(leituraConvertida);
      } else {
        leituraConvertida = Number(valor.toFixed(5));
      }

      dadosConvertidos[ref] = leituraConvertida;
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

// === Endpoints de API ===
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

// ========================================================================
//  🔥 SUBSTITUTO DO /historico ANTIGO — AGORA NO FORMATO QUE O FRONT ESPERA
// ========================================================================
app.get("/historico", (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json([]);

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const saida = [];

  for (const [data, sensores] of Object.entries(historico)) {
    for (const [ref, dados] of Object.entries(sensores)) {
      const nome = Object.keys(MAPA_RESERVATORIOS)
        .find(key => MAPA_RESERVATORIOS[key] === ref);

      if (!nome) continue;

      if (typeof dados.min === "number") {
        saida.push({
          reservatorio: nome,
          timestamp: new Date(data).getTime(),
          valor: dados.min
        });
      }

      for (const p of dados.pontos || []) {
        const dt = new Date(`${data} ${p.hora}`);
        saida.push({
          reservatorio: nome,
          timestamp: dt.getTime(),
          valor: p.valor
        });
      }
    }
  }

  saida.sort((a, b) => a.timestamp - b.timestamp);

  res.json(saida);
});

// ========================================================================
//   🔥 SUBSTITUTO DO /historico/24h — FORMATO SIMPLES PARA O FRONT
// ========================================================================
const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current"
};

app.get("/historico/24h/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();
  const ref = MAPA_RESERVATORIOS[nome];

  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });

  if (!fs.existsSync(HIST_FILE)) return res.json([]);

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const agora = Date.now();
  const saida = [];

  for (const [data, sensores] of Object.entries(historico)) {
    const pontos = sensores[ref]?.pontos || [];

    for (const p of pontos) {
      const dt = new Date(`${data} ${p.hora}`).getTime();

      if (agora - dt <= 24 * 60 * 60 * 1000) {
        saida.push({
          reservatorio: nome,
          timestamp: dt,
          valor: p.valor
        });
      }
    }
  }

  saida.sort((a, b) => a.timestamp - b.timestamp);

  res.json(saida);
});

// === Interface estática ===
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

// === Inicialização ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor HAG ativo na porta ${PORT}`);
});
