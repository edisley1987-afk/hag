// server.js — Servidor Universal HAG (aceita qualquer porta, BasicAuth opcional)
// Compatível com gateway: { seq, data: [ { time, unit, value, dev_id, ref }, ... ] }

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// ========== CONFIG ==========
app.use(cors());
app.use(express.json({ limit: "20mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// diretórios e arquivos
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DATA_FILE = path.join(DATA_DIR, "readings.json");      // guarda última leitura com metadados
const HISTORICO_FILE = path.join(DATA_DIR, "historico.json"); // guarda histórico de pacotes

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
if (!fs.existsSync(HISTORICO_FILE)) fs.writeFileSync(HISTORICO_FILE, "[]");

// ======== Conversões (opcional) ========
// Se quiser converter o "value" bruto para litros, metros, %, etc,
// adicione uma entrada com o fator multiplicador ou função.
// Exemplo: para transformar um sensor que retorna 0.00745 em 7450 L,
// usar fator: 1000000 (apenas exemplo).
// Por padrão os fatores são 1 (retorna o valor bruto).
const CONVERSOES = {
  // "Reservatorio_Elevador_current": { factor: 1, offset: 0 }, // padrão
  // "Reservatorio_Osmose_current": { factor: 1000, offset: 0 },
  // adicione mapeamentos conforme você quiser
};

// Função de conversão segura
function aplicarConversao(ref, rawValue) {
  if (rawValue === null || typeof rawValue === "undefined") return rawValue;
  const cfg = CONVERSOES[ref];
  if (!cfg) return Number(rawValue); // sem conversão -> retorna número
  const factor = Number(cfg.factor || 1);
  const offset = Number(cfg.offset || 0);
  return Number(rawValue) * factor + offset;
}

// ======= HELPERS =======
function lerJSON(caminho, fallback) {
  try {
    const txt = fs.readFileSync(caminho, "utf8");
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}
function gravarJSON(caminho, obj) {
  fs.writeFileSync(caminho, JSON.stringify(obj, null, 2), "utf8");
}

// ==============================
// ROTA /atualizar (GATEWAY)
// ==============================
app.post("/atualizar", (req, res) => {
  console.log("\n=========================");
  console.log("📩 RECEBIDO /atualizar");
  console.log("=========================");

  // Exibir cabeçalhos essenciais (útil para debugging)
  console.log("IP: ", req.headers["x-forwarded-for"] || req.socket.remoteAddress);
  console.log("AUTH: ", req.headers.authorization ? "[presente]" : "[ausente]");
  console.log("CONTENT-TYPE:", req.headers["content-type"]);

  let body = req.body;

  // Caso venha texto, tentar parsear JSON
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (err) {
      console.log("❌ Body não é JSON válido:", err.message);
      return res.status(400).json({ erro: "JSON inválido" });
    }
  }

  // validar formato esperado
  if (!body || !Array.isArray(body.data)) {
    return res.status(400).json({ erro: "Formato inválido. Esperado { seq, data[] }" });
  }

  const timestamp = new Date().toISOString();

  // carregar últimas leituras (metadados)
  let ultima = lerJSON(DATA_FILE, {});

  // processar cada item em body.data
  const atualizadoRefs = [];
  body.data.forEach(item => {
    if (!item || !item.ref) return;
    const ref = String(item.ref);
    // armazenar metadados completos
    ultima[ref] = {
      raw_value: item.value,
      time: item.time,
      dev_id: item.dev_id,
      unit: item.unit,
      seq: body.seq,
      received_at: timestamp
    };
    atualizadoRefs.push(ref);
  });

  // salvar arquivo de últimas leituras (metadados)
  gravarJSON(DATA_FILE, ultima);
  console.log(`💾 Atualizadas ${atualizadoRefs.length} refs`);

  // salvar no histórico
  const historico = lerJSON(HISTORICO_FILE, []);
  historico.push({
    seq: body.seq,
    received_at: timestamp,
    data: body.data
  });
  gravarJSON(HISTORICO_FILE, historico);

  return res.json({ status: "OK", recebidos: atualizadoRefs.length });
});

// ==============================
// ROTA /dados → para o dashboard
// Retorna objeto plano: { ref1: numericValue, ref2: numericValue, timestamp }
// ==============================
app.get("/dados", (req, res) => {
  const ultima = lerJSON(DATA_FILE, {});

  const flat = {};
  const keys = Object.keys(ultima);
  keys.forEach(ref => {
    const item = ultima[ref];

    // Se estrutura for a que gravamos: { raw_value, ... }
    if (item && Object.prototype.hasOwnProperty.call(item, "raw_value")) {
      flat[ref] = aplicarConversao(ref, item.raw_value);
    } else if (typeof item === "number") {
      // caso antigo: valor simples
      flat[ref] = item;
    } else if (item && typeof item.value !== "undefined") {
      // fallback: item.value
      flat[ref] = aplicarConversao(ref, item.value);
    } else {
      // não sabemos -> pular
    }
  });

  flat.timestamp = new Date().toISOString();

  return res.json(flat);
});

// ==============================
// ROTA /historico → retorna histórico de pacotes (array)
// ==============================
app.get("/historico", (req, res) => {
  const historico = lerJSON(HISTORICO_FILE, []);
  return res.json(historico);
});

// Endpoint opcional para inspecionar arquivo completo (metadados)
// (útil para debug: /debug/readings)
app.get("/debug/readings", (req, res) => {
  const ultima = lerJSON(DATA_FILE, {});
  return res.json(ultima);
});

// ==============================
// INICIAR SERVIDOR (QUALQUER PORTA)
// ==============================
const PORT = process.env.PORT || 0;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ativo na porta: ${PORT}`);
  console.log("📁 DATA_FILE:", DATA_FILE);
  console.log("📁 HIST_FILE:", HISTORICO_FILE);
});
