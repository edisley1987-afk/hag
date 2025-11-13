// ======= Servidor Universal HAG (com histórico completo e bloqueio de IP) =======

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// ======= Middlewares =======
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ======= Proteção: apenas o Gateway pode enviar dados =======
const IP_GATEWAY = "192.168.1.71";

app.use("/dados", (req, res, next) => {
  // Detecta o IP real de quem faz a requisição
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .replace("::ffff:", "")
    .replace("::1", "127.0.0.1");

  console.log("🔍 IP detectado:", ip);

  // Permite apenas o Gateway e localhost (para testes)
  if (ip === IP_GATEWAY || ip === "127.0.0.1") {
    return next();
  }

  console.warn(`🚫 Acesso bloqueado de IP: ${ip}`);
  return res.status(403).json({ error: "Acesso negado. IP não autorizado." });
});

// ======= Pastas e arquivos =======
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HISTORICO_FILE = path.join(DATA_DIR, "historico.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
if (!fs.existsSync(HISTORICO_FILE)) fs.writeFileSync(HISTORICO_FILE, "[]");

// ======= Rota principal (dashboard) =======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ======= Recebe dados do Gateway =======
app.post("/dados", (req, res) => {
  try {
    let data = {};
    if (typeof req.body === "string") {
      try {
        data = JSON.parse(req.body);
      } catch {
        data = {};
      }
    } else {
      data = req.body;
    }

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Dados inválidos ou vazios." });
    }

    // Salva dados atuais
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // Salva histórico
    const historico = JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"));
    historico.push({ data: new Date().toISOString(), valores: data });
    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));

    console.log("💾 Dados atualizados:", data);
    res.json({ status: "OK", mensagem: "Dados recebidos com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao salvar dados:", err);
    res.status(500).json({ error: "Erro interno ao salvar dados." });
  }
});

// ======= Envia dados atuais =======
app.get("/dados", (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("❌ Erro ao ler dados:", err);
    res.status(500).json({ error: "Erro ao ler dados." });
  }
});

// ======= Histórico =======
app.get("/historico", (req, res) => {
  try {
    const historico = fs.readFileSync(HISTORICO_FILE, "utf8");
    res.json(JSON.parse(historico));
  } catch (err) {
    console.error("❌ Erro ao ler histórico:", err);
    res.status(500).json({ error: "Erro ao ler histórico." });
  }
});

// ======= Limpar histórico =======
app.delete("/historico", (req, res) => {
  try {
    fs.writeFileSync(HISTORICO_FILE, "[]");
    console.log("🧹 Histórico limpo.");
    res.json({ status: "OK", mensagem: "Histórico apagado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao limpar histórico:", err);
    res.status(500).json({ error: "Erro ao limpar histórico." });
  }
});

// ======= Inicia servidor =======
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
