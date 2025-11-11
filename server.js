// ======= Servidor Universal HAG (sem dependências extras) =======
// Compatível com Gateway ITG e Render — Login leve com token em memória

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { users } from "./users.js";

const app = express();
const __dirname = path.resolve();

// === Configuração básica ===
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// === Armazenamento de tokens em memória ===
const tokensAtivos = new Set();

// === Função simples para gerar token ===
function gerarToken(username) {
  return Buffer.from(username + Date.now()).toString("base64");
}

// === Middleware de autenticação ===
function autenticar(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token && tokensAtivos.has(token)) return next();
  res.status(401).json({ erro: "Acesso não autorizado" });
}

// === Login ===
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const usuario = users.find(
    (u) => u.username === username && u.password === password
  );
  if (usuario) {
    const token = gerarToken(username);
    tokensAtivos.add(token);
    console.log(`🔐 Usuário ${username} autenticado`);
    res.json({ status: "ok", token });
  } else {
    res.status(401).json({ erro: "Usuário ou senha inválidos" });
  }
});

// === Logout ===
app.post("/logout", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  tokensAtivos.delete(token);
  res.json({ status: "logout" });
});

// === Arquivos e diretórios ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// === Sensores calibrados ===
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008056, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006693, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },
};

// === Função para salvar leituras ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("💾 Leituras atualizadas:", dados);
}

// === Função para registrar histórico ===
function registrarHistorico(dados) {
  const hoje = new Date().toISOString().split("T")[0];
  let historico = {};
  if (fs.existsSync(HIST_FILE)) {
    try {
      historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
    } catch {
      historico = {};
    }
  }
  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dados).forEach(([ref, valor]) => {
    if (ref === "timestamp" || typeof valor !== "number") return;
    if (!historico[hoje][ref]) historico[hoje][ref] = { min: valor, max: valor };
    else {
      historico[hoje][ref].min = Math.min(historico[hoje][ref].min, valor);
      historico[hoje][ref].max = Math.max(historico[hoje][ref].max, valor);
    }
  });
  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// === Endpoint do Gateway ===
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  console.log(`➡️ Recebido ${req.method} em ${req.path}`);

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        console.log("⚠️ Corpo não-JSON recebido");
      }
    }

    const dados = {};
    Object.keys(body).forEach((k) => {
      const valor = Number(body[k]);
      if (isNaN(valor)) return;
      const sensor = SENSORES[k];
      if (!sensor) dados[k] = valor;
      else if (sensor.tipo === "pressao") {
        let bar = ((valor - 0.004) / 0.016) * 20;
        bar = Math.max(0, Math.min(20, bar));
        dados[k] = Number(bar.toFixed(2));
      } else {
        const litros =
          ((valor - sensor.leituraVazio) /
            (sensor.leituraCheio - sensor.leituraVazio)) *
          sensor.capacidade;
        dados[k] = Math.max(0, Math.min(sensor.capacidade, Math.round(litros)));
      }
    });

    dados.timestamp = new Date().toISOString();
    salvarDados(dados);
    registrarHistorico(dados);
    res.json({ status: "ok", dados });
  } catch (e) {
    console.error("❌ Erro:", e);
    res.status(500).json({ erro: e.message });
  }
});

// === Endpoints protegidos ===
app.get("/dados", autenticar, (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

app.get("/historico", autenticar, (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")));
});

// === Servir interface estática ===
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (req, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));

// === Inicialização ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor HAG ativo na porta ${PORT}`));
