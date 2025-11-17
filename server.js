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

// === Arquivos públicos ===
app.use(express.static(path.join(__dirname, "public")));

// === Diretórios e arquivos de dados ===
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
    try { historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")); }
    catch { historico = []; }
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
  } else {
    mudou = true;
  }

  if (mudou) {
    historico.push({ timestamp: new Date().toISOString(), ...dados });
    fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
  }
}

/* ===========================================================
   🚀 ROTA PRINCIPAL PARA RECEBER DADOS DO GATEWAY (/atualizar)
   =========================================================== */

app.all("/atualizar", (req, res) => {
  console.log("📡 Requisição recebida no /atualizar");
  console.log("📥 Body recebido:", req.body);

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

    console.log("📊 Após processamento:", dataArray);

    if (!dataArray.length) {
      console.log("❌ Nenhum dado válido recebido!");
      return res.status(400).json({ erro: "Nenhum dado válido" });
    }

    const dadosConvertidos = {};

    for (const item of dataArray) {
      const ref = item.ref || item.name;
      const valor = Number(item.value);

      const sensor = SENSORES[ref];
      if (!sensor) continue;

      const { leituraVazio, leituraCheio, capacidade, tipo } = sensor;

      let leituraConvertida = 0;

      if (tipo === "pressao") {
        leituraConvertida = ((valor - 0.004) / 0.016) * 20;
        leituraConvertida = Math.max(0, Math.min(20, leituraConvertida));
        leituraConvertida = Number(leituraConvertida.toFixed(2));
      } else {
        leituraConvertida = Math.round(((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade);
        leituraConvertida = Math.max(0, Math.min(capacidade, leituraConvertida));
      }

      dadosConvertidos[ref] = leituraConvertida;
    }

    console.log("✅ Convertidos:", dadosConvertidos);

    dadosConvertidos.timestamp = new Date().toISOString();

    salvarLeituraAtual(dadosConvertidos);
    adicionarAoHistorico(dadosConvertidos);

    console.log("💾 Dados salvos com sucesso!");

    return res.json({ status: "ok", dados: dadosConvertidos });

  } catch (err) {
    console.error("❌ Erro ao processar atualização:", err);
    return res.status(500).json({ erro: err.message });
  }
});

/* ==============================
   🟦 ROTA /dados
   ============================== */

app.get("/dados", (_, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

/* ==============================
   🟦 ROTA /historico
   ============================== */

app.get("/historico", (_, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")));
});

/* ==============================
   🟦 LISTA DE RESERVATÓRIOS
   ============================== */

app.get("/lista", (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json([]);

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));
  const reservatorios = new Set();

  historico.forEach(registro => {
    Object.keys(registro).forEach(chave => {
      if (chave.includes("Reservatorio") && chave.endsWith("_current"))
        reservatorios.add(chave);
    });
  });

  res.json([...reservatorios]);
});

/* ==============================
   🟦 HISTÓRICO INDIVIDUAL
   ============================== */

app.get("/historico/:reservatorio", (req, res) => {
  const ref = req.params.reservatorio;

  if (!fs.existsSync(HIST_FILE)) return res.json([]);

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));

  const resposta = historico
    .filter(r => r[ref] !== undefined)
    .map(r => ({
      horario: r.timestamp,
      valor: r[ref]
    }));

  res.json(resposta);
});

/* ==============================
   🟦 PÁGINAS HTML
   ============================== */

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));

/* =====================================================
   🔥 CAPTURA QUALQUER OUTRA ROTA (descobrimos rota Khomp)
   ===================================================== */

app.all("*", (req, res) => {
  console.log("📡 ROTA DESCONHECIDA:", req.method, req.url);
  console.log("📥 BODY:", req.body);
  res.json({ status: "rota-capturada", url: req.url });
});

/* ==============================
   🟢 INICIAR SERVIDOR
   ============================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
