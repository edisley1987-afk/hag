// Server for Reservatorios-HAG
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { users } = require("./users"); // Assume que 'users.js' existe

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// =================================================================
// 🚨 CHAVE DE SEGURANÇA (API KEY)
// 
// MELHOR PRÁTICA: Usar process.env.HAG_API_KEY. 
// O valor 'ffbshagf2025' é o padrão se a variável de ambiente não estiver definida.
const API_KEY = process.env.HAG_API_KEY || "ffbshagf2025";
// =================================================================

// sensor config: capacidade (L), leituraVazio (raw), leituraCheio (raw), nome
const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000, vazio: 0.004168, cheio: 0.007855 },
  "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200, vazio: 0.00505, cheio: 0.006533 },
  "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000, vazio: 0.004088, cheio: 0.004408 },
  "Agua_Abrandada_current": { nome: "Reservatório Água Abrandada", capacidade: 9000, vazio: 0.004008, cheio: 0.004929 },
  // Incluindo o sensor 'Presao_Saida_current' encontrado no payload, mas sem config de volume
  "Presao_Saida_current": { nome: "Pressão de Saída (Raw)", capacidade: 0, vazio: 0, cheio: 0 }
};

const DATA_FILE = path.join(__dirname, "data", "readings.json");
// ensure data folder exists
if (!fs.existsSync(path.join(_dirname, "data"))) fs.mkdirSync(path.join(_dirname, "data"));

// initialize file if missing
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

// Simple login API used by the front-end
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) return res.json({ success: true, user: user.username });
  return res.status(401).json({ success: false, message: "Usuário ou senha inválidos" });
});

// Endpoint used by dashboard front-end to get current processed readings
app.get("/dados", (req, res) => {
  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Erro ao ler arquivo de dados" });
    try {
      res.setHeader("Content-Type", "application/json");
      res.send(data);
    } catch (e) {
      res.status(500).json({ error: "JSON inválido" });
    }
  });
});

// Endpoint for Gateway ITG to POST raw measurements (array or single object).
// It will convert raw sensor values into liters using SENSOR_CONFIG, then save file.
app.post("/atualizar", (req, res) => {
  const payload = req.body;

  // 1. VERIFICAÇÃO DE SEGURANÇA: Checa o Header HTTP 'X-API-KEY'
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader !== API_KEY) {
    // 🚨 Esta linha está verificada contra o SyntaxError
    console.warn(Tentativa de acesso não autorizada. Chave inválida: ${apiKeyHeader}); 
    return res.status(401).json({ error: "Chave de API inválida. Acesso negado." });
  }

  if (!payload) return res.status(400).json({ error: "Payload vazio" });

  // Aceita o formato que o Khomp envia: array dentro de 'data' ou array direto.
  let items = payload;
  if (Array.isArray(payload.data)) items = payload.data;
  if (!Array.isArray(items)) items = [items];

  // Read previous data to preserve fields we don't update
  let current = {};
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    current = JSON.parse(raw || "{}");
  } catch (e) {
    current = {};
  }

  // Process incoming records
  items.forEach(item => {
    // item expected to have: ref (string), value (number)
    const ref = item.ref || item.name;
    const rawValue = (typeof item.value === "number") ? item.value : parseFloat(item.value);
    if (!ref || isNaN(rawValue)) return;

    const cfg = SENSOR_CONFIG[ref];
    if (!cfg) {
      // unknown sensor: store raw value under its ref
      current[ref] = { nome: ref, valor_raw: rawValue };
      return;
    }

    // Map raw reading to liters with linear scaling between vazio and cheio
    const { capacidade, vazio, cheio } = cfg;
    // protect division by zero
    let ratio;
    if (cheio === vazio) ratio = 0;
    else ratio = (rawValue - vazio) / (cheio - vazio);

    // Clamp ratio between 0 and 1
    if (!isFinite(ratio)) ratio = 0;
    ratio = Math.max(0, Math.min(1, ratio));

    const liters = capacidade * ratio;

    current[ref] = { nome: cfg.nome, valor: Number(liters.toFixed(2)) };
  });

  fs.writeFile(DATA_FILE, JSON.stringify(current, null, 2), "utf8", (err) => {
    if (err) {
      console.error("Erro ao salvar readings.json:", err);
      return res.status(500).json({ error: "Erro ao salvar arquivo" });
    }
    return res.json({ success: true, saved: Object.keys(current).length });
  });
});

// Serve frontend index/dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(Servidor rodando na porta ${PORT}));
