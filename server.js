// server.js — servidor tolerante a qualquer tipo de dado
// ----------------------------------------------------
// Pronto para rodar com: node server.js
// ----------------------------------------------------

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
// limite razoável para evitar payloads gigantes (ajusta se precisar)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));

// Configurações (exemplo de sensor; mantenha/expanda conforme precisar)
const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000, vazio: 0.004168, cheio: 0.007855 },
  "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200, vazio: 0.00505, cheio: 0.006533 },
  "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000, vazio: 0.004088, cheio: 0.004408 },
  "Agua_Abrandada_current": { nome: "Reservatório Água Abrandada", capacidade: 9000, vazio: 0.004008, cheio: 0.004929 }
};

// aliases comuns (lowercase)
const ALIASES = {
  "pressao_saida_current": "Presao_Saida_current",
  "pressao_retorno_current": "Pressao_Retorno_current"
};

// util: tenta extrair/parsear um número de quase qualquer valor
function parseNumberLoose(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") {
    // se for objeto com campo value/val/reading/measurement, tenta extrair
    for (const k of ["value","val","reading","measurement","raw"]) {
      if (k in v) return parseNumberLoose(v[k]);
    }
    return NaN;
  }
  if (typeof v === "string") {
    // remove espaços, tenta trocar vírgula por ponto
    let s = v.trim().replace(/\s+/g, "");
    // extrair primeiro número (suporta coisas como "val=0,0065V" ou "0.0065")
    const m = s.match(/-?\d+([.,]\d+)?/);
    if (!m) return NaN;
    s = m[0].replace(",", ".");
    const n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  return NaN;
}

// util: normaliza uma chave de sensor
function normalizeKey(k) {
  if (!k || typeof k !== "string") return null;
  return k.trim().replace(/\s+/g, "_");
}

// pega possíveis campos de referência do item
function extractRef(item) {
  if (!item) return null;
  // checar propriedades comuns
  for (const k of ["ref","name","sensor","id","key"]) {
    if (k in item && item[k]) return String(item[k]);
  }
  // se o item for string simples
  if (typeof item === "string") return item;
  return null;
}

// pega possível valor dentro do item
function extractValue(item) {
  if (item === null || item === undefined) return NaN;
  // se item for primitivo, tenta parsear diretamente
  if (typeof item === "number" || typeof item === "string" || typeof item === "boolean") {
    return parseNumberLoose(item);
  }
  // se for objeto, procura campos comuns
  for (const k of ["value","val","reading","measurement","raw","v"]) {
    if (k in item) return parseNumberLoose(item[k]);
  }
  // se tiver apenas uma propriedade cujo valor é primitivo, usa esse
  const keys = Object.keys(item);
  if (keys.length === 1) return parseNumberLoose(item[keys[0]]);
  return NaN;
}

// monta lista de itens a partir do payload (suporta várias estruturas)
function flattenPayload(payload) {
  const out = [];

  if (payload === null || payload === undefined) return out;

  // se veio um array diretamente
  if (Array.isArray(payload)) {
    payload.forEach(it => {
      // cada elemento pode ser { ref, value } ou apenas {"sensor":123} etc
      const ref = extractRef(it);
      const val = extractValue(it);
      out.push({ raw: it, ref, value: val, time: it && it.time ? itemTimeToNumber(it.time) : Date.now() });
    });
    return out;
  }

  // se veio dentro de { data: [...] }
  if (payload && Array.isArray(payload.data)) {
    payload.data.forEach(it => {
      const ref = extractRef(it);
      const val = extractValue(it);
      out.push({ raw: it, ref, value: val, time: it && it.time ? itemTimeToNumber(it.time) : Date.now() });
    });
    return out;
  }

  // se payload for um objeto e contém pares nome:valor (ex: {"Reservatorio_Elevador_current": {...}})
  if (typeof payload === "object") {
    // caso comum: chaves top-level são sensores
    const keys = Object.keys(payload);
    let foundSensorStyle = false;
    for (const k of keys) {
      const possible = payload[k];
      // heurística: se o valor é objeto com campo 'value' ou primitivo -> consideramos sensor
      if (typeof possible === "object" && possible !== null && ("value" in possible || "val" in possible || Object.keys(possible).length === 1)) {
        foundSensorStyle = true;
        break;
      }
      if (typeof possible === "number" || typeof possible === "string" || typeof possible === "boolean") {
        foundSensorStyle = true;
        break;
      }
    }
    if (foundSensorStyle) {
      for (const k of keys) {
        const possible = payload[k];
        const ref = k;
        const value = extractValue(possible);
        out.push({ raw: possible, ref, value, time: (possible && possible.time) ? itemTimeToNumber(possible.time) : Date.now() });
      }
      return out;
    }
  }

  // fallback: tratar payload como um único item com ref & value tentados
  const ref = extractRef(payload);
  const value = extractValue(payload);
  out.push({ raw: payload, ref, value, time: payload && payload.time ? itemTimeToNumber(payload.time) : Date.now() });
  return out;
}

