import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Configurações gerais ===
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// === Pastas e arquivos de dados ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// === Conversão de altura (em metros) → litros ===
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.007855, capacidade: 20000 },
  "Reservatorio_Osmose_current":   { leituraVazio: 0.00505,  leituraCheio: 0.006533, capacidade: 200 },
  "Reservatorio_CME_current":      { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
};

// === Servir arquivos estáticos do dashboard (HTML, JS, CSS) ===
app.use(express.static(path.join(__dirname, "public")));

// === Rota principal -> abre o index.html do dashboard ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Rota POST chamada pelo Gateway ITG ===
app.post("/atualizar", (req, res) => {
  try {
    const leituras = req.body;

    if (!Array.isArray(leituras)) {
      return res.status(400).json({ erro: "Formato inválido: esperado array de leituras" });
    }

    const dadosConvertidos = {};

    for (const item of leituras) {
      const { ref, value } = item;
      const sensor = SENSORES[ref];
      if (!sensor) continue;

      const { leituraVazio, leituraCheio, capacidade } = sensor;
      const nivel = ((value - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;

      dadosConvertidos[ref] = Math.max(0, Math.min(capacidade, Math.round(nivel)));
    }

    dadosConvertidos.timestamp = new Date().toISOString();

    fs.writeFileSync(DATA_FILE, JSON.stringify(dadosConvertidos, null, 2));
    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("Erro ao processar atualização:", err);
    res.status(500).json({ erro: "Erro ao processar atualização" });
  }
});

// === Rota GET usada pelo dashboard para ler o JSON ===
app.get("/dados", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({});
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    res.json(data);
  } catch (err) {
    console.error("Erro ao ler arquivo de dados:", err);
    res.status(500).json({ erro: "Falha ao ler dados" });
  }
});

// === Inicialização do servidor ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor HAG Proxy rodando com sucesso na porta ${PORT}`);
});
