// ============================================================================
//  SERVER.JS — VERSÃO COMPLETA E ATUALIZADA
// ============================================================================

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================================
//  ARQUIVOS EM DISCO
// ============================================================================

const DATA_FILE = path.join(__dirname, "dados.json");
const HIST_FILE = path.join(__dirname, "historico.json");
const CONSUMO_FILE = path.join(__dirname, "consumo.json");

// Garantir arquivos criados
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");
if (!fs.existsSync(HIST_FILE)) fs.writeFileSync(HIST_FILE, "{}");
if (!fs.existsSync(CONSUMO_FILE)) fs.writeFileSync(CONSUMO_FILE, "{}");

// ============================================================================
//  MAPA DE RESERVATÓRIOS (Mesmo usado no dashboard e histórico)
// ============================================================================

const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Abrandada_current"
};

// ============================================================================
//  SERVIR ARQUIVOS ESTÁTICOS
// ============================================================================
app.use(express.static(path.join(__dirname, "public")));

// ============================================================================
//  ROTA: RECEBER DADOS DO GATEWAY LoRaWAN
// ============================================================================

app.post("/api/dados", (req, res) => {
  let dados = req.body;

  if (!Array.isArray(dados)) {
    dados = [dados];
  }

  const existentes = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  dados.forEach(item => existentes.push(item));

  fs.writeFileSync(DATA_FILE, JSON.stringify(existentes, null, 2));

  res.json({ status: "ok" });
});

// ============================================================================
//  ROTA: FORNECE ÚLTIMAS LEITURAS PARA O DASHBOARD
// ============================================================================

app.get("/dados", (req, res) => {
  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const ultimos = {};

  dados.forEach(item => {
    ultimos[item.ref] = item.value;
  });

  res.json(ultimos);
});

// ============================================================================
//  HISTÓRICO — SALVAMENTO AUTOMÁTICO (chamado pelo dashboard)
// ============================================================================

app.post("/api/historico", (req, res) => {
  const { reservatorio, valor, hora, data } = req.body;

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));

  if (!historico[data]) historico[data] = {};
  if (!historico[data][reservatorio]) historico[data][reservatorio] = { min: valor, max: valor, pontos: [] };

  historico[data][reservatorio].pontos.push({ hora, valor });

  if (valor < historico[data][reservatorio].min) historico[data][reservatorio].min = valor;
  if (valor > historico[data][reservatorio].max) historico[data][reservatorio].max = valor;

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));

  res.json({ status: "ok" });
});

// ============================================================================
//  *** NOVA ROTA ***  → usada pelo historico.js
//  /dados-historico?reservatorio=x&data=YYYY-MM-DD
// ============================================================================

app.get("/dados-historico", (req, res) => {
  const { reservatorio, data } = req.query;

  if (!reservatorio || !data) {
    return res.status(400).json({ erro: "Parâmetros inválidos" });
  }

  if (!fs.existsSync(HIST_FILE)) {
    return res.json([]);
  }

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const ref = MAPA_RESERVATORIOS[reservatorio];

  if (!ref) return res.status(400).json({ erro: "Reservatório desconhecido" });

  const dadosDia = historico[data]?.[ref];

  if (!dadosDia) return res.json([]);

  const lista = [];

  // Ponto mínimo
  if (typeof dadosDia.min === "number") {
    lista.push({ hora: "00:00", valor: dadosDia.min });
  }

  // Pontos salvos
  (dadosDia.pontos || []).forEach(p => lista.push({ hora: p.hora, valor: p.valor }));

  // Ordenar
  lista.sort((a, b) => a.hora.localeCompare(b.hora));

  res.json(lista);
});

// ============================================================================
//  CONSUMO DIÁRIO — ROTA DIRETA
// ============================================================================

app.get("/api/consumo", (req, res) => {
  const consumo = JSON.parse(fs.readFileSync(CONSUMO_FILE, "utf-8"));
  res.json(consumo);
});

// ============================================================================
//  INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
