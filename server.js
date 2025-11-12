// ===== server.js =====
// Servidor HAG - versão sem dependências externas além de Express/CORS
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { users } from "./users.js";

const app = express();
const __dirname = path.resolve();

// Caminhos de dados
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Sessões simples em memória (sem jsonwebtoken)
const sessions = {};

// Função auxiliar para gerar tokens simples
function gerarToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// === LOGIN ===
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, message: "Usuário ou senha inválidos" });
  }

  const token = gerarToken();
  sessions[token] = { username, timestamp: Date.now() };

  res.json({ success: true, token });
});

// === Middleware de autenticação ===
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Não autorizado" });

  const token = authHeader.replace("Bearer ", "");
  if (!sessions[token]) return res.status(401).json({ error: "Sessão inválida" });

  next();
}

// === Rota protegida de dados ===
app.get("/dados", autenticar, (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  const dados = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json(dados);
});

// === Atualizar leituras ===
app.post("/dados", autenticar, (req, res) => {
  const dados = req.body;
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  res.json({ success: true });
});

// === Servidor HTTPS opcional ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
