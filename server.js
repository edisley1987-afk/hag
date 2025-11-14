/* ======= Servidor Universal HAG (com histórico otimizado e variação > 5%) ======= */

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUTENCAO_FILE = path.join(DATA_DIR, "manutencao.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// === Calibração dos sensores ===
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008256, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006693, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// === Funções utilitárias ===
function salvarLeituraAtual(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
}

function adicionarAoHistorico(dados) {
  let historico = [];
  if (fs.existsSync(HIST_FILE)) {
    try { historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")); } catch { historico = []; }
  }

  const ultima = historico.length ? historico[historico.length - 1] : null;
  let mudou = false;

  if (ultima) {
    for (const ref of Object.keys(SENSORES)) {
      if (!ref.includes("Reservatorio")) continue;
      const atual = dados[ref];
      const anterior = ultima[ref];
      const capacidade = SENSORES[ref].capacidade;
      if (capacidade && anterior !== undefined) {
        const diffPercent = Math.abs((atual - anterior) / capacidade) * 100;
        if (diffPercent >= 5) {
          mudou = true;
          break;
        }
      }
    }
  } else mudou = true;

  if (mudou) {
    historico.push({ timestamp: new Date().toISOString(), ...dados });
    fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
  }
}

// === Receber leituras do Gateway ===
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    let dataArray = [];
    if (Array.isArray(body)) dataArray = body;
    else if (Array.isArray(body?.data)) dataArray = body.data;
    else if (typeof body === "object" && body !== null)
      dataArray = Object.keys(body)
        .filter(k => k.includes("_current"))
        .map(k => ({ ref: k, value: Number(body[k]) }));

    if (!dataArray.length) return res.status(400).json({ erro: "Nenhum dado válido" });

    const dadosConvertidos = {};
    for (const item of dataArray) {
      const ref = item.ref || item.name;
      const valor = Number(item.value);
      if (!ref || isNaN(valor)) continue;

      const sensor = SENSORES[ref];
      if (!sensor) continue;

      const { leituraVazio, leituraCheio, capacidade, tipo } = sensor;
      let leituraConvertida;

      if (tipo === "pressao") {
        leituraConvertida = ((valor - 0.004) / 0.016) * 20;
        leituraConvertida = Math.max(0, Math.min(20, leituraConvertida));
        leituraConvertida = parseFloat(leituraConvertida.toFixed(2));
      } else {
        leituraConvertida = Math.round(((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade);
        leituraConvertida = Math.max(0, Math.min(capacidade, leituraConvertida));
      }

      dadosConvertidos[ref] = leituraConvertida;
    }

    // Controle de manutenção
    const LIMITE_MANUTENCAO = 30;
    let manutencaoAtiva = {};
    if (fs.existsSync(MANUTENCAO_FILE)) {
      try { manutencaoAtiva = JSON.parse(fs.readFileSync(MANUTENCAO_FILE, "utf-8")); } catch { manutencaoAtiva = {}; }
    }

    for (const ref of Object.keys(SENSORES)) {
      if (!ref.includes("Reservatorio")) continue;
      const valor = dadosConvertidos[ref];
      const capacidade = SENSORES[ref].capacidade;
      const porcentagem = capacidade ? (valor / capacidade) * 100 : 0;
      if (manutencaoAtiva[ref] && porcentagem > LIMITE_MANUTENCAO) {
        delete manutencaoAtiva[ref];
      }
    }

    fs.writeFileSync(MANUTENCAO_FILE, JSON.stringify(manutencaoAtiva, null, 2));

    dadosConvertidos.timestamp = new Date().toISOString();
    dadosConvertidos.manutencao = manutencaoAtiva;

    console.log("📩 Dados recebidos:", JSON.stringify(dadosConvertidos, null, 2));

    salvarLeituraAtual(dadosConvertidos);
    adicionarAoHistorico(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("❌ Erro ao processar atualização:", err);
    res.status(500).json({ erro: err.message });
  }
});

app.get("/dados", (_, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

app.get("/historico", (_, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")));
});

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
