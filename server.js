// ======= Servidor Universal HAG com Alertas =======
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import nodemailer from "nodemailer";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const __dirname = path.resolve();

// === Middleware ===
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// === Servir arquivos estáticos ===
app.use(express.static(path.join(__dirname, "public")));

// === Caminhos ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// === Sensores calibrados ===
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.008056, capacidade: 20000 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.00505, leituraCheio: 0.006693, capacidade: 200 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// === Configuração de alertas ===
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// === Utilitário: ajustar casas decimais ===
function ajustarCasas(sensor, valor) {
  if (sensor.toLowerCase().includes("pressao")) return Number(valor.toFixed(2));
  return Math.round(valor);
}

// === Envio de alertas ===
async function enviarAlerta(tipo, mensagem) {
  console.log("🚨 ALERTA:", mensagem);
  try {
    // E-mail
    await transporter.sendMail({
      from: `"Monitor HAG" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "🚨 Alerta do Sistema HAG",
      text: mensagem
    });

    // WhatsApp (Twilio)
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_PHONE}`,
      to: `whatsapp:${process.env.DEST_PHONE}`,
      body: mensagem
    });
  } catch (err) {
    console.error("❌ Falha ao enviar alerta:", err.message);
  }
}

// === Histórico ===
function registrarHistorico(dados) {
  const hoje = new Date().toISOString().split("T")[0];
  let historico = {};
  if (fs.existsSync(HIST_FILE)) {
    try { historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")); } catch {}
  }
  if (!historico[hoje]) historico[hoje] = {};

  Object.entries(dados).forEach(([ref, valor]) => {
    if (ref === "timestamp" || typeof valor !== "number") return;
    const v = ajustarCasas(ref, valor);
    if (!historico[hoje][ref]) historico[hoje][ref] = { min: v, max: v };
    else {
      historico[hoje][ref].min = Math.min(historico[hoje][ref].min, v);
      historico[hoje][ref].max = Math.max(historico[hoje][ref].max, v);
    }
  });
  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));
}

// === Verifica condições críticas ===
function checarAlertas(dados) {
  Object.entries(dados).forEach(([ref, valor]) => {
    if (ref.includes("Reservatorio")) {
      const sensor = SENSORES[ref];
      const perc = (valor / sensor.capacidade) * 100;
      if (perc < 30)
        enviarAlerta("baixo_nivel", `⚠️ ${ref.replaceAll("_", " ")} abaixo de 30% (${valor} L)`);
    }
    if (ref.includes("Pressao")) {
      if (valor < 0.5 || valor > 5)
        enviarAlerta("pressao_fora_faixa", `⚠️ ${ref.replaceAll("_", " ")} fora da faixa (${valor.toFixed(2)} bar)`);
    }
  });
}

// === Endpoint principal ===
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }

    let dataArray = [];
    if (Array.isArray(body)) dataArray = body;
    else if (Array.isArray(body?.data)) dataArray = body.data;
    else if (typeof body === "object" && body !== null)
      dataArray = Object.keys(body)
        .filter((k) => k.includes("_current"))
        .map((k) => ({ ref: k, value: Number(body[k]) }));

    if (!dataArray.length) return res.status(400).json({ erro: "Nenhum dado válido" });

    const dadosConvertidos = {};
    for (const item of dataArray) {
      const ref = item.ref || item.name;
      const valor = Number(item.value);
      if (!ref || isNaN(valor)) continue;

      const sensor = SENSORES[ref];
      if (!sensor) { dadosConvertidos[ref] = valor; continue; }

      const { leituraVazio, leituraCheio, capacidade, tipo } = sensor;
      let leituraConvertida;
      if (tipo === "pressao") {
        leituraConvertida = ((valor - 0.004) / 0.016) * 20;
        leituraConvertida = Math.max(0, Math.min(20, leituraConvertida));
      } else {
        leituraConvertida = ((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;
        leituraConvertida = Math.max(0, Math.min(capacidade, leituraConvertida));
      }
      dadosConvertidos[ref] = ajustarCasas(ref, leituraConvertida);
    }

    dadosConvertidos.timestamp = new Date().toISOString();

    fs.writeFileSync(DATA_FILE, JSON.stringify(dadosConvertidos, null, 2));
    registrarHistorico(dadosConvertidos);
    checarAlertas(dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("❌ Erro no /atualizar:", err);
    res.status(500).json({ erro: err.message });
  }
});

// === Endpoints auxiliares ===
app.get("/dados", (_, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
});

app.get("/historico", (_, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json({});
  res.json(JSON.parse(fs.readFileSync(HIST_FILE, "utf-8")));
});

// === Rotas principais ===
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/historico-view", (_, res) => res.sendFile(path.join(__dirname, "public", "historico.html")));
app.get("/login", (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// === Inicialização ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor universal HAG ativo na porta ${PORT}`));