// tenta transformar `time` em número unix ms
function itemTimeToNumber(t) {
  if (!t) return Date.now();
  if (typeof t === "number") return t;
  const n = parseNumberLoose(t);
  if (!isNaN(n) && n > 1000000000) return n; // timestamp provável
  const date = new Date(String(t));
  if (!isNaN(date.getTime())) return date.getTime();
  return Date.now();
}

// atualiza arquivo com registros processados
function saveReadings(current) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(current, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Erro ao salvar readings.json:", err);
    return false;
  }
}

// endpoint de recebimento
app.post("/atualizar", (req, res) => {
  const payload = req.body;
  if (!payload) return res.status(400).json({ success: false, error: "Payload vazio" });

  let current = {};
  try {
    current = JSON.parse(fs.readFileSync(DATA_FILE, "utf8") || "{}");
  } catch (e) {
    current = {};
  }

  const items = flattenPayload(payload);
  if (!items.length) {
    return res.status(400).json({ success: false, error: "Nenhum item válido encontrado no payload" });
  }

  const results = [];
  items.forEach((it, idx) => {
    const originalRef = it.ref;
    const refNormalized = originalRef ? normalizeKey(originalRef) : null;
    let ref = refNormalized || `item_${Date.now()}_${idx}`;

    // aplica aliases (lowercase)
    const lower = (ref || "").toLowerCase();
    if (ALIASES[lower]) ref = ALIASES[lower];

    const parsed = parseNumberLoose(it.value);

    // monta registro base
    const record = {
      nome: ref,
      raw_received: it.raw,
      raw_value: it.value,
      parsed_value: isNaN(parsed) ? null : parsed,
      time_received: new Date(it.time || Date.now()).toISOString()
    };

    // se temos cfg para conversão em litros, calcula
    const cfg = SENSOR_CONFIG[ref] || SENSOR_CONFIG[originalRef] || null;
    if (cfg && !isNaN(parsed)) {
      const { capacidade = 0, vazio = 0, cheio = 0 } = cfg;
      let ratio = (cheio !== vazio) ? (parsed - vazio) / (cheio - vazio) : 0;
      ratio = Math.max(0, Math.min(1, ratio));
      record.litros = Number((capacidade * ratio).toFixed(2));
    } else if (cfg && isNaN(parsed)) {
      record.note = "Sensor conhecido mas valor não numérico — armazenado raw";
    } else if (!cfg && !isNaN(parsed)) {
      // sensor desconhecido mas com número — armazena valor bruto
      record.litros = null;
      record.value_num = parsed;
    } else {
      record.note = "Sem cfg e sem valor numérico";
    }

    // grava no current (chave sensata)
    const keyToSave = ref || (`item_${Date.now()}_${idx}`);
    current[keyToSave] = record;
    results.push({ key: keyToSave, status: "saved", parsed: record.parsed_value });
  });

  const ok = saveReadings(current);
  if (!ok) return res.status(500).json({ success: false, error: "Falha ao salvar dados" });

  console.log(`✅ Atualização recebida: ${results.length} itens (${results.map(r => r.key).join(", ")})`);
  return res.json({ success: true, saved: results.length, details: results });
});

// rota para ver dados
app.get("/dados", (req, res) => {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    res.setHeader("Content-Type", "application/json");
    res.send(raw);
  } catch (err) {
    res.status(500).json({ error: "Erro ao ler dados" });
  }
});

// rota raiz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Servidor tolerante rodando na porta ${PORT}`));
