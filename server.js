// ======= Servidor Universal HAG (com histórico otimizado + CONSUMO DIÁRIO SALVO) =======
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

// ====== Arquivos de dados ======
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUTENCAO_FILE = path.join(DATA_DIR, "manutencao.json");
const CONSUMO_FILE = path.join(DATA_DIR, "consumo_diario.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ======= Calibração dos sensores =======
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008256, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006693, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },

  // Pressão
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// ========= FUNÇÕES UTILITÁRIAS =========
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

        // Salva apenas alterações de 5% (para compactar histórico)
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

// ======== SALVAR CONSUMO DIÁRIO ========
function calcularConsumoDiario() {
  if (!fs.existsSync(HIST_FILE)) return;
  let historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8"));

  if (historico.length < 2) return;

  const consumo = {};

  historico.forEach(entry => {
    const data = entry.timestamp.split("T")[0]; // yyyy-mm-dd

    if (!consumo[data]) consumo[data] = { elevadorMax: 0, osmoseMax: 0 };

    if (entry.Reservatorio_Elevador_current !== undefined)
      consumo[data].elevadorMax = Math.max(consumo[data].elevadorMax, entry.Reservatorio_Elevador_current);

    if (entry.Reservatorio_Osmose_current !== undefined)
      consumo[data].osmoseMax = Math.max(consumo[data].osmoseMax, entry.Reservatorio_Osmose_current);
  });

  const dias = Object.keys(consumo).sort();
  const consumoFinal = [];

  for (let i = 1; i < dias.length; i++) {
    const ant = consumo[dias[i - 1]];
    const atual = consumo[dias[i]];

    consumoFinal.push({
      dia: dias[i],
      elevador: Math.max(0, ant.elevadorMax - atual.elevadorMax),
      osmose: Math.max(0, ant.osmoseMax - atual.osmoseMax)
    });
  }

  fs.writeFileSync(CONSUMO_FILE, JSON.stringify(consumoFinal, null, 2));
}

// Atualiza a cada 1 hora
setInterval(calcularConsumoDiario, 60 * 60 * 1000);
calcularConsumoDiario();

// ======== API: receber dados do gateway ========
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

    if (!dataArray.length)
      return res.status(400).json({ erro: "Nenhum dado válido" });

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
    const LIMITE_MANUT = 30;
    let manutencao = {};

    if (fs.existsSync(MANUTENCAO_FILE)) {
      try { manutencao = JSON.parse(fs.readFileSync(MANUTENCAO_FILE, "utf-8")); }
      catch { manutencao = {}; }
    }

    for (const ref of Object.keys(SENSORES)) {
      if (!ref.includes("Reservatorio")) continue;

      const valor = dadosConvertidos[ref];
      const cap = SENSORES[ref].capacidade;
      const pct = cap ? (valor / cap) * 100 : 0;

      if (manutencao[ref] && pct > LIMITE_MANUT) delete manutencao[ref];
    }

    fs.writeFileSync(MANUTENCAO_FILE, JSON.stringify(manutencao, null, 2));

    dadosConvertidos.timestamp = new Date().toISOString();
    dadosConvertidos.manutencao = manutencao;

    salvarLeituraAtual(dadosConvertidos);
    adicionarAoHistorico(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });

  } catch (err) {
    console.error("❌ Erro atualização:", err);
    res.status(500).json({ erro: err.message });
  }
});

// ======== Rotas API ========
app.get("/dados", (_, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

app.get("/historico", (_, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")));
});

app.get("/consumo-diario", (_, res) => {
  if (!fs.existsSync(CONSUMO_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(CONSUMO_FILE, "utf-8")));
});

// ======== Rotas páginas ========
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/consumo", (_, res) => res.sendFile(path.join(__dirname, "public", "consumo.html")));

// ======== Inicialização ========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Servidor rodando na porta ${PORT}`)
);
