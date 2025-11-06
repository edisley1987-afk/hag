// =====================================================
// 🌊 Server para Reservatórios HAG (versão compatível ITG)
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
// 🔐 CHAVE DE SEGURANÇA (usada apenas se enviada)
// =====================================================
const API_KEY = process.env.HAG_API_KEY || "ffbshagf2025";

// =====================================================
// ⚙️ CONFIGURAÇÃO DOS SENSORES (calibrada)
// =====================================================
// Campos: capacidade (L), altura (m), leitura vazio, leitura cheio
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
  "Pressao_Retorno_current": {
    nome: "Pressão de Retorno",
    capacidade: 0,
    alturaRes: 0,
    vazio: 0,
    cheio: 0
  }
};

// =====================================================
// 📂 GARANTE PASTA E ARQUIVO DE DADOS
// =====================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));

// =====================================================
// 🔑 LOGIN SIMPLES
// =====================================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) return res.json({ success: true, user: user.username });
  return res.status(401).json({ success: false, message: "Usuário ou senha inválidos" });
});

// =====================================================
// 📊 RETORNA DADOS SALVOS
// =====================================================
app.get("/dados", (req, res) => {
  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Erro ao ler arquivo de dados" });
    res.setHeader("Content-Type", "application/json");
    res.send(data);
  });
});

// =====================================================
// 🚀 RECEBE LEITURAS DO GATEWAY ITG (SEM HEADER)
// =====================================================
app.post("/atualizar", (req, res) => {
  const payload = req.body;

  // 🔓 Aceita requisições com ou sem cabeçalho
  const apiKeyHeader = req.headers["x-api-key"];
  if (apiKeyHeader && apiKeyHeader !== API_KEY) {
    console.warn(`🚨 Chave de API incorreta: ${apiKeyHeader}`);
    return res.status(401).json({ error: "Chave incorreta" });
  } else if (!apiKeyHeader) {
    console.log("⚠️ Requisição sem x-api-key (aceita)");
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

  // Processa os dados recebidos
  items.forEach(item => {
    let ref = item.ref || item.name;
    const rawValue = (typeof item.value === "number") ? item.value : parseFloat(item.value);
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

    const litros = capacidade * ratio;

    current[ref] = {
      nome: cfg.nome,
      valor: Number(litros.toFixed(2)),
      raw: rawValue,
      time: item.time || Date.now()
    };
  });

  // Salva as leituras atualizadas
  fs.writeFile(DATA_FILE, JSON.stringify(current, null, 2), "utf8", (err) => {
    if (err) {
      console.error("Erro ao salvar readings.json:", err);
      return res.status(500).json({ error: "Erro ao salvar arquivo" });
    }
    console.log("✅ Leituras atualizadas com sucesso!");
    return res.json({ success: true, saved: Object.keys(current).length });
  });
});

// =====================================================
// 🌐 FRONTEND
// =====================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// =====================================================
// 🚦 INICIALIZA SERVIDOR
// =====================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
