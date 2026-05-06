/**
 * SISTEMA HAG SCADA - VERSÃO FINAL ESTÁVEL
 */
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import compression from "compression";
import http from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ================= MIDDLEWARES =================
app.use(cors());
app.use(compression());
// Apenas JSON é necessário para o Gateway Khomp
app.use(express.json({ limit: "1mb" })); 

// ================= ARQUIVOS E SENSORES =================
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.005170, leituraCheio: 0.010247, capacidade: 20000, altura: 1.45 },
  "Reservatorio_Osmose_current": { leituraVazio: 0.005050, leituraCheio: 0.006973, capacidade: 200, altura: 1.0 },
  "Reservatorio_CME_current": { leituraVazio: 0.004088, leituraCheio: 0.005370, capacidade: 1000, altura: 0.45 },
  "Reservatorio_Agua_Abrandada_current": { leituraVazio: 0.004048, leituraCheio: 0.004970, capacidade: 9000, altura: 0.6 },
  "Reservatorio_lavanderia_current": { leituraVazio: 0.006012, leituraCheio: 0.011623, capacidade: 10000, altura: 1.45 },
  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" },
  "Bomba_01_binary": { tipo: "bomba" },
  "Ciclos_Bomba_01_counter": { tipo: "ciclo" },
  "Bomba_02_binary": { tipo: "bomba" },
  "Ciclos_Bomba_02_counter": { tipo: "ciclo" },
  "Bomba_Osmose_binary": { tipo: "bomba" },
  "Ciclos_Bomba_Osmose_counter": { tipo: "ciclo" }
};

const MAPA_RESERVATORIOS = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
  lavanderia: "Reservatorio_lavanderia_current"
};

// ================= HELPERS ESSENCIAIS =================
function safeReadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8") || "{}"); } catch { return fallback; }
}

function safeWriteJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) { console.error(e); }
}

function parseTimestamp(time) {
    // Converte timestamp de microssegundos (Gateway) para ISO string
    return new Date(Number(time) / 1000).toISOString();
}

function calcularNivel(ref, leitura) {
  const s = SENSORES[ref];
  if (!s?.capacidade) return { percentual: 0, litros: 0, altura: 0 };
  const span = s.leituraCheio - s.leituraVazio;
  let p = Math.max(0, Math.min(1, (leitura - s.leituraVazio) / span));
  return { percentual: p, litros: Math.round(p * s.capacidade), altura: Math.round(p * s.altura * 100) };
}

// ================= LÓGICA DE DADOS =================
function convertAndMerge(arr) {
  const dados = safeReadJson(DATA_FILE, {});
  const ts = new Date().toISOString();
  arr.forEach(i => {
    if (!SENSORES[i.ref]) return;
    let v = Number(i.value);
    if (SENSORES[i.ref].tipo === "pressao") v = Math.max(0, Math.min(20, ((v - 0.004) / 0.016) * 20));
    dados[i.ref] = v;
    dados[i.ref + "_timestamp"] = i.time ? parseTimestamp(i.time) : ts;
  });
  dados.timestamp = ts;
  safeWriteJson(DATA_FILE, dados);
  return dados;
}

function registrarHistorico(dados) {
  const hist = safeReadJson(HIST_FILE, {});
  const agora = Date.now();
  Object.entries(dados).forEach(([k, v]) => {
    if (!k.endsWith("_current") || !SENSORES[k]) return;
    if (!hist[k]) hist[k] = { pontos: [] };
    hist[k].pontos.push({ valor: v, timestamp: agora });
    // Mantém apenas 7 dias
    hist[k].pontos = hist[k].pontos.filter(p => agora - p.timestamp <= 604800000);
  });
  safeWriteJson(HIST_FILE, hist);
}

// ================= WEBSOCKET =================
const wss = new WebSocketServer({ server });
function wsBroadcast(data) { wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(data))); }

// ================= ROTA PRINCIPAL (GATEWAY) =================
app.post(["/atualizar/api/v1_2/json/itg/data", "/atualizar", "/iot"], (req, res) => {
  console.log("🔥 DADO RECEBIDO");
  const payload = req.body; 

  if (!payload || !Array.isArray(payload.data)) {
    return res.status(200).json({ status: "ignored", msg: "formato inválido" });
  }

  try {
    const dados = convertAndMerge(payload.data);
    registrarHistorico(dados);
    res.status(200).json({ status: "success" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================= INICIALIZAÇÃO =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
