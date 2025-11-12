// === Servidor Universal HAG - com login e proteção simples ===
// Versão otimizada para Render e Gateways ITG (sem dependências extras)

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// === Usuários fixos para login ===
const USUARIOS = {
  hag: "1234",
  admin: "hag2025"
};

// === Função utilitária ===
function gerarToken(usuario) {
  return Buffer.from(`${usuario}:${Date.now()}`).toString("base64");
}

// === Middleware de autenticação ===
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ erro: "Não autorizado" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    if (!decoded.includes(":")) throw new Error("Token inválido");
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido" });
  }
}

// === Rota de login ===
app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha)
    return res.status(400).json({ erro: "Usuário e senha obrigatórios" });

  const senhaCorreta = USUARIOS[usuario];
  if (!senhaCorreta || senhaCorreta !== senha)
    return res.status(401).json({ erro: "Usuário ou senha inválidos" });

  const token = gerarToken(usuario);
  res.json({ sucesso: true, usuario, token });
});

// === Pastas de dados ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// === Sensores calibrados ===
const SENSORES = {
  Reservatorio_Elevador_current: { leituraVazio: 0.004168, leituraCheio: 0.008056, capacidade: 20000 },
  Reservatorio_Osmose_current: { leituraVazio: 0.00505, leituraCheio: 0.006693, capacidade: 200 },
  Reservatorio_CME_current: { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },
  Pressao_Saida_Osmose_current: { tipo: "pressao" },
  Pressao_Retorno_Osmose_current: { tipo: "pressao" },
  Pressao_Saida_CME_current: { tipo: "pressao" }
};

// === Funções utilitárias ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
}
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
    if (!historico[hoje][ref])
      historico[hoje][ref] = { min: valor, max: valor };
    else {
      historico[hoje][ref].min = Math.min(historico[hoje][ref].min, valor);
      historico[hoje][ref].max = Math.max(historico[hoje][ref].max, valor);
    }
  });
  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// === Endpoint universal para Gateway ===
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    let dataArray = [];
    if (Array.isArray(body)) dataArray = body;
    else if (body && typeof body === "object") {
      dataArray = Object.keys(body)
        .filter((k) => k.includes("_current"))
        .map((k) => ({ ref: k, value: Number(body[k]) }));
    }

    const dadosConvertidos = {};
    for (const item of dataArray) {
      const ref = item.ref;
      const valor = Number(item.value);
      const sensor = SENSORES[ref];
      if (!sensor) continue;

      if (sensor.tipo === "pressao") {
        const corrente = valor;
        let pressao = ((corrente - 0.004) / 0.016) * 20;
        pressao = Math.max(0, Math.min(20, pressao));
        dadosConvertidos[ref] = Number(pressao.toFixed(3));
      } else {
        const { leituraVazio, leituraCheio, capacidade } = sensor;
        let litros = ((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;
        litros = Math.max(0, Math.min(capacidade, litros));
        dadosConvertidos[ref] = Math.round(litros);
      }
    }

    dadosConvertidos.timestamp = new Date().toISOString();
    salvarDados(dadosConvertidos);
    registrarHistorico(dadosConvertidos);

    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// === Endpoints protegidos ===
app.get("/dados", autenticar, (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  res.json(dados);
});

app.get("/historico", autenticar, (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json({});
  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  res.json(historico);
});

// === Arquivos estáticos ===
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (req, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));

// === Inicialização ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
