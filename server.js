// =====================================================
// 🌊 Servidor HAG — Versão Blindada (Render Safe)
// Aceita JSON, texto, form-data e qualquer tipo de requisição
// =====================================================
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

// 🔧 Middlewares robustos
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false, type: () => true }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 🗂️ Pastas
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));

// ⚙️ Sensores calibrados
const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000, vazio: 0.004168, cheio: 0.007855 },
  "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200, vazio: 0.00505, cheio: 0.006533 },
  "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000, vazio: 0.004088, cheio: 0.004408 },
  "Agua_Abrandada_current": { nome: "Reservatório Água Abrandada", capacidade: 9000, vazio: 0.004008, cheio: 0.004929 }
};

// 📡 Endpoint de atualização (aceita qualquer formato)
app.post("/atualizar", async (req, res) => {
  try {
    let data = req.body;

    // Se o corpo vier como texto, tenta converter para JSON
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        // tenta extrair números simples tipo "ref=value"
        if (data.includes("=")) {
          const [ref, value] = data.split("=");
          data = { [ref.trim()]: parseFloat(value) };
        } else {
          data = { raw: data };
        }
      }
    }

    // Lê arquivo atual
    let current = {};
    try {
      current = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
      current = {};
    }

    // Garante array
    let items = [];
    if (Array.isArray(data)) items = data;
    else if (data.data && Array.isArray(data.data)) items = data.data;
    else if (typeof data === "object") {
      items = Object.entries(data).map(([ref, value]) => ({ ref, value }));
    } else {
      items = [{ ref: "Desconhecido", value: data }];
    }

    // Processa leituras
    items.forEach((item) => {
      const ref = item.ref || item.name || "Desconhecido";
      const value = parseFloat(
        ("" + (item.value ?? item.val ?? item.reading ?? 0)).replace(",", ".")
      );

      const cfg = SENSOR_CONFIG[ref];
      if (!cfg) {
        current[ref] = { nome: ref, raw: value, time: Date.now() };
        return;
      }

      const ratio = Math.max(0, Math.min(1, (value - cfg.vazio) / (cfg.cheio - cfg.vazio)));
      current[ref] = {
        nome: cfg.nome,
        valor: Number((cfg.capacidade * ratio).toFixed(2)),
        raw: value,
        time: Date.now(),
      };
    });

    // Salva arquivo
    fs.writeFileSync(DATA_FILE, JSON.stringify(current, null, 2));
    res.json({ success: true, saved: items.length });
  } catch (err) {
    console.error("Erro ao atualizar:", err);
    res.status(500).json({ error: "Falha ao processar payload", detail: err.message });
  }
});

// 📊 Endpoint de dados
app.get("/dados", (req, res) => {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    res.setHeader("Content-Type", "application/json");
    res.send(raw);
  } catch {
    res.status(500).json({ error: "Erro ao ler dados" });
  }
});

// 🖥️ Painel
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// 🚀 Inicialização
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Servidor blindado rodando na porta ${PORT}`));
