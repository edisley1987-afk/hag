/* ======= Servidor HAG — completo com histórico (SEM banco) =======
   - Recebe leituras do gateway
   - Salva última leitura em data/readings.json
   - Mantém historico em data/historico.json (salva quando variação >= 5%)
   - Calcula consumo diário a partir do histórico
   - Endpoints para dashboard e debug
   ================================================================== */

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.urlencoded({ extended: true }));

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

// === Utilitários de arquivo ===
function lerArquivoJSON(caminho, valorPadrao) {
  if (!fs.existsSync(caminho)) return valorPadrao;
  try { return JSON.parse(fs.readFileSync(caminho, "utf-8")); }
  catch (err) { console.error("Erro ao ler JSON:", caminho, err); return valorPadrao; }
}
function salvarArquivoJSON(caminho, dados) {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
}

// === Salvar última leitura e histórico otimizado ===
function salvarLeituraAtual(dados) {
  salvarArquivoJSON(DATA_FILE, dados);
}

function adicionarAoHistorico(dados) {
  let historico = lerArquivoJSON(HIST_FILE, []);
  const ultima = historico.length ? historico[historico.length - 1] : null;
  let mudou = false;

  if (ultima) {
    for (const ref of Object.keys(SENSORES)) {
      if (!ref.includes("Reservatorio")) continue;
      const atual = dados[ref];
      const anterior = ultima[ref];
      const capacidade = SENSORES[ref].capacidade;
      if (capacidade && anterior !== undefined && atual !== undefined) {
        const diffPercent = Math.abs((atual - anterior) / capacidade) * 100;
        if (diffPercent >= 5) { mudou = true; break; }
      }
    }
  } else {
    mudou = true;
  }

  if (mudou) {
    historico.push({ timestamp: new Date().toISOString(), ...dados });
    salvarArquivoJSON(HIST_FILE, historico);
  }
}

// === Função que calcula consumo diário a partir do historico ===
// Estratégia:
// - Agrupa registros por data (YYYY-MM-DD).
// - Para cada reservatório naquela data, pega o primeiro e o último valor.
// - Calcula diff = first - last (assume que nível diminui com consumo).
// - Se diff < 0, define consumo = 0 (evita consumo negativo por enchimentos).
function calcularConsumoDiario(historico) {
  // retorno: { 'YYYY-MM-DD': { reservatorio_ref: { first, last, consumo } } }
  const agrup = {};

  historico.forEach(entry => {
    const ts = new Date(entry.timestamp);
    if (isNaN(ts)) return;
    const dia = ts.toISOString().slice(0, 10); // YYYY-MM-DD

    if (!agrup[dia]) agrup[dia] = [];
    agrup[dia].push(entry);
  });

  const resultado = {};

  for (const dia of Object.keys(agrup).sort()) {
    const registros = agrup[dia].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const first = registros[0];
    const last = registros[registros.length - 1];

    resultado[dia] = {};

    // percorre sensores do tipo reservatorio encontrados nos registros
    const chaves = new Set();
    registros.forEach(r => Object.keys(r).forEach(k => { if (k.includes("Reservatorio") && k.endsWith("_current")) chaves.add(k); }));

    chaves.forEach(ref => {
      const firstVal = first[ref] !== undefined ? first[ref] : null;
      const lastVal = last[ref] !== undefined ? last[ref] : null;
      if (firstVal === null || lastVal === null) {
        resultado[dia][ref] = { first: firstVal, last: lastVal, consumo: 0 };
      } else {
        // consumo assumido como redução do nível: first - last
        let consumo = firstVal - lastVal;
        if (consumo < 0) consumo = 0; // se aumentou (enchimento), considerar 0 consumo
        resultado[dia][ref] = { first: firstVal, last: lastVal, consumo };
      }
    });
  }

  return resultado;
}

