// =====================================================
// 🌊 Server para Monitoramento dos Reservatórios HAG
// 🔧 Versão calibrada e aprimorada (Nov/2025)
// =====================================================

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { users } = require("./users");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// 🔐 CHAVE DE SEGURANÇA
// =====================================================
const API_KEY = process.env.HAG_API_KEY || "ffbshagf2025";

// =====================================================
// ⚙️ CONFIGURAÇÃO DOS SENSORES (calibração final)
// =====================================================
const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": {
    nome: "Reservatório Elevador",
    capacidade: 20000,
    alturaRes: 1.45,
    vazio: 0.004168,
    cheio: 0.007855
  },
  "Reservatorio_Osmose_current": {
    nome: "Reservatório Osmose",
    capacidade: 200,
    alturaRes: 1.0,
    vazio: 0.00505,
    cheio: 0.006533
  },
  "Reservatorio_CME_current": {
    nome: "Reservatório CME",
    capacidade: 1000,
    alturaRes: 0.45,
    vazio: 0.004088,
    cheio: 0.004408
  },
  "Agua_Abrandada_current": {
    nome: "Reservatório Água Abrandada",
    capacidade: 9000,
    alturaRes: 0.6,
    vazio: 0.004008,
    cheio: 0.004929
  },
  "Presao_Saida_current": {
    nome: "Pressão de Saída",
    capacidade: 0,
    alturaRes: 0,
    vazio: 0,
    cheio: 0
  },
  "Pressao_saida_current": {
    nome: "Pressão de Saída (variação)",
    capacidade: 0,
    alturaRes: 0,
    vazio: 0,
    cheio: 0
  },
  "Pressao_Retorno_current": {
    nome: "Pressão de Retorno",
    capacidade: 0,
    alturaRes: 0,
    vazio: 0,
    cheio: 0
  }
};

// =====================================================
// 📂 GARANTE PASTAS E ARQUIVOS DE DADOS
// =====================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const LOG_DIR = path.join(__dirname, "logs");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));

// =====================================================
// 🔑 LOGIN SIMPLES (para painel web)
// =====================================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) return res.json({ success: true, user: user.username });
  return res.status(401).json({ success: false, message: "Usuário ou senha inválidos" });
});

// =====================================================
// 📊 RETORNA DADOS SALVOS (painel)
// =====================================================
app.get("/dados", (req, res) => {
  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Erro ao ler arquivo de dados" });
    res.setHeader("Content-Type", "application/json");
    res.send(data);
  });
});

// =====================================================
// ⚡ ROTA DE STATUS (ver última leitura)
// =====================================================
app.get("/status", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8") || "{}");
    const lastUpdate = Object.values(data)
      .map(d => d.time)
      .sort((a, b) => b - a)[0];
    res.json({
      ultimaLeitura: lastUpdate ? new Date(lastUpdate).toLocaleString("pt-BR") : "Sem dados",
      sensores: Object.keys(data).length
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao ler status" });
  }
});

// =====================================================
// 🚀 RECEBE LEITURAS DO GATEWAY ITG
// =====================================================
app.post("/atualizar", (req, res) => {
  const payload = req.body;

  // 🔐 Valida chave de API
  const apiKeyHeader = req.headers["x-api-key"];
  if (apiKeyHeader !== API_KEY) {
    console.warn(`🚨 Tentativa de acesso não autorizada. Chave inválida: ${apiKeyHeader}`);
    return res.status(401).json({ error: "Chave de API inválida. Acesso negado." });
  }

  if (!payload) return res.status(400).json({ error: "Payload vazio" });

  // Aceita array direto ou dentro de { data: [...] }
  let items = payload;
  if (Array.isArray(payload.data)) items = payload.data;
  if (!Array.isArray(items)) items = [items];

  // Lê dados atuais
  let current = {};
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    current = JSON.parse(raw || "{}");
  } catch {
    current = {};
  }

  // Corrige nomes equivalentes
  const alias = {
    "pressao_saida_current": "Presao_Saida_current",
    "pressao_retorno_current": "Pressao_Retorno_current"
  };

  // Processa cada leitura recebida
  items.forEach(item => {
    let ref = item.ref || item.name;
    const rawValue = typeof item.value === "number" ? item.value : parseFloat(item.value);
    if (!ref || isNaN(rawValue)) return;

    const norm = ref.toLowerCase().trim();
    if (alias[norm]) ref = alias[norm];

    const cfg = SENSOR_CONFIG[ref];
    if (!cfg) {
      current[ref] = { nome: ref, valor_raw: rawValue, time: item.time || Date.now() };
      return;
    }

    const { capacidade, vazio, cheio } = cfg;
    let ratio = 0;
    if (cheio !== vazio) ratio = (rawValue - vazio) / (cheio - vazio);
    ratio = Math.max(0, Math.min(1, ratio));

    if (rawValue < vazio || rawValue > cheio) {
      console.warn(`⚠️ Valor fora do intervalo (${ref}): ${rawValue}`);
    }

    const litros = capacidade * ratio;

    current[ref] = {
      nome: cfg.nome,
      valor: Number(litros.toFixed(2)),
      raw: rawValue,
      data_hora: new Date(item.time || Date.now()).toLocaleString("pt-BR"),
      time: item.time || Date.now()
    };
  });

  // Salva as leituras
  fs.writeFile(DATA_FILE, JSON.stringify(current, null, 2), "utf8", (err) => {
    if (err) {
      console.error("❌ Erro ao salvar readings.json:", err);
      return res.status(500).json({ error: "Erro ao salvar arquivo" });
    }

    // Cria log diário
    const logMsg = `[${new Date().toISOString()}] Leituras recebidas de ${items.length} sensores.\n`;
    fs.appendFileSync(path.join(LOG_DIR, `${new Date().toISOString().split("T")[0]}.log`), logMsg);

    return res.json({ success: true, atualizados: Object.keys(current).length });
  });
});

// =====================================================
// 🌐 FRONTEND (painel web)
// =====================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// =====================================================
// 🚦 INICIALIZA SERVIDOR
// =====================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
