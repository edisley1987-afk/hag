// === server.js ===
// Servidor simples com autenticação por token leve

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { users } from "./users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Caminho para o arquivo de dados
const DATA_FILE = path.join(__dirname, "data", "readings.json");

// 🔑 Simulamos uma "sessão" via tokens simples em memória
const activeTokens = new Set();

// === Rota de login ===
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
  }

  // Gera token aleatório simples (sem libs)
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
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

// === Rota de dados protegida ===
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

// === Inicialização ===
const PORT = process.env.PORT || 443;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
