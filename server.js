// server.js — Servidor COMPLETO (WEB + API + processamento IoT)
// Requer Node >= 14. Use CommonJS (require)

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const __dirnameRoot = path.resolve();

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.urlencoded({ extended: true }));

// --- Paths e arquivos ---
const PUBLIC_DIR = path.join(__dirnameRoot, "public");
const DATA_DIR = path.join(__dirnameRoot, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const MANUT_FILE = path.join(DATA_DIR, "manutencao.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// === Sensores / calibração (capacidade confirmada) ===
const SENSORES = {
  "Reservatorio_Elevador_current": { tipo: "reservatorio", leituraVazio: 0.004168, leituraCheio: 0.008256, capacidade: 20000 },
  "Reservatorio_Osmose_current": { tipo: "reservatorio", leituraVazio: 0.00505, leituraCheio: 0.006693, capacidade: 200 },
  "Reservatorio_CME_current": { tipo: "reservatorio", leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { tipo: "reservatorio", leituraVazio: 0.004008, leituraCheio: 0.004929, capacidade: 9000 },

  "Pressao_Saida_Osmose_current": { tipo: "pressao" },
  "Pressao_Retorno_Osmose_current": { tipo: "pressao" },
  "Pressao_Saida_CME_current": { tipo: "pressao" }
};

// --- Utilitários simples ---
function lerJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const txt = fs.readFileSync(filePath, "utf8");
    return JSON.parse(txt || "null") || defaultValue;
  } catch (e) {
    return defaultValue;
  }
}
function gravarJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

// --- Funções de persistência ---
function salvarLeituraAtual(dados) {
  gravarJson(DATA_FILE, dados);
}

function adicionarAoHistorico(dados) {
  let historico = lerJson(HIST_FILE, []);
  const ultima = historico.length ? historico[historico.length - 1] : null;
  let mudou = false;

  // Se não houver histórico → gravar
  if (!ultima) mudou = true;
  else {
    // verificar variação >=5% com base na capacidade (apenas reservatórios)
    for (const key of Object.keys(SENSORES)) {
      if (!key.includes("Reservatorio")) continue;
      const capacidade = SENSORES[key].capacidade;
      if (!capacidade) continue;
      const atual = dados[key];
      const anterior = ultima[key];
      if (typeof atual === "number" && typeof anterior === "number") {
        const diffPercent = Math.abs((atual - anterior) / capacidade) * 100;
        if (diffPercent >= 5) {
          mudou = true;
          break;
        }
      } else if (anterior === undefined && atual !== undefined) {
        mudou = true;
        break;
      }
    }
  }

  if (mudou) {
    historico.push({ timestamp: new Date().toISOString(), ...dados });
    gravarJson(HIST_FILE, historico);
  }
}

// --- Normalização: aceitar key com ou sem "_current" ---
function normalizarNome(ref) {
  if (!ref || typeof ref !== "string") return null;
  // remover espaços e normalizar underscores e maiúsculas simples
  ref = ref.trim();
  // se vier em lower_case ou com espaços, tentar ajustar simples:
  // Ex: "reservatorio osmose" -> "Reservatorio_Osmose"
  // Mas não forçar conversões complexas — assume que gateway envia nomes próximos do esperado.
  if (!ref.endsWith("_current")) ref = ref + "_current";
  return ref;
}

// --- Conversão de leituras ---
function converterLeituraParaValor(ref, rawValor) {
  const sensor = SENSORES[ref];
  if (!sensor) return null;

  const valor = Number(rawValor);
  if (isNaN(valor)) return null;

  if (sensor.tipo === "pressao") {
    // Converter (exemplo 4-20mA mapeado ao intervalo 0.004 - 0.020) → 0-20 bar
    // Fórmula: ((valor - 0.004) / (0.016)) * 20
    let leitura = ((valor - 0.004) / 0.016) * 20;
    leitura = Math.max(0, Math.min(20, leitura));
    return Number(leitura.toFixed(2));
  }

  // Reservatório → litros usando leituraVazio/leituraCheio e capacidade
  const { leituraVazio, leituraCheio, capacidade } = sensor;
  if (typeof leituraVazio !== "number" || typeof leituraCheio !== "number" || !capacidade) return null;

  const proporcao = (valor - leituraVazio) / (leituraCheio - leituraVazio);
  let litros = Math.round(proporcao * capacidade);
  litros = Math.max(0, Math.min(capacidade, litros));
  return litros;
}

// === Rota de ingestão (aceita qualquer verbo e caminhos começando por /atualizar) ===
app.all(/^\/atualizar(\/.*)?$/, (req, res) => {
  try {
    let body = req.body;

    // Se veio buffer/string com JSON
    if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString("utf8")); } catch {}
    }
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    // Normalizar formatos:
    // - Array de objetos { ref, value } ou { name, value }
    // - { "NomeSensor": valor, ... }
    // - { data: [ ... ] }
    let dataArray = [];

    if (Array.isArray(body)) {
      dataArray = body;
    } else if (Array.isArray(body?.data)) {
      dataArray = body.data;
    } else if (typeof body === "object" && body !== null) {
      // detectar se objeto plano com chaves de sensor
      const possibleKeys = Object.keys(body);
      const looksLikeFlat = possibleKeys.length && typeof body[possibleKeys[0]] !== "object";
      if (looksLikeFlat) {
        dataArray = possibleKeys.map(k => ({ ref: k, value: body[k] }));
      } else {
        // tentar transformar objectos com { name, value } ou { ref, value }
        dataArray = Object.values(body).filter(v => typeof v === "object" && (v.ref || v.name || v.value !== undefined));
        // se ainda vazio, tentar pegar body as single reading
        if (!dataArray.length && (body.ref || body.name || body.value !== undefined)) {
          dataArray = [body];
        }
      }
    }

    if (!dataArray.length) {
      // nada válido → resposta 400 mas logue para debugar
      console.log("📥 /atualizar recebido, mas sem dados válidos. BODY:", JSON.stringify(req.body).slice(0, 1000));
      return res.status(400).json({ erro: "Nenhum dado válido recebido" });
    }

    // Lê manutenção atual
    let manut = lerJson(MANUT_FILE, {});

    const dadosConvertidos = {};
    // Preencher com leitura anterior como fallback (manter campos anteriores se necessário)
    const atualAnterior = lerJson(DATA_FILE, {});
    Object.assign(dadosConvertidos, atualAnterior);

    for (const item of dataArray) {
      // item pode ser { ref, value } ou { name, value } ou chave plana
      let ref = item.ref || item.name || item.Ref || item.Name;
      let valor = item.value ?? item.valor ?? item.v ?? item.Value;

      // se veio como [ { "Name":"Reservatorio_Osmose", "Value":0.005 } ] ou plan JSON, adapt.
      // se item for primitivo, ignorar
      if ((ref === undefined || valor === undefined) && typeof item !== "object") continue;

      // se ref está ausente mas item tem apenas um par chave:valor, tentar extrair
      if ((!ref || ref === "undefined") && Object.keys(item).length === 1) {
        const k = Object.keys(item)[0];
        ref = k;
        valor = item[k];
      }

      if (!ref) continue;

      // normalizar nome (adiciona _current se faltar)
      ref = normalizarNome(String(ref));

      const convertido = converterLeituraParaValor(ref, valor);
      if (convertedIsValid(convertido)) {
        dadosConvertidos[ref] = convertido;
      } else if (convertido !== null) {
        // se convertido é null, ignorar
      } else {
        // ignorar leituras inválidas
      }
    }

    // atualizar manutenção: se um reservatório estiver marcado em manut e passar de 30% remove
    const LIMITE_MANUT = 30;
    for (const k of Object.keys(SENSORES)) {
      if (!k.includes("Reservatorio")) continue;
      const val = dadosConvertidos[k];
      const cap = SENSORES[k].capacidade;
      if (typeof val === "number" && cap) {
        const perc = (val / cap) * 100;
        if (manut[k] && perc > LIMITE_MANUT) delete manut[k];
      }
    }

    gravarJson(MANUT_FILE, manut);

    // adicionar metadados
    dadosConvertidos.timestamp = new Date().toISOString();
    dadosConvertidos.manutencao = manut;

    // salvar leitura atual e possivelmente histórico
    salvarLeituraAtual(dadosConvertidos);
    adicionarAoHistorico(dadosConvertidos);

    console.log("✅ /atualizar processado →", Object.keys(dadosConvertidos).join(", "));

    return res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("❌ Erro em /atualizar:", err);
    return res.status(500).json({ erro: String(err) });
  }
});

