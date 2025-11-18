// ======= Servidor Universal HAG - compatível com Gateway ITG e Render =======
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Middleware universal ===
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// === Pastas de dados ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");

// Render não permite /data raiz — OK: data dentro do projeto
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// === Sensores ===
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008056, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006693, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// === Salvamento ===
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
}

function registrarHistorico(dados) {
  const hoje = new Date().toISOString().split("T")[0];
  let historico = {};

  if (fs.existsSync(HIST_FILE)) {
    try {
      historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
    } catch {
      historico = {};
    }
  }

  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dados).forEach(([ref, valor]) => {
    if (ref === "timestamp" || typeof valor !== "number") return;

    if (!historico[hoje][ref]) {
      historico[hoje][ref] = { min: valor, max: valor };
    } else {
      historico[hoje][ref].min = Math.min(historico[hoje][ref].min, valor);
      historico[hoje][ref].max = Math.max(historico[hoje][ref].max, valor);
    }
  });

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// === Endpoint Universal ===
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  console.log("➡️ Entrada:", req.method, req.path);

  try {
    let body = req.body;

    if (Buffer.isBuffer(body)) body = body.toString("utf8");

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    let dataArray = [];

    if (Array.isArray(body)) dataArray = body;
    else if (body?.data) dataArray = body.data;
    else if (typeof body === "object") {
      dataArray = Object.keys(body)
        .filter((k) => k.includes("_current"))
        .map((k) => ({ ref: k, value: Number(body[k]) }));
    }

    if (!dataArray.length) {
      return res.status(400).json({ erro: "Nenhum dado válido encontrado" });
    }

    const dadosConvertidos = {};

    for (const item of dataArray) {
      const ref = item.ref || item.name;
      const valor = Number(item.value);

      const sensor = SENSORES[ref];

      if (!sensor) {
        dadosConvertidos[ref] = valor;
        continue;
      }

      const { leituraVazio, leituraCheio, capacidade, tipo } = sensor;

      let leituraConvertida;

      if (tipo === "pressao") {
        leituraConvertida = ((valor - 0.004) / 0.016) * 20;
        leituraConvertida = Math.max(0, Math.min(20, leituraConvertida));
        leituraConvertida = Number(leituraConvertida.toFixed(3));
      } else {
        leituraConvertida =
          ((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;

        leituraConvertida = Math.max(0, Math.min(capacidade, leituraConvertida));
        leituraConvertida = Math.round(leituraConvertida);
      }

      dadosConvertidos[ref] = leituraConvertida;
    }

    dadosConvertidos.timestamp = new Date().toISOString();

    salvarDados(dadosConvertidos);
    registrarHistorico(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// === Rotas ===
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE)));
});

app.get("/historico", (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(HIST_FILE)));
});

// === Interface estática ===
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/dashboard.html")));
app.get("/historico-view", (req, res) => res.sendFile(path.join(__dirname, "public/historico.html")));

// === Start ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor iniciado na porta", PORT));
