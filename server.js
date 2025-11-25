// ============================================================================
//  SERVER.JS — VERSÃO ES MODULE (IMPORT / EXPORT) COMPATÍVEL COM RENDER
// ============================================================================

import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";

// Corrigir __dirname no ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");
if (!fs.existsSync(HIST_FILE)) fs.writeFileSync(HIST_FILE, "{}");
if (!fs.existsSync(CONSUMO_FILE)) fs.writeFileSync(CONSUMO_FILE, "{}");

// ============================================================================
//  MAPA
// ============================================================================
const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Abrandada_current"
};

// ============================================================================
//  STATIC
// ============================================================================
app.use(express.static(path.join(__dirname, "public")));

// ============================================================================
//  POST /api/dados
// ============================================================================
app.post("/api/dados", (req, res) => {
  let dados = req.body;
  if (!Array.isArray(dados)) dados = [dados];

  const existentes = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  existentes.push(...dados);

  fs.writeFileSync(DATA_FILE, JSON.stringify(existentes, null, 2));
  res.json({ status: "ok" });
});

// ============================================================================
//  GET /dados
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
//  POST /api/historico
// ============================================================================
app.post("/api/historico", (req, res) => {
  const { reservatorio, valor, hora, data } = req.body;

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));

  if (!historico[data]) historico[data] = {};
  if (!historico[data][reservatorio])
    historico[data][reservatorio] = { min: valor, max: valor, pontos: [] };

  historico[data][reservatorio].pontos.push({ hora, valor });

  if (valor < historico[data][reservatorio].min) historico[data][reservatorio].min = valor;
  if (valor > historico[data][reservatorio].max) historico[data][reservatorio].max = valor;

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
  res.json({ status: "ok" });
});

// ============================================================================
//  GET /dados-historico
// ============================================================================
app.get("/dados-historico", (req, res) => {
  const { reservatorio, data } = req.query;

  if (!reservatorio || !data) return res.status(400).json({ erro: "Parâmetros inválidos" });

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));

  const ref = MAPA_RESERVATORIOS[reservatorio];
  if (!ref) return res.status(400).json({ erro: "Reservatório inválido" });

  const dadosDia = historico[data]?.[ref];
  if (!dadosDia) return res.json([]);

  const lista = [];

  // mínimo
  if (typeof dadosDia.min === "number") {
    lista.push({ hora: "00:00", valor: dadosDia.min });
  }

  // pontos
  (dadosDia.pontos || []).forEach(p => lista.push({ hora: p.hora, valor: p.valor }));

  lista.sort((a, b) => a.hora.localeCompare(b.hora));

  res.json(lista);
});

// ============================================================================
//  GET /api/consumo
// ============================================================================
app.get("/api/consumo", (req, res) => {
  const consumo = JSON.parse(fs.readFileSync(CONSUMO_FILE, "utf-8"));
  res.json(consumo);
});

// ============================================================================
//  INICIA O SERVIDOR
// ============================================================================
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
