// === server.js ===

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Diretório /public
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// ===== BANCO EM MEMÓRIA ===== //
let historico = [];

// Capacidade individual
const capacidade = {
  Reservatorio_Osmose: 10000,
  Reservatorio_Elevador: 9000,
  Reservatorio_CME: 6000,
  Reservatorio_Agua_Abrandada: 8000
};

// ===== FUNÇÃO PARA CALCULAR % ===== //
function calcPercent(name, litros) {
  if (!capacidade[name]) return 0;
  return Math.min(100, Math.max(0, (litros / capacidade[name]) * 100));
}

// ===== ROTA DE UPDATE ===== //
app.get("/update", (req, res) => {
  const { name, litros, pressao } = req.query;

  if (!name) {
    return res.status(400).send("Erro: name é obrigatório.");
  }

  let litrosFinal = null;
  let pressaoFinal = null;

  if (litros !== undefined) {
    const n = Number(litros);
    litrosFinal = Number((n * 10000).toFixed(0));
  }

  if (pressao !== undefined) {
    const p = Number(pressao);
    pressaoFinal = Number((p * 10).toFixed(2));
  }

  const registro = {
    name,
    litros: litrosFinal,
    pressao: pressaoFinal,
    porcentagem: litrosFinal ? calcPercent(name, litrosFinal) : null,
    dataHora: new Date().toLocaleString("pt-BR")
  };

  historico.push(registro);
  console.log("Novo registro:", registro);

  return res.send("OK");
});

// ===== ROTA PARA LISTAR DISPOSITIVOS ===== //
app.get("/dispositivos", (req, res) => {
  const lista = [
    "Reservatorio_Osmose",
    "Pressao_Saida_Osmose",
    "Pressao_Retorno_Osmose",
    "Reservatorio_Elevador",
    "Reservatorio_CME",
    "Pressao_Saida_CME",
    "Reservatorio_Agua_Abrandada"
  ];
  res.json(lista);
});

// ===== ÚLTIMAS LEITURAS ===== //
app.get("/ultimos", (req, res) => {
  const ultimos = {};

  for (let item of historico) {
    ultimos[item.name] = item;
  }

  res.json(ultimos);
});

// ===== HISTÓRICO POR DISPOSITIVO ===== //
app.get("/historico/:name", (req, res) => {
  const { name } = req.params;
  const dados = historico.filter(x => x.name === name);
  res.json(dados);
});

// ===== CONSUMO DIÁRIO ===== //
app.get("/consumo", (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).send("name obrigatório");

  const registros = historico.filter(x => x.name === name);

  const mapa = {};

  for (let r of registros) {
    const dia = r.dataHora.split(" ")[0];
    if (!mapa[dia]) mapa[dia] = 0;
    if (r.litros) mapa[dia] += r.litros;
  }

  res.json(mapa);
});

// ===== SERVIR HTML ===== //
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== INICIAR SERVIDOR ===== //
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("Servidor rodando na porta " + PORT)
);
