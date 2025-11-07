import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Middleware universal: aceita QUALQUER formato de body ===
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// === Pastas e arquivos ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// === Função para salvar leituras ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("💾 Leituras atualizadas:", dados);
}

// === Sensores configurados ===
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.007855, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006533, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Agua_Abrandada_current": { leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },
  "Pressao_Saida_current": { leituraVazio: 0, leituraCheio: 1, capacidade: 1 },
  "Pressao_Retorno_current": { leituraVazio: 0, leituraCheio: 1, capacidade: 1 }
};

// === Endpoint universal para o Gateway ===
app.all("/atualizar", (req, res) => {
  try {
    let body = req.body;

    // 🔍 Tenta converter texto ou Buffer em JSON
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        console.log("⚠️ Corpo recebido não é JSON — conteúdo bruto:", body.slice(0, 200));
      }
    }

    // 🔍 Extrai dados
    let dataArray = [];
    if (Array.isArray(body)) dataArray = body;
    else if (body && Array.isArray(body.data)) dataArray = body.data;
    else if (typeof body === "object" && body !== null) {
      dataArray = Object.keys(body)
        .filter((k) => k.includes("_current"))
        .map((k) => ({ ref: k, value: Number(body[k]) }));
    }

    if (!dataArray.length) {
      console.warn("⚠️ Nenhum dado válido encontrado:", body);
      return res.status(400).json({ erro: "Nenhum dado válido encontrado" });
    }

    // 🔧 Converte as leituras para litros ou mantém valores de pressão
    const dadosConvertidos = {};
    for (const item of dataArray) {
      const ref = item.ref || item.name;
      const valor = Number(item.value);
      if (!ref || isNaN(valor)) continue;

      const sensor = SENSORES[ref];
      if (!sensor) {
        dadosConvertidos[ref] = valor;
        continue;
      }

      const { leituraVazio, leituraCheio, capacidade } = sensor;

      let leituraConvertida;
      if (capacidade > 1) {
        // É reservatório em litros
        leituraConvertida =
          ((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;
        leituraConvertida = Math.max(0, Math.min(capacidade, leituraConvertida));
        leituraConvertida = Math.round(leituraConvertida);
      } else {
        // É pressão, mantém valor bruto
        leituraConvertida = Number(valor.toFixed(5));
      }

      dadosConvertidos[ref] = leituraConvertida;
    }

    dadosConvertidos.timestamp = new Date().toISOString();
    salvarDados(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("❌ Erro ao processar atualização:", err);
    res.status(500).json({ erro: err.message });
  }
});

// === Endpoint para o dashboard ===
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  res.json(dados);
});

// === Servir dashboard estático ===
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// === Inicialização ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Servidor universal HAG ativo na porta ${PORT}`)
);
