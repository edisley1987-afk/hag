// server.js
import express from "express";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Permitir JSON e form-urlencoded no POST
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------
// BANCO DE DADOS
// ------------------------------
const db = new sqlite3.Database("dados.db");

db.run(`
  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    valor REAL,
    datahora TEXT
  )
`);

// ------------------------------
// LISTA DOS DISPOSITIVOS VÁLIDOS
// ------------------------------
const dispositivos = {
  "Reservatorio_Osmose": { tipo: "litros" },
  "Reservatorio_Elevador": { tipo: "litros" },
  "Reservatorio_CME": { tipo: "litros" },
  "Reservatorio_Agua_Abrandada": { tipo: "litros" },

  "Pressao_Saida_Osmose": { tipo: "pressao" },
  "Pressao_Retorno_Osmose": { tipo: "pressao" },
  "Pressao_Saida_CME": { tipo: "pressao" }
};

const dadosAtuais = {};

// Remove sufixos como "_A"
function limparNome(nome) {
  return nome?.replace(/_A$/i, "") || "";
}

// -------------------------------------------
// FUNÇÃO CENTRAL: trata GET e POST em /update
// -------------------------------------------
function processarUpdate(req, res) {
  // Captura valores do GET (query) OU POST (body)
  let { name, litros, pressao } = req.method === "GET" ? req.query : req.body;

  if (!name) return res.status(400).send("Nome inválido");

  name = limparNome(name);

  if (!dispositivos[name]) {
    console.log("⚠ Dispositivo ignorado:", name);
    return res.status(400).send("Dispositivo não reconhecido");
  }

  const valor = litros ?? pressao ?? null;
  if (valor === null) return res.status(400).send("Valor ausente");

  const datahora = new Date().toLocaleString("pt-BR");

  // Salva no objeto atual
  dadosAtuais[name] = {
    valor: Number(valor),
    datahora
  };

  // Salva no banco
  db.run(
    "INSERT INTO registros (nome, valor, datahora) VALUES (?, ?, ?)",
    [name, valor, datahora]
  );

  console.log("Novo registro:", name, valor, datahora);
  res.json({ status: "OK", name, valor });
}

// -------------------------------------------
// Rota GET
// -------------------------------------------
app.get("/update", processarUpdate);

// -------------------------------------------
// Rota POST
// -------------------------------------------
app.post("/update", processarUpdate);

// ------------------------------
// ROTAS DO DASHBOARD
// ------------------------------
app.get("/current", (req, res) => {
  res.json(dadosAtuais);
});

app.get("/history", (req, res) => {
  const { nome } = req.query;
  if (!nome) return res.status(400).send("Nome requerido.");

  db.all(
    "SELECT * FROM registros WHERE nome=? ORDER BY id DESC LIMIT 200",
    [nome],
    (err, rows) => {
      if (err) return res.status(500).send("Erro no banco.");
      res.json(rows);
    }
  );
});

// ------------------------------
// SERVIR ARQUIVOS DO FRONTEND
// ------------------------------
app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/dashboard.html"));
});

// ------------------------------
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
