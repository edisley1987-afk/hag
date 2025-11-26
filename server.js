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

// ============================================================================
// 🔥 TABELA DE SENSORES — RESERVATÓRIOS + PRESSÕES + BOMBAS
// ============================================================================

const SENSORES = {
  // ======== RESERVATÓRIOS ========
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
    // <-- corrigido: leituraCheio ajustada para 0.004229 conforme tabela fornecida
    leituraVazio: 0.004048,
    leituraCheio: 0.004229,
    capacidade: 9000
  },

  // 🔥🔥🔥 LAVANDERIA
  "Reservatorio_lavanderia_current": {
    leituraVazio: 0.006012,
    leituraCheio: 0.010541,
    capacidade: 10000
  },

  // ======== PRESSÕES ========
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },

  // ======== BOMBAS CORRIGIDAS ========
  "Bomba_01_binary": { tipo: "bomba" },
  "Ciclos_Bomba_01_counter": { tipo: "ciclo" },
  "Bomba_02_binary": { tipo: "bomba" },
  "Ciclos_Bomba_02_counter": { tipo: "ciclo" }
};

// === Função para salvar última leitura ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("Leituras:", JSON.stringify(dados));
}

// ============================================================================
// registrarHistorico()
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
    if (ref === "timestamp") return;

    const sensor = SENSORES[ref];

    if (!sensor) return;
    if (!sensor.capacidade) return;

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

    const variacao = sensor.capacidade * 0.02;
    const ultimo = reg.pontos.at(-1);

    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
      reg.pontos.push({
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor
      });
    }
  });

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// ============================================================================
// Endpoint universal /atualizar
// ============================================================================

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
    } else if (body && typeof body === "object") {
      dataArray = Object.keys(body).map(k => ({
        ref: k,
        value: Number(body[k])
      }));
    }

    if (!dataArray.length) {
      return res.status(400).json({ erro: "Nenhum dado válido encontrado" });
    }

    // ---------------------------------------------
    // 🔥 PATCH ANTI-NULL
    // ---------------------------------------------
    let ultimo = {};
    if (fs.existsSync(DATA_FILE)) {
      try {
        ultimo = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      } catch {}
    }
    // ---------------------------------------------

    const dadosConvertidos = {};

    for (const item of dataArray) {
      const ref = item.ref;
      const valor = Number(item.value);

      if (!ref || isNaN(valor)) continue;

      const sensor = SENSORES[ref];

      if (!sensor) {
        dadosConvertidos[ref] = valor;
        continue;
      }

      let convertido = valor;

      // PRESSÃO
      if (sensor.tipo === "pressao") {
        convertido = ((valor - 0.004) / 0.016) * 20;
        convertido = Math.max(0, Math.min(20, convertido));
        convertido = Number(convertido.toFixed(2));
      }

      // BOMBA
      else if (sensor.tipo === "bomba") {
        convertido = valor === 1 ? 1 : 0;
      }

      // CICLO
      else if (sensor.tipo === "ciclo") {
        convertido = Math.max(0, Math.round(valor));
      }

      // RESERVATÓRIO
      else if (sensor.capacidade > 1) {
        convertido =
          ((valor - sensor.leituraVazio) /
            (sensor.leituraCheio - sensor.leituraVazio)) *
          sensor.capacidade;

        convertido = Math.max(0, Math.min(sensor.capacidade, convertido));
        convertido = Math.round(convertido);
      }

      dadosConvertidos[ref] = convertido;
    }

    // ---------------------------------------------
    // 🔥 PATCH ANTI-NULL — MANTÉM VALORES ANTIGOS SE NÃO VIERAM NA REQUISIÇÃO
    // ---------------------------------------------
    for (const ref in SENSORES) {
      if (dadosConvertidos[ref] === undefined && ultimo[ref] !== undefined) {
        dadosConvertidos[ref] = ultimo[ref];
      }
    }
    // ---------------------------------------------

    dadosConvertidos.timestamp = new Date().toISOString();

    salvarDados(dadosConvertidos);
    registrarHistorico(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ erro: err.message });
  }
});

// ============================================================================
// /dados
// ============================================================================

app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

