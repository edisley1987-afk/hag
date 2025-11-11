// === server.js ===
// Servidor com autenticação simples e compatível com Render

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { users } from "./users.js";

// === Caminhos base ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === Middlewares ===
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === Caminho para o arquivo de dados ===
const DATA_FILE = path.join(__dirname, "data", "readings.json");

// === Sessão simples via token (armazenada em memória) ===
const activeTokens = new Set();

// === Rota de login ===
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Usuário ou senha inválidos." });
  }

  // Gera token simples (sem dependências externas)
  const token =
    Math.random().toString(36).substring(2) + Date.now().toString(36);
  activeTokens.add(token);

  res.json({ success: true, token });
});

// === Middleware de autenticação ===
function autenticar(req, res, next) {
  const token = req.headers["authorization"];
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  next();
}

// === Rota protegida: /dados ===
app.get("/dados", autenticar, (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({});
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(data);
  } catch (err) {
    console.error("Erro lendo arquivo:", err);
    res.status(500).json({ error: "Erro ao ler dados" });
  }
});

// === Rota pública (opcional, para testes) ===
app.get("/public", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({});
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(data);
  } catch (err) {
    console.error("Erro lendo arquivo público:", err);
    res.status(500).json({ error: "Erro ao ler dados" });
  }
});

// === Inicialização do servidor ===
// ⚠️ Importante: Render define a porta via process.env.PORT
// Nunca use 80 ou 443 diretamente
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
