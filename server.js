// ===============================
// 🌊 Server for Reservatorios-HAG
// ===============================
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { users } = require("./users"); // Certifique-se que existe users.js exportando { users }

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// =================================================================
// 🚨 CHAVE DE SEGURANÇA (API KEY)
//
// MELHOR PRÁTICA: usar variável de ambiente HAG_API_KEY
// O valor abaixo é o padrão (fallback)
const API_KEY = process.env.HAG_API_KEY || "ffbshagf2025";
// =================================================================

// sensor config: capacidade (L), leituraVazio (raw), leituraCheio (raw)
const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000, vazio: 0.004168, cheio: 0.007855 },
  "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200, vazio: 0.00505, cheio: 0.006533 },
  "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000, vazio: 0.004088, cheio: 0.004408 },
  "Agua_Abrandada_current": { nome: "Reservatório Água Abrandada", capacidade: 9000, vazio: 0.004008, cheio: 0.004929 },
  "Presao_Saida_current": { nome: "Pressão de Saída (Raw)", capacidade: 0, vazio: 0, cheio: 0 }
};

// Caminho para salvar os dados
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

// ✅ Correção: era "_dirname" (erro de digitação)
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Inicializa arquivo se não existir
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

// ===============================================================
// LOGIN SIMPLES
// ===============================================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) return res.json({ success: true, user: user.username });
  return res.status(401).json({ success: false, message: "Usuário ou senha inválidos" });
});

// ===============================================================
// RETORNA LEITURAS ATUAIS (para dashboard)
// ===============================================================
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

// ===============================================================
// RECEBE LEITURAS DO GATEWAY ITG
// ===============================================================
app.post("/atualizar", (req, res) => {
  const payload = req.body;

  // 1️⃣ VERIFICA CHAVE DE SEGURANÇA
  const apiKeyHeader = req.headers["x-api-key"];
  if (apiKeyHeader !== API_KEY) {
    console.warn(`🚨 Tentativa de acesso não autorizada. Chave inválida: ${apiKeyHeader}`);
    return res.status(401).json({ error: "Chave de API inválida. Acesso negado." });
  }

  if (!payload) return res.status(400).json({ error: "Payload vazio" });

  // Aceita array direto ou dentro de 'data'
  let items = payload;
  if (Array.isArray(payload.data)) items = payload.data;
  if (!Array.isArray(items)) items = [items];

  // Lê dados atuais (para preservar sensores não atualizados)
  let current = {};
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    current = JSON.parse(raw || "{}");
  } catch {
    current = {};
  }

  // Processa registros recebidos
  items.forEach(item => {
    const ref = item.ref || item.name;
    const rawValue = (typeof item.value === "number") ? item.value : parseFloat(item.value);
    if (!ref || isNaN(rawValue)) return;

    const cfg = SENSOR_CONFIG[ref];
    if (!cfg) {
      // Sensor desconhecido → salva valor bruto
      current[ref] = { nome: ref, valor_raw: rawValue };
      return;
    }

    const { capacidade, vazio, cheio } = cfg;
    let ratio = 0;
    if (cheio !== vazio) ratio = (rawValue - vazio) / (cheio - vazio);
    ratio = Math.max(0, Math.min(1, ratio));

    const litros = capacidade * ratio;

    current[ref] = { nome: cfg.nome, valor: Number(litros.toFixed(2)) };
  });

  // Salva arquivo atualizado
  fs.writeFile(DATA_FILE, JSON.stringify(current, null, 2), "utf8", (err) => {
    if (err) {
      console.error("Erro ao salvar readings.json:", err);
      return res.status(500).json({ error: "Erro ao salvar arquivo" });
    }
    return res.json({ success: true, saved: Object.keys(current).length });
  });
});

// ===============================================================
// FRONTEND
// ===============================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ===============================================================
// INICIALIZA SERVIDOR
// ===============================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