// ============================================================================
// /historico
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
    for (const [ref, dados] of Object.entries(sensores)) {
      const nome = Object.keys(MAPA_RESERVATORIOS).find(
        key => MAPA_RESERVATORIOS[key] === ref
      );

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

// ============================================================================
// /historico/24h/:reservatorio
// ============================================================================

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

// ============================================================================
// /consumo/5dias/:reservatorio
// ============================================================================

app.get("/consumo/5dias/:reservatorio", (req, res) => {
  const nome = req.params.reservatorio.toLowerCase();
  const ref = MAPA_RESERVATORIOS[nome];

  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });
  if (!fs.existsSync(HIST_FILE)) return res.json([]);

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const dias = [];

  for (const [data, sensores] of Object.entries(historico)) {
    const reg = sensores[ref];
    if (!reg) continue;

    const valores = [];

    if (typeof reg.min === "number") valores.push(reg.min);
    if (Array.isArray(reg.pontos)) reg.pontos.forEach(p => valores.push(p.valor));

    if (valores.length >= 2) {
      dias.push({
        dia: data,
        consumo: valores[0] - valores[valores.length - 1]
      });
    }
  }

  dias.sort((a, b) => a.dia.localeCompare(b.dia));

  const ultimos5 = dias.slice(-5).map(d => ({
    dia: d.dia,
    consumo: Number(d.consumo.toFixed(2))
  }));

  res.json(ultimos5);
});

// ============================================================================
// /api/consumo — usado pelo dashboard
// ============================================================================

app.get("/api/consumo", (req, res) => {
  const qtdDias = Number(req.query.dias || 5);

  if (!fs.existsSync(HIST_FILE)) {
    return res.json({
      dias: [],
      elevador: [],
      osmose: [],
      lavanderia: []
    });
  }

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const dias = Object.keys(historico).sort().slice(-qtdDias);

  function calcularConsumo(ref) {
    return dias.map(data => {
      const dia = historico[data][ref];
      if (!dia) return 0;

      const valores = [];

      if (typeof dia.min === "number") valores.push(dia.min);
      if (Array.isArray(dia.pontos)) dia.pontos.forEach(p => valores.push(p.valor));

      if (valores.length < 2) return 0;

      return Number((valores[0] - valores[valores.length - 1]).toFixed(2));
    });
  }

  res.json({
    dias,
    elevador: calcularConsumo("Reservatorio_Elevador_current"),
    osmose: calcularConsumo("Reservatorio_Osmose_current"),
    lavanderia: calcularConsumo("Reservatorio_lavanderia_current")
  });
});

// ============================================================================
// /api/dashboard — resumo usado no dashboard
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
      percent: Math.round((dados["Reservatorio_Elevador_current"] / 20000) * 100),
      current_liters: dados["Reservatorio_Elevador_current"],
      capacidade: 20000,
      manutencao: false
    },
    {
      nome: "Reservatório Osmose",
      setor: "osmose",
      percent: Math.round((dados["Reservatorio_Osmose_current"] / 200) * 100),
      current_liters: dados["Reservatorio_Osmose_current"],
      capacidade: 200,
      manutencao: false
    },
    {
      nome: "Reservatório CME",
      setor: "cme",
      percent: Math.round((dados["Reservatorio_CME_current"] / 1000) * 100),
      current_liters: dados["Reservatorio_CME_current"],
      capacidade: 1000,
      manutencao: false
    },
    {
      nome: "Água Abrandada",
      setor: "abrandada",
      percent: Math.round((dados["Reservatorio_Agua_Abrandada_current"] / 9000) * 100),
      current_liters: dados["Reservatorio_Agua_Abrandada_current"],
      capacidade: 9000,
      manutencao: false
    },
    {
      nome: "Lavanderia",
      setor: "lavanderia",
      percent: Math.round((dados["Reservatorio_lavanderia_current"] / 10000) * 100),
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

  // 🔥🔥🔥 CORREÇÃO OFICIAL DAS BOMBAS — 100% precisa
  const bombas = [
    {
      nome: "Bomba 01",
      estado_num: Number(dados["Bomba_01_binary"]) || 0,
      estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada",
      ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0
    },
    {
      nome: "Bomba 02",
      estado_num: Number(dados["Bomba_02_binary"]) || 0,
      estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada",
      ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0
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
  console.log(`Servidor HAG ativo na porta ${PORT}`);
});
