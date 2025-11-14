// ======= Servidor Universal HAG =======
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ===============================
// SERVE A PASTA PUBLIC CORRETAMENTE
// ===============================
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
}));

// ===============================
// ROTAS MANUAIS PARA GARANTIR QUE CARREGA OS HTML CORRETOS
// ===============================
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/historico", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "historico.html"));
});

app.get("/consumo", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "consumo.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ===============================
// ARQUIVOS DE DADOS
// ===============================
const DATA_DIR = path.join(__dirname, "data");
const HISTORICO_FILE = path.join(DATA_DIR, "historico.json");
const CONSUMO_FILE = path.join(DATA_DIR, "consumo.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ===============================
// DADOS ATUAIS (USADO PELO DASHBOARD)  <<<<<< AQUI FOI CORRIGIDO
// ===============================
let dadosAtuais = {};

// Recebe dados do ESP32 / Arduino
app.post("/dados", (req, res) => {
  try {
    dadosAtuais = req.body;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao registrar dados" });
  }
});

// Envia dados atuais para o dashboard
app.get("/dados", (req, res) => {
  res.json(dadosAtuais);
});

// ===============================
// SALVAR HISTÓRICO DE LEITURAS
// ===============================
app.post("/salvar_historico", (req, res) => {
  try {
    const novo = req.body;

    if (!novo || !novo.reservatorio) {
      return res.status(400).json({ erro: "Dados inválidos." });
    }

    let historico = [];
    if (fs.existsSync(HISTORICO_FILE)) {
      historico = JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"));
    }

    historico.push(novo);

    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao salvar histórico." });
  }
});

// ===============================
// LER HISTÓRICO
// ===============================
app.get("/historico_dados", (req, res) => {
  try {
    if (!fs.existsSync(HISTORICO_FILE)) {
      return res.json([]);
    }

    const dados = JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"));
    res.json(dados);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao carregar histórico." });
  }
});

// ===============================
// LER CONSUMO DIÁRIO
// ===============================
app.get("/consumo_dados", (req, res) => {
  try {
    if (!fs.existsSync(CONSUMO_FILE)) {
      return res.json([]);
    }

    const dados = JSON.parse(fs.readFileSync(CONSUMO_FILE, "utf8"));
    res.json(dados);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao carregar consumo diário." });
  }
});

// ===============================
// PORTA DO SERVIDOR
// ===============================
const PORT = process.env.PORT || 443;
app.listen(PORT, () => {
  console.log("Servidor HAG rodando na porta " + PORT);
});