// --- Helper para validar convertido (aceitar 0 como válido) ---
function convertedIsValid(v) {
  return v !== null && v !== undefined && !Number.isNaN(v);
}

// --- Rota para entregar a última leitura (para o dashboard) ---
app.get("/dados", (req, res) => {
  const last = lerJson(DATA_FILE, {});
  // padronizar timestamp: se for ISO, ok; se for number, transformar
  res.json(last);
});

// --- Histórico geral ---
app.get("/historico", (req, res) => {
  const hist = lerJson(HIST_FILE, []);
  res.json(hist);
});

// --- Lista somente reservatórios (nomes com _current) ---
app.get("/lista", (req, res) => {
  const hist = lerJson(HIST_FILE, []);
  const setRes = new Set();
  hist.forEach(h => {
    Object.keys(h).forEach(k => {
      if (k.includes("Reservatorio") && k.endsWith("_current")) setRes.add(k);
    });
  });
  res.json([...setRes]);
});

// --- Histórico individual por nome (espera nome com _current) ---
app.get("/historico/:reservatorio", (req, res) => {
  const ref = req.params.reservatorio;
  const hist = lerJson(HIST_FILE, []);
  const resp = hist
    .filter(r => r[ref] !== undefined)
    .map(r => ({ horario: r.timestamp, valor: r[ref] }));
  res.json(resp);
});

// --- Servir arquivos estáticos da pasta public ---
app.use(express.static(PUBLIC_DIR));
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// --- Captura QUALQUER outra rota para debug (útil para ver o body que o gateway está enviando) ---
app.all("*", (req, res) => {
  try {
    console.log("📡 ROTA DESCONHECIDA:", req.method, req.url);
    let bodyPreview = "";
    if (req.body) {
      try { bodyPreview = JSON.stringify(req.body).slice(0, 1000); } catch { bodyPreview = String(req.body).slice(0, 1000); }
    }
    console.log("📥 BODY PREVIEW:", bodyPreview);
  } catch (e) {}
  // responder 200 para evitar reenvios do gateway
  res.status(200).json({ status: "rota-capturada", url: req.url });
});

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
