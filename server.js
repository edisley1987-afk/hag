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

// === Configuração dos sensores (com abrandada incluído) ===
const SENSORES = {
  "Reservatorio_Elevador_current": {
    leituraVazio: 0.004168,
    leituraCheio: 0.007855,
    capacidade: 20000
  },
  "Reservatorio_Osmose_current": {
    leituraVazio: 0.00505,
    leituraCheio: 0.006533,
    capacidade: 200
  },
  "Reservatorio_CME_current": {
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    capacidade: 1000
  },
  "Agua_Abrandada_current": {
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
    capacidade: 9000
  }
};

// === Rota para receber dados do Gateway ===
app.all("/atualizar", (req, res) => {
  try {
    let body = req.body;

    // Converte se veio como string
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        console.log("⚠️ Corpo recebido não é JSON válido.");
      }
    }

    // ✅ Extrai o array de dados corretamente
    const dataArray = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
      ? body.data
      : [];

    if (!dataArray.length) {
      return res
        .status(400)
        .json({ erro: "Nenhum dado válido encontrado no corpo da requisição" });
    }

    // === Conversão dos valores ===
    const dadosConvertidos = {};

    for (const item of dataArray) {
      const { ref, value } = item;
      if (!ref || typeof value !== "number") continue;

      // Caso seja um reservatório
      if (SENSORES[ref]) {
        const { leituraVazio, leituraCheio, capacidade } = SENSORES[ref];
        const nivel =
          ((value - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;
        dadosConvertidos[ref] = Math.max(
          0,
          Math.min(capacidade, Math.round(nivel))
        );
      }
      // Caso seja uma pressão
      else if (ref.toLowerCase().includes("pressao")) {
        dadosConvertidos[ref] = value.toFixed(5);
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

// === Rota GET para o dashboard ===
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
app.listen(PORT, () =>
  console.log(`✅ Servidor HAG rodando com sucesso na porta ${PORT}`)
);
