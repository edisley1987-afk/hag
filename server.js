// ======= Servidor Universal HAG - compatível com Gateway ITG, Render e WebSocket =======
// Versão estável ESModules + logs compatíveis com Render

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import http from "http";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

// === Corrigir __dirname no ESModules (ESSENCIAL NO RENDER) ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === Criar server HTTP (para anexar WebSocket) ===
const server = http.createServer(app);

// === LOG DE TEMPO POR REQUISIÇÃO ===
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} → ${ms}ms`);
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
if (!fs.existsSync(MANUT_FILE))
  fs.writeFileSync(MANUT_FILE, JSON.stringify({ ativo: false }, null, 2));

// ============================================================================
// 🔧 FUNÇÕES DE MANUTENÇÃO
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
// 🔥 TABELA DE SENSORES — RESERVATÓRIOS + PRESSÕES + BOMBAS (calibrações)
// ----------------------------------------------------------------------------
// Observação: Lavanderia leituraCheio corrigida para representar 100% (era 75%).
// ============================================================================
const SENSORES = {
  // Reservatórios (leituraVazio, leituraCheio, capacidade em litros)
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008742, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505,   leituraCheio: 0.006492, capacidade: 200 },
  "Reservatorio_CME_current":    { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004048, leituraCheio: 0.004229, capacidade: 9000 },
  // Lavanderia: leituraCheio corrigida para 100% = 0.012611 (já que 0.009458 = 75%)
  "Reservatorio_lavanderia_current": { leituraVazio: 0.006012, leituraCheio: 0.012611, capacidade: 1000 },

  // Pressões e bombas (tipos especiais)
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },

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
// - mantém pontos quando há variação relevante (2% da capacidade)
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
    if (!sensor || !sensor.capacidade) return;

    if (!historico[hoje][ref]) {
      historico[hoje][ref] = { min: valor, max: valor, pontos: [] };
    }
    const reg = historico[hoje][ref];
    reg.min = Math.min(reg.min, valor);
    reg.max = Math.max(reg.max, valor);

    const variacao = sensor.capacidade * 0.02; // 2% da capacidade em litros
    const ultimo = reg.pontos.at(-1);
    if (!ultimo || Math.abs(valor - ultimo.valor) >= variacao) {
      reg.pontos.push({ hora: new Date().toLocaleTimeString("pt-BR"), valor });
    }
  });

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// ============================================================================
// Conversões e utilitários
// ============================================================================
function calcularPercentualReservatorio(ref, leituraRaw) {
  const sensor = SENSORES[ref];
  if (!sensor || sensor.leituraVazio === undefined || sensor.leituraCheio === undefined) {
    return null;
  }
  const min = sensor.leituraVazio;
  const max = sensor.leituraCheio;
  // Proteção
  if (typeof leituraRaw !== "number" || Number.isNaN(leituraRaw)) return null;
  let pct = ((leituraRaw - min) / (max - min)) * 100;
  pct = Math.max(0, Math.min(100, pct));
  return Number(pct.toFixed(2));
}

function leituraParaLitros(ref, percentual) {
  const sensor = SENSORES[ref];
  if (!sensor || !sensor.capacidade) return null;
  const litros = (percentual / 100) * sensor.capacidade;
  return Math.round(litros);
}

function converterSensor(ref, valor) {
  const sensor = SENSORES[ref];
  if (!sensor) return valor;
  if (sensor.tipo === "pressao") {
    // mesma fórmula já usada: ((valor - 0.004) / 0.016) * 20 -> 0..20 bar
    let convertido = ((valor - 0.004) / 0.016) * 20;
    convertido = Math.max(0, Math.min(20, convertido));
    return Number(convertido.toFixed(2));
  } else if (sensor.tipo === "bomba") {
    return valor === 1 ? 1 : 0;
  } else if (sensor.tipo === "ciclo") {
    return Math.max(0, Math.round(valor));
  } else if (sensor.capacidade > 1) {
    // é reservatório: converte leitura analógica -> litros e % em outro local
    return Number(valor); // mantemos o raw aqui; cálculo posterior
  } else {
    return Number(valor);
  }
}

// ============================================================================
// Endpoint universal /atualizar
// - aceita POST/PUT/ALL com formato flexível
// ============================================================================
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  console.log(`➡️ Recebido ${req.method} em ${req.path}`);

  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    let dataArray = [];
    if (Array.isArray(body)) dataArray = body;
    else if (body && Array.isArray(body.data)) dataArray = body.data;
    else if (body && typeof body === "object") {
      // transforma objeto {ref: valor, ...} em [{ref, value}, ...]
      dataArray = Object.keys(body).map(k => ({ ref: k, value: Number(body[k]) }));
    }
    if (!dataArray.length) return res.status(400).json({ erro: "Nenhum dado válido encontrado" });

    let ultimo = {};
    if (fs.existsSync(DATA_FILE)) {
      try { ultimo = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); } catch {}
    }

    const dadosConvertidos = {};
    for (const item of dataArray) {
      const ref = item.ref;
      const valor = Number(item.value);
      if (!ref || isNaN(valor)) continue;

      const convertido = converterSensor(ref, valor);
      dadosConvertidos[ref] = convertido;
    }

    // 🔥 PATCH ANTI-NULL — mantém valores antigos se não vierem
    for (const ref in SENSORES) {
      if (dadosConvertidos[ref] === undefined && ultimo[ref] !== undefined) {
        dadosConvertidos[ref] = ultimo[ref];
      }
    }

    // timestamp
    dadosConvertidos.timestamp = new Date().toISOString();

    // Para reservatórios: converter raw -> percentual e litros
    for (const ref of Object.keys(SENSORES)) {
      const s = SENSORES[ref];
      if (s && s.capacidade > 1 && dadosConvertidos[ref] !== undefined) {
        const leituraRaw = Number(dadosConvertidos[ref]);
        const pct = calcularPercentualReservatorio(ref, leituraRaw);
        const litros = pct !== null ? leituraParaLitros(ref, pct) : null;
        // Armazenar com chaves legíveis (mantendo chaves originais para compatibilidade)
        dadosConvertidos[ref] = Number((litros !== null ? litros : leituraRaw)); // manter litro como valor principal (compat com anterior)
        // também adicionamos a versão percentual em campos auxiliares (não sobrescreve)
        dadosConvertidos[`${ref}_percent`] = pct;
        dadosConvertidos[`${ref}_liters`] = litros;
        dadosConvertidos[`${ref}_raw`] = leituraRaw;
      }
    }

    salvarDados(dadosConvertidos);
    registrarHistorico(dadosConvertidos);

    // Broadcast via WebSocket
    broadcastDashboard();

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ erro: err.message });
  }
});

// ============================================================================
// /dados (simples) - mantém compatibilidade
// ============================================================================
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  // Desabilitar cache
  res.setHeader("Cache-Control", "no-store");
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
        saida.push({ reservatorio: nome, timestamp: dt, valor: p.valor });
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

  const mapa = {
    elevador: "Reservatorio_Elevador_current",
    osmose: "Reservatorio_Osmose_current",
    lavanderia: "Reservatorio_lavanderia_current"
  };

  const ref = mapa[nome];
  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });

  if (!fs.existsSync(HIST_FILE)) return res.json([]);

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
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
      if (valores[i] < valores[i - 1]) {
        consumo += valores[i - 1] - valores[i];
      }
    }

    return { dia, consumo: Number(consumo.toFixed(2)) };
  });

  res.json(resposta);
});

// ============================================================================
// /api/consumo_diario
// ============================================================================
app.get("/api/consumo_diario", (req, res) => {
  const diasReq = Number(req.query.dias || 5);

  if (!fs.existsSync(HIST_FILE)) {
    return res.json({ dias: [], elevador: [], osmose: [], lavanderia: [] });
  }

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const dias = Object.keys(historico).sort().slice(-diasReq);

  function consumo(ref) {
    return dias.map(data => {
      const reg = historico[data][ref];
      if (!reg) return 0;

      const valores = [];
      if (typeof reg.min === "number") valores.push(reg.min);
      if (Array.isArray(reg.pontos)) reg.pontos.forEach(p => valores.push(p.valor));

      if (valores.length < 2) return 0;

      let total = 0;
      for (let i = 1; i < valores.length; i++) {
        if (valores[i] < valores[i - 1]) {
          total += valores[i - 1] - valores[i];
        }
      }
      return Number(total.toFixed(2));
    });
  }

  res.json({
    dias,
    elevador: consumo("Reservatorio_Elevador_current"),
    osmose: consumo("Reservatorio_Osmose_current"),
    lavanderia: consumo("Reservatorio_lavanderia_current")
  });
});

// ============================================================================
// /api/dashboard — RESUMO PRINCIPAL (formata com percent/litros)
// ============================================================================
app.get("/api/dashboard", (req, res) => {
  // desabilita cache
  res.setHeader("Cache-Control", "no-store");

  if (!fs.existsSync(DATA_FILE)) {
    return res.json({
      lastUpdate: "-",
      reservatorios: [],
      pressoes: [],
      bombas: [],
      manutencao: getManutencao().ativo
    });
  }

  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  // monta reservatórios com percent/liters (usa campos auxiliares se existirem)
  const reservatorios = [
    {
      nome: "Reservatório Elevador",
      setor: "elevador",
      percent: Math.round((dados["Reservatorio_Elevador_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_Elevador_current", dados["Reservatorio_Elevador_current"])) || 0),
      current_liters: Number(dados["Reservatorio_Elevador_current_liters"] ?? leituraParaLitros("Reservatorio_Elevador_current", calcularPercentualReservatorio("Reservatorio_Elevador_current", dados["Reservatorio_Elevador_current"])) || 0),
      capacidade: SENSORES["Reservatorio_Elevador_current"].capacidade,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Reservatório Osmose",
      setor: "osmose",
      percent: Math.round((dados["Reservatorio_Osmose_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_Osmose_current", dados["Reservatorio_Osmose_current"])) || 0),
      current_liters: Number(dados["Reservatorio_Osmose_current_liters"] ?? leituraParaLitros("Reservatorio_Osmose_current", calcularPercentualReservatorio("Reservatorio_Osmose_current", dados["Reservatorio_Osmose_current"])) || 0),
      capacidade: SENSORES["Reservatorio_Osmose_current"].capacidade,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Reservatório CME",
      setor: "cme",
      percent: Math.round((dados["Reservatorio_CME_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_CME_current", dados["Reservatorio_CME_current"])) || 0),
      current_liters: Number(dados["Reservatorio_CME_current_liters"] ?? leituraParaLitros("Reservatorio_CME_current", calcularPercentualReservatorio("Reservatorio_CME_current", dados["Reservatorio_CME_current"])) || 0),
      capacidade: SENSORES["Reservatorio_CME_current"].capacidade,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Água Abrandada",
      setor: "abrandada",
      percent: Math.round((dados["Reservatorio_Agua_Abrandada_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_Agua_Abrandada_current", dados["Reservatorio_Agua_Abrandada_current"])) || 0),
      current_liters: Number(dados["Reservatorio_Agua_Abrandada_current_liters"] ?? leituraParaLitros("Reservatorio_Agua_Abrandada_current", calcularPercentualReservatorio("Reservatorio_Agua_Abrandada_current", dados["Reservatorio_Agua_Abrandada_current"])) || 0),
      capacidade: SENSORES["Reservatorio_Agua_Abrandada_current"].capacidade,
      manutencao: getManutencao().ativo
    },
    {
      nome: "Lavanderia",
      setor: "lavanderia",
      percent: Math.round((dados["Reservatorio_lavanderia_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_lavanderia_current", dados["Reservatorio_lavanderia_current"])) || 0),
      current_liters: Number(dados["Reservatorio_lavanderia_current_liters"] ?? leituraParaLitros("Reservatorio_lavanderia_current", calcularPercentualReservatorio("Reservatorio_lavanderia_current", dados["Reservatorio_lavanderia_current"])) || 0),
      capacidade: SENSORES["Reservatorio_lavanderia_current"].capacidade,
      manutencao: getManutencao().ativo
    }
  ];

  const pressoes = [
    { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: dados["Pressao_Saida_Osmose_current"], manutencao: getManutencao().ativo },
    { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: dados["Pressao_Retorno_Osmose_current"], manutencao: getManutencao().ativo },
    { nome: "Pressão Saída CME", setor: "saida_cme", pressao: dados["Pressao_Saida_CME_current"], manutencao: getManutencao().ativo }
  ];

  const bombas = [
    { nome: "Bomba 01", estado_num: Number(dados["Bomba_01_binary"]) || 0, estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0, manutencao: getManutencao().ativo },
    { nome: "Bomba 02", estado_num: Number(dados["Bomba_02_binary"]) || 0, estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0, manutencao: getManutencao().ativo }
  ];

  res.json({ lastUpdate: dados.timestamp, reservatorios, pressoes, bombas, manutencao: getManutencao().ativo });
});

// ============================================================================
// Interface estática (mantém sua estrutura)
// ============================================================================
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (req, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// ============================================================================
// Keep Alive - rota ping
// ============================================================================
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// ============================================================================
// WebSocket: transmissões em tempo real
// - envia /api/dashboard para todos os clientes quando houver atualização
// - também envia heartbeat periódico caso queira manter UI sincronizada
// ============================================================================
const wss = new WebSocketServer({ server });

function buildDashboardSnapshot() {
  // reutiliza /api/dashboard logic (lê do arquivo)
  if (!fs.existsSync(DATA_FILE)) return { lastUpdate: "-", reservatorios: [], pressoes: [], bombas: [] };
  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  // montar mesma resposta do /api/dashboard (mais simples)
  const snapshot = {
    lastUpdate: dados.timestamp,
    reservatorios: [
      {
        nome: "Reservatório Elevador",
        setor: "elevador",
        percent: Math.round((dados["Reservatorio_Elevador_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_Elevador_current", dados["Reservatorio_Elevador_current"])) || 0),
        current_liters: Number(dados["Reservatorio_Elevador_current_liters"] ?? leituraParaLitros("Reservatorio_Elevador_current", calcularPercentualReservatorio("Reservatorio_Elevador_current", dados["Reservatorio_Elevador_current"])) || 0),
        capacidade: SENSORES["Reservatorio_Elevador_current"].capacidade
      },
      {
        nome: "Reservatório Osmose",
        setor: "osmose",
        percent: Math.round((dados["Reservatorio_Osmose_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_Osmose_current", dados["Reservatorio_Osmose_current"])) || 0),
        current_liters: Number(dados["Reservatorio_Osmose_current_liters"] ?? leituraParaLitros("Reservatorio_Osmose_current", calcularPercentualReservatorio("Reservatorio_Osmose_current", dados["Reservatorio_Osmose_current"])) || 0),
        capacidade: SENSORES["Reservatorio_Osmose_current"].capacidade
      },
      {
        nome: "Reservatório CME",
        setor: "cme",
        percent: Math.round((dados["Reservatorio_CME_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_CME_current", dados["Reservatorio_CME_current"])) || 0),
        current_liters: Number(dados["Reservatorio_CME_current_liters"] ?? leituraParaLitros("Reservatorio_CME_current", calcularPercentualReservatorio("Reservatorio_CME_current", dados["Reservatorio_CME_current"])) || 0),
        capacidade: SENSORES["Reservatorio_CME_current"].capacidade
      },
      {
        nome: "Água Abrandada",
        setor: "abrandada",
        percent: Math.round((dados["Reservatorio_Agua_Abrandada_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_Agua_Abrandada_current", dados["Reservatorio_Agua_Abrandada_current"])) || 0),
        current_liters: Number(dados["Reservatorio_Agua_Abrandada_current_liters"] ?? leituraParaLitros("Reservatorio_Agua_Abrandada_current", calcularPercentualReservatorio("Reservatorio_Agua_Abrandada_current", dados["Reservatorio_Agua_Abrandada_current"])) || 0),
        capacidade: SENSORES["Reservatorio_Agua_Abrandada_current"].capacidade
      },
      {
        nome: "Lavanderia",
        setor: "lavanderia",
        percent: Math.round((dados["Reservatorio_lavanderia_current_percent"] ?? calcularPercentualReservatorio("Reservatorio_lavanderia_current", dados["Reservatorio_lavanderia_current"])) || 0),
        current_liters: Number(dados["Reservatorio_lavanderia_current_liters"] ?? leituraParaLitros("Reservatorio_lavanderia_current", calcularPercentualReservatorio("Reservatorio_lavanderia_current", dados["Reservatorio_lavanderia_current"])) || 0),
        capacidade: SENSORES["Reservatorio_lavanderia_current"].capacidade
      }
    ],
    pressoes: [
      { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: dados["Pressao_Saida_Osmose_current"] },
      { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: dados["Pressao_Retorno_Osmose_current"] },
      { nome: "Pressão Saída CME", setor: "saida_cme", pressao: dados["Pressao_Saida_CME_current"] }
    ],
    bombas: [
      { nome: "Bomba 01", estado_num: Number(dados["Bomba_01_binary"]) || 0, estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_01_counter"]) || 0 },
      { nome: "Bomba 02", estado_num: Number(dados["Bomba_02_binary"]) || 0, estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada", ciclo: Number(dados["Ciclos_Bomba_02_counter"]) || 0 }
    ]
  };

  return snapshot;
}

function broadcastDashboard() {
  const snapshot = buildDashboardSnapshot();
  const payload = JSON.stringify({ type: "dashboard", data: snapshot });
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  });
}

wss.on("connection", (ws, req) => {
  console.log("WS cliente conectado");
  // Ao conectar, enviar snapshot atual
  ws.send(JSON.stringify({ type: "dashboard", data: buildDashboardSnapshot() }));

  ws.on("message", message => {
    // opcional: receber comandos do cliente no futuro
    try {
      const msg = JSON.parse(message.toString());
      // por enquanto, apenas log
      console.log("WS mensagem:", msg);
    } catch (e) {
      // ignorar
    }
  });

  ws.on("close", () => {
    console.log("WS cliente desconectou");
  });
});

// ============================================================================
// Keep Alive (evita que o Render durma) - faz self-ping
// - também mantém broadcast periódico para clientes WS
// ============================================================================
const SELF_URL = process.env.SELF_URL || "https://hag-9ki9.onrender.com"; // ajuste se precisar
const PING_INTERVAL_MS = 30 * 1000; // 30s
const BROADCAST_INTERVAL_MS = 1000; // 1s -> mantém UI atualizada em tempo real

setInterval(() => {
  // ping para manter instância ativa
  try {
    fetch(`${SELF_URL}/api/ping`)
      .then(() => console.log("Keep-alive enviado"))
      .catch(() => console.log("Falha ao enviar keep-alive"));
  } catch (e) {
    console.log("Erro ao enviar keep-alive:", e?.message || e);
  }
}, PING_INTERVAL_MS);

// Broadcast periódico (1s) para todos os clientes WS
setInterval(() => {
  broadcastDashboard();
}, BROADCAST_INTERVAL_MS);

// ============================================================================
// Inicialização
// ============================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor HAG (HTTP + WS) ativo na porta ${PORT}`);
});
