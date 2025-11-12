// ===== Servidor HAG Universal com Login e Autenticação JWT =====

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import { users } from "./users.js";

const app = express();
const __dirname = path.resolve();
const SECRET_KEY = "reservatorios_secret_key";

// === Middleware base ===
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// === Arquivos de dados ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// === Login (gera token JWT) ===
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });

  const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: "6h" });
  res.json({ token });
});

// === Middleware de autenticação ===
function autenticarToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// === Endpoint protegido: dados ===
app.get("/dados", autenticarToken, (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  try {
    const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(dados);
  } catch {
    res.json({});
  }
});

// === Outras páginas ===
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// === Inicialização ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Servidor HAG com login ativo na porta " + PORT));