// === Receber leituras do Gateway (/atualizar) ===
app.all("/atualizar", (req, res) => {
  console.log("📡 Requisição recebida no /atualizar —", new Date().toISOString());
  console.log("📥 Cabeçalho:", req.headers ? { "content-type": req.headers["content-type"] } : {});
  console.log("📥 Body raw (parcial):", typeof req.body === "object" ? JSON.stringify(req.body).slice(0, 1000) : String(req.body).slice(0,1000));

  try {
    let body = req.body;

    // aceitar buffers/strings
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { /* não-json, mantemos string */ }
    }

    let dataArray = [];

    // vários formatos possíveis do gateway
    if (Array.isArray(body)) dataArray = body;
    else if (Array.isArray(body?.data)) dataArray = body.data;
    else if (typeof body === "object" && body !== null) {
      // transformar objeto { ref_current: valor, ... } em array
      dataArray = Object.keys(body)
        .filter(k => k.includes("_current") || k.includes("ref"))
        .map(k => ({ ref: k, value: body[k] }));
      // também aceitar payloads com estrutura { time, unit, value, ref }
      if (dataArray.length === 0 && body.ref && body.value !== undefined) {
        dataArray = [ { ref: body.ref, value: body.value } ];
      }
    }

    console.log("📊 Data array interpretado:", JSON.stringify(dataArray).slice(0,1000));

    if (!dataArray.length) {
      console.log("❌ Nenhum dado válido detectado no payload.");
      // responder 200 ao gateway com explicação curta (evita reenvios excessivos)
      return res.status(200).json({ status: "no-data", info: "Nenhum dado com formato esperado" });
    }

    const dadosConvertidos = {};

    for (const item of dataArray) {
      const ref = item.ref || item.name;
      const valorRaw = item.value;
      const valor = Number(valorRaw);

      if (!ref || isNaN(valor)) continue;

      const sensor = SENSORES[ref];
      if (!sensor) {
        // se sensor não conhecido, apenas registra raw (útil pra descobrir novos refs)
        dadosConvertidos[ref] = Number(valor.toFixed ? valor.toFixed(4) : valor);
        continue;
      }

      const { leituraVazio, leituraCheio, capacidade, tipo } = sensor;

      let leituraConvertida = 0;

      if (tipo === "pressao") {
        leituraConvertida = ((valor - 0.004) / 0.016) * 20;
        leituraConvertida = Math.max(0, Math.min(20, leituraConvertida));
        leituraConvertida = Number(leituraConvertida.toFixed(2));
      } else {
        // normaliza entre vazio e cheio e converte para capacidade
        leituraConvertida = Math.round(((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade);
        leituraConvertida = Math.max(0, Math.min(capacidade, leituraConvertida));
      }

      dadosConvertidos[ref] = leituraConvertida;
    }

    // atualizar manutenção (mesma lógica que antes)
    const LIMITE_MANUTENCAO = 30;
    let manutencaoAtiva = lerArquivoJSON(MANUTENCAO_FILE, {});
    for (const ref of Object.keys(SENSORES)) {
      if (!ref.includes("Reservatorio")) continue;
      const valor = dadosConvertidos[ref];
      const capacidade = SENSORES[ref].capacidade;
      const porcentagem = capacidade && valor !== undefined ? (valor / capacidade) * 100 : 0;
      if (manutencaoAtiva[ref] && porcentagem > LIMITE_MANUTENCAO) {
        delete manutencaoAtiva[ref];
      }
    }
    salvarArquivoJSON(MANUTENCAO_FILE, manutencaoAtiva);

    // meta dados
    dadosConvertidos.timestamp = new Date().toISOString();
    dadosConvertidos.manutencao = manutencaoAtiva;

    // salvar
    salvarLeituraAtual(dadosConvertidos);
    adicionarAoHistorico(dadosConvertidos);

    console.log("✅ Dados processados e salvos:", JSON.stringify(dadosConvertidos).slice(0,1000));

    // responder 200 rápido ao gateway (evita timeout)
    return res.status(200).json({ status: "ok" });

  } catch (err) {
    console.error("❌ Erro ao processar atualização:", err);
    // responder 500 explicitamente para debugging
    return res.status(500).json({ erro: err.message || String(err) });
  }
});

// === Endpoints públicos para dashboard / frontend ===

// Últimos dados
app.get("/dados", (_, res) => {
  const dados = lerArquivoJSON(DATA_FILE, {});
  res.json(dados);
});

// Histórico completo
app.get("/historico", (_, res) => {
  const historico = lerArquivoJSON(HIST_FILE, []);
  res.json(historico);
});

// Lista de reservatórios (somente chaves que terminam com _current)
app.get("/lista", (_, res) => {
  const historico = lerArquivoJSON(HIST_FILE, []);
  const reservatorios = new Set();
  historico.forEach(reg => {
    Object.keys(reg).forEach(k => {
      if (k.includes("Reservatorio") && k.endsWith("_current")) reservatorios.add(k);
    });
  });
  res.json([...reservatorios]);
});

// Histórico individual do reservatório
app.get("/historico/:reservatorio", (req, res) => {
  const ref = req.params.reservatorio;
  const historico = lerArquivoJSON(HIST_FILE, []);
  const resposta = historico
    .filter(r => r[ref] !== undefined)
    .map(r => ({ horario: r.timestamp, valor: r[ref] }));
  res.json(resposta);
});

// Consumo diário calculado a partir do historico
app.get("/consumo-diario", (_, res) => {
  const historico = lerArquivoJSON(HIST_FILE, []);
  const consumoPorDia = calcularConsumoDiario(historico);
  res.json(consumoPorDia);
});

// Dashboard data (últimos valores + consumo últimos 7 dias)
app.get("/dashboard-data", (_, res) => {
  const dados = lerArquivoJSON(DATA_FILE, {});
  const historico = lerArquivoJSON(HIST_FILE, []);
  const consumo = calcularConsumoDiario(historico);

  // pegar últimos 7 dias de consumo ordenados (se existirem)
  const dias = Object.keys(consumo).sort().slice(-7);
  const consumo7dias = {};
  dias.forEach(d => consumo7dias[d] = consumo[d]);

  res.json({ last: dados, consumo7dias });
});

// Páginas estáticas (se usar frontend estático em /public)
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")).catch(()=>res.sendStatus(404)));

// Captura QUALQUER outra rota (útil para descobrir qual path o gateway está usando)
app.all("*", (req, res) => {
  console.log("📡 ROTA DESCONHECIDA RECEBIDA:", req.method, req.url);
  console.log("📥 BODY:", typeof req.body === "object" ? JSON.stringify(req.body).slice(0,1000) : String(req.body).slice(0,1000));
  // responder 200 para evitar reenvios
  res.json({ status: "rota-capturada", url: req.url });
});

// === Start server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
