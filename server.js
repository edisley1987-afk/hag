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

// ==============================
// ARQUIVO DE MANUTENÇÃO
// ==============================
const MANUT_FILE = path.join(__dirname, "manutencao.json");

if (!fs.existsSync(MANUT_FILE)) {
  fs.writeFileSync(MANUT_FILE, JSON.stringify({ bombas: {}, reservatorios: {}, pressoes: {} }, null, 2));
}

function loadManut() {
  try {
    return JSON.parse(fs.readFileSync(MANUT_FILE));
  } catch {
    return { bombas: {}, reservatorios: {}, pressoes: {} };
  }
}

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
// BANCO — DADOS PROCESSADOS
// ======================================================
let LAST_DATA = {
  lastUpdate: null,
  reservatorios: [],
  pressoes: [],
  bombas: []
};

// ==============================
// ROTA /gateway — PROCESSA DADOS
// ==============================
app.post("/gateway", (req, res) => {
  const payload = req.body;
  const manut = loadManut();

  if (!payload || !payload.data) {
    return res.status(400).json({ erro: "Formato inválido" });
  }

  // Funções de leitura das bombas, pressões e reservatórios
  function getBombaEstado(ref) {
    const entrada = payload.data.find(d => d.ref === ref);
    if (!entrada) return { estado_num: 0, estado: "desconhecido", ciclo: 0 };

    const bin = entrada.value === 1 ? "ligada" : "desligada";
    const cicloRef = ref.includes("01") ? "Ciclos_Bomba_01_counter" : "Ciclos_Bomba_02_counter";
    const ciclo = payload.data.find(d => d.ref === cicloRef)?.value || 0;

    return { estado_num: entrada.value, estado: bin, ciclo };
  }

  function ler(ref, cap) {
    const item = payload.data.find(d => d.ref === ref);
    if (!item) return { percent: null, current_liters: null, capacidade: cap };
    const litros = Math.round(item.value * cap);
    const percent = Math.round((litros / cap) * 100);
    return { percent, current_liters: litros, capacidade: cap };
  }

  function pressao(ref) {
    const item = payload.data.find(d => d.ref === ref);
    return item ? Number(item.value.toFixed(2)) : null;
  }

  LAST_DATA = {
    lastUpdate: new Date().toISOString(),
    reservatorios: [
      { nome: "Reservatório Elevador", setor: "elevador", ...ler("Reservatorio_Elevador_current", 20000), manutencao: manut.reservatorios?.elevador || false },
      { nome: "Reservatório Osmose", setor: "osmose", ...ler("Reservatorio_Osmose_current", 200), manutencao: manut.reservatorios?.osmose || false },
      { nome: "Reservatório CME", setor: "cme", ...ler("Reservatorio_CME_current", 1000), manutencao: manut.reservatorios?.cme || false },
      { nome: "Água Abrandada", setor: "abrandada", percent: null, current_liters: null, capacidade: 9000, manutencao: manut.reservatorios?.abrandada || false },
      { nome: "Lavanderia", setor: "lavanderia", ...ler("Reservatorio_lavanderia_current", 10000), manutencao: manut.reservatorios?.lavanderia || false }
    ],
    pressoes: [
      { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: pressao("Pressao_Saida_Osmose_current"), manutencao: manut.pressoes?.saida_osmose || false },
      { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: pressao("Pressao_Retorno_Osmose_current"), manutencao: manut.pressoes?.retorno_osmose || false },
      { nome: "Pressão Saída CME", setor: "saida_cme", pressao: pressao("Pressao_Saida_CME_current"), manutencao: manut.pressoes?.saida_cme || false }
    ],
    bombas: [
      { nome: "Bomba 01", ...getBombaEstado("Bomba_01_binary"), manutencao: manut.bombas?.bomba01 || false },
      { nome: "Bomba 02", ...getBombaEstado("Bomba_02_binary"), manutencao: manut.bombas?.bomba02 || false }
    ]
  };

  res.json({ ok: true });
});

// ==============================
// ROTA DE DADOS ATUAIS
// ==============================
app.get("/dados", (req, res) => {
  res.json(LAST_DATA);
});

// ==============================
// HISTÓRICO
// ==============================
const HIST_FILE = path.join(__dirname, "historico.json");

if (!fs.existsSync(HIST_FILE)) {
  fs.writeFileSync(HIST_FILE, JSON.stringify({ dias: {} }, null, 2));
}

app.get("/historico", (req, res) => {
  res.json(JSON.parse(fs.readFileSync(HIST_FILE)));
});

app.get("/consumo/5dias", (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(HIST_FILE)));
  } catch {
    res.json({});
  }
});

// ⬇ AGORA sim: arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// iniciar
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
