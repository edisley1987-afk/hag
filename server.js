// =====================================================
// 🌊 Servidor HAG — Compatível com Gateway ITG
// Aceita array com leituras múltiplas (ref, value, dev_id...)
// Serve o site em /public (dashboard + login)
// =====================================================
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb", strict: false, type: () => true }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// =====================================================
// 📂 Arquivos de dados
// =====================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));

// =====================================================
// ⚙️ Configuração calibrada dos sensores
// =====================================================
const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000, vazio: 0.004168, cheio: 0.007855 },
  "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200, vazio: 0.00505, cheio: 0.006533 },
  "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000, vazio: 0.004088, cheio: 0.004408 },
  "Reservatorio_Abrandada_current": { nome: "Reservatório Água Abrandada", capacidade: 9000, vazio: 0.004008, cheio: 0.004929 },
  "Presao_Saida_current": { nome: "Pressão Saída", capacidade: 0, vazio: 0, cheio: 0 },
  "Pressao_saida_current": { nome: "Pressão Saída (variação)", capacidade: 0, vazio: 0, cheio: 0 },
  "Pressao_Retorno_current": { nome: "Pressão Retorno", capacidade: 0, vazio: 0, cheio: 0 }
};

// =====================================================
// 🚀 Endpoint principal: /atualizar
// =====================================================
app.post("/atualizar", (req, res) => {
  try {
    let data = req.body;

    // 🔄 Tenta converter texto puro em JSON
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return res.status(400).json({ error: "Formato inválido (esperado JSON ou array)" });
      }
    }

    // Garante que é um array
    const items = Array.isArray(data) ? data : [data];

    // Lê o arquivo atual
    let current = {};
    try {
      current = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      current = {};
    }

    // Processa cada leitura recebida
    items.forEach((item) => {
      const ref = item.ref || item.name || "Desconhecido";
      const value = parseFloat((item.value ?? 0).toString().replace(",", "."));
      const cfg = SENSOR_CONFIG[ref];

      if (!ref || isNaN(value)) return;

      if (!cfg) {
        // Sensor desconhecido
        current[ref] = {
          nome: ref,
          raw: value,
          time: item.time || Date.now(),
          dev_id: item.dev_id || null
        };
        return;
      }

      const { capacidade, vazio, cheio } = cfg;
      let ratio = 0;
      if (cheio !== vazio) ratio = (value - vazio) / (cheio - vazio);
      ratio = Math.max(0, Math.min(1, ratio));

      const litros = capacidade * ratio;

      current[ref] = {
        nome: cfg.nome,
        valor: Number(litros.toFixed(2)),
        raw: value,
        dev_id: item.dev_id || null,
        time: item.time || Date.now(),
      };
    });

    // Salva no arquivo
    fs.writeFileSync(DATA_FILE, JSON.stringify(current, null, 2));

    res.json({ success: true, saved: items.length });
  } catch (err) {
    console.error("Erro ao atualizar:", err);
    res.status(500).json({ error: "Falha ao processar dados", detail: err.message });
  }
});

// =====================================================
// 📊 Endpoint de leitura
// =====================================================
app.get("/dados", (req, res) => {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    res.setHeader("Content-Type", "application/json");
    res.send(raw);
  } catch {
    res.status(500).json({ error: "Erro ao ler dados" });
  }
});

// =====================================================
// 🌐 Servir o site (dashboard + login)
// =====================================================
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// Rota raiz abre o dashboard.html
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "dashboard.html"));
});

// =====================================================
// 🚦 Inicialização
// =====================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
