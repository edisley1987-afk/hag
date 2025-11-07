import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Configurações gerais ===
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// === Pastas e arquivos ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// === Função utilitária para salvar dados ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("💾 Leituras atualizadas:", dados);
}

// === Configuração dos sensores ===
const SENSORES = {
  // ----- Reservatórios -----
  "Reservatorio_Elevador_current": {
    tipo: "nivel",
    leituraVazio: 0.004168,
    leituraCheio: 0.007855,
    capacidade: 20000,
    alturaRes: 1.45
  },
  "Reservatorio_Osmose_current": {
    tipo: "nivel",
    leituraVazio: 0.00505,
    leituraCheio: 0.006533,
    capacidade: 200,
    alturaRes: 1.0
  },
  "Reservatorio_CME_current": {
    tipo: "nivel",
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    capacidade: 1000,
    alturaRes: 0.45
  },
  "Reservatorio_Abrandada_current": {
    tipo: "nivel",
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
    capacidade: 9000,
    alturaRes: 0.6
  },

  // ----- Pressões -----
  "Pressao_saida_current": { tipo: "pressao" },
  "Pressao_Retorno_current": { tipo: "pressao" },
  "Pressao_Saida_current": { tipo: "pressao" }
};

// === Rota POST/ALL para receber dados do Gateway ===
app.all("/atualizar", (req, res) => {
  try {
    let body = req.body;

    // Tenta converter texto puro em JSON
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        console.log("⚠️ Corpo recebido não é JSON válido, tentando interpretar campos diretos...");
      }
    }

    // Extrai leituras de vários formatos possíveis
    let dataArray = [];
    if (Array.isArray(body)) {
      dataArray = body;
    } else if (body && Array.isArray(body.data)) {
      dataArray = body.data;
    } else if (typeof body === "object") {
      dataArray = Object.keys(body)
        .filter((k) => k.includes("_current"))
        .map((k) => ({ ref: k, value: body[k] }));
    }

    if (!dataArray.length) {
      return res.status(400).json({ erro: "Nenhum dado válido encontrado" });
    }

    // Converte e armazena os dados
    const dadosConvertidos = {};

    for (const item of dataArray) {
      const { ref, value } = item;
      const sensor = SENSORES[ref];
      if (!sensor || typeof value !== "number") continue;

      if (sensor.tipo === "nivel") {
        // Converte leitura em litros
        const { leituraVazio, leituraCheio, capacidade } = sensor;
        const nivel = ((value - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;
        dadosConvertidos[ref] = Math.max(0, Math.min(capacidade, Math.round(nivel)));
      } else if (sensor.tipo === "pressao") {
        // Apenas salva o valor cru (ex: 0.0053)
        dadosConvertidos[ref] = Number(value.toFixed(5));
      }
    }

    dadosConvertidos.timestamp = new Date().toISOString();
    salvarDados(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("❌ Erro ao atualizar:", err);
    res.status(500).json({ erro: err.message });
  }
});

// === Rota GET para o dashboard ler ===
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  res.json(data);
});

// === Servir os arquivos do dashboard ===
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Inicialização ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor HAG rodando com sucesso na porta ${PORT}`));
