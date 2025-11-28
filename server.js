// ==============================
// Servidor Universal HAG
// ==============================

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// PASTA PUBLIC DO FRONTEND
app.use(express.static(path.join(__dirname, "public")));

// ==============================
// ARQUIVO DE MANUTENÇÃO
// ==============================
const MANUT_FILE = path.join(__dirname, "manutencao.json");

// Garante que o arquivo existe
if (!fs.existsSync(MANUT_FILE)) {
  fs.writeFileSync(MANUT_FILE, JSON.stringify({ bombas: {}, reservatorios: {}, pressoes: {} }, null, 2));
}

// Função para carregar manutenção
function loadManut() {
  try {
    const data = fs.readFileSync(MANUT_FILE);
    return JSON.parse(data);
  } catch (e) {
    return { bombas: {}, reservatorios: {}, pressoes: {} };
  }
}

// Função para salvar manutenção
function saveManut(data) {
  fs.writeFileSync(MANUT_FILE, JSON.stringify(data, null, 2));
}

// ==============================
// ROTA GET — RETORNAR MANUTENÇÃO
// ==============================
app.get("/manutencao", (req, res) => {
  res.json(loadManut());
});

// ==============================
// ROTA POST — SALVAR MANUTENÇÃO
// ==============================
// Salva para TODOS os usuários, não apenas para um usuário local
app.post("/manutencao", (req, res) => {
  const manut = loadManut();
  const { tipo, chave, valor } = req.body;

  if (!tipo || !chave) {
    return res.status(400).json({ erro: "Campos obrigatórios: tipo e chave" });
  }

  if (!manut[tipo]) manut[tipo] = {};
  manut[tipo][chave] = valor;

  saveManut(manut);

  res.json({ ok: true, manutencao: manut });
});

// ======================================================
// BANCO TEMPORÁRIO — valores processados mais recentes
// ======================================================
let LAST_DATA = {
  lastUpdate: null,
  reservatorios: [],
  pressoes: [],
  bombas: []
};

// ==============================
// PROCESSAMENTO DAS LEITURAS DO GATEWAY ITG200
// ==============================
app.post("/gateway", (req, res) => {
  const payload = req.body;

  if (!payload || !payload.data) {
    return res.status(400).json({ erro: "Formato inválido" });
  }

  const manut = loadManut(); // carrega manutenção

  // ----------- BOMBAS -----------
  function getBombaEstado(ref) {
    const entrada = payload.data.find(d => d.ref === ref);
    if (!entrada) return { estado_num: 0, estado: "desconhecido", ciclo: 0 };

    const bin = entrada.value === 1 ? "ligada" : "desligada";

    // Buscar ciclos
    const cicloRef = ref.includes("01") ? "Ciclos_Bomba_01_counter" : "Ciclos_Bomba_02_counter";
    const ciclo = payload.data.find(d => d.ref === cicloRef)?.value || 0;

    return {
      estado_num: entrada.value,
      estado: bin,
      ciclo
    };
  }

  const bomba1 = getBombaEstado("Bomba_01_binary");
  const bomba2 = getBombaEstado("Bomba_02_binary");

  // ----------- RESERVATÓRIOS -----------
  function ler(ref, cap) {
    const item = payload.data.find(d => d.ref === ref);
    if (!item) return { percent: null, current_liters: null, capacidade: cap };
    const litros = Math.round(item.value * cap);
    const percent = Math.round((litros / cap) * 100);
    return { percent, current_liters: litros, capacidade: cap };
  }

  const reservElev = ler("Reservatorio_Elevador_current", 20000);
  const reservOsmose = ler("Reservatorio_Osmose_current", 200);
  const reservCME = ler("Reservatorio_CME_current", 1000);
  const reservLav = ler("Reservatorio_lavanderia_current", 10000);
  const reservAbrand = { percent: null, current_liters: null, capacidade: 9000 };

  // ----------- PRESSÕES -----------
  function pressao(ref) {
    const item = payload.data.find(d => d.ref === ref);
    return item ? Number(item.value.toFixed(2)) : null;
  }

  const pressao_saida_osm = pressao("Pressao_Saida_Osmose_current");
  const pressao_ret_osm = pressao("Pressao_Retorno_Osmose_current");
  const pressao_saida_cme = pressao("Pressao_Saida_CME_current");

  // SALVA OS DADOS PROCESSADOS
  LAST_DATA = {
    lastUpdate: new Date().toISOString(),
    reservatorios: [
      { nome: "Reservatório Elevador", setor: "elevador", ...reservElev, manutencao: manut.reservatorios?.elevador || false },
      { nome: "Reservatório Osmose", setor: "osmose", ...reservOsmose, manutencao: manut.reservatorios?.osmose || false },
      { nome: "Reservatório CME", setor: "cme", ...reservCME, manutencao: manut.reservatorios?.cme || false },
      { nome: "Água Abrandada", setor: "abrandada", ...reservAbrand, manutencao: manut.reservatorios?.abrandada || false },
      { nome: "Lavanderia", setor: "lavanderia", ...reservLav, manutencao: manut.reservatorios?.lavanderia || false }
    ],
    pressoes: [
      { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: pressao_saida_osm, manutencao: manut.pressoes?.saida_osmose || false },
      { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: pressao_ret_osm, manutencao: manut.pressoes?.retorno_osmose || false },
      { nome: "Pressão Saída CME", setor: "saida_cme", pressao: pressao_saida_cme, manutencao: manut.pressoes?.saida_cme || false }
    ],
    bombas: [
      { nome: "Bomba 01", ...bomba1, manutencao: manut.bombas?.bomba01 || false },
      { nome: "Bomba 02", ...bomba2, manutencao: manut.bombas?.bomba02 || false }
    ]
  };

  res.json({ ok: true });
});

// ==============================
// ROTA GET — RETORNAR OS DADOS ATUAIS
// ==============================
app.get("/dados", (req, res) => {
  res.json(LAST_DATA);
});

// ==============================
// ROTA DE HISTÓRICO
// ==============================
const HIST_FILE = path.join(__dirname, "historico.json");

if (!fs.existsSync(HIST_FILE)) {
  fs.writeFileSync(HIST_FILE, JSON.stringify({ dias: {} }, null, 2));
}

app.get("/historico", (req, res) => {
  const hist = JSON.parse(fs.readFileSync(HIST_FILE));
  res.json(hist);
});

// ==============================
// ROTA DE CONSUMO (5 dias)
// ==============================
app.get("/consumo/5dias", (req, res) => {
  try {
    const hist = JSON.parse(fs.readFileSync(HIST_FILE, "utf8"));
    res.json(hist);
  } catch {
    res.json({});
  }
});

// ==============================
// ROTA FALLBACK — FRONTEND
// ==============================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==============================
// INICIAR SERVIDOR
// ==============================
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
