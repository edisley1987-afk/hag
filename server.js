// =========================
//  SERVER.JS — ES MODULE
//  COMPATÍVEL COM RENDER.COM
// =========================

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ----------------------------
//   TABELA DE LIMITES
// ----------------------------
const SENSORES = {
  Reservatorio_Elevador_current: {
    leituraVazio: 0.004168,
    leituraCheio: 0.008400,
    capacidade: 20000
  },
  Reservatorio_Osmose_current: {
    leituraVazio: 0.005050,
    leituraCheio: 0.006492,
    capacidade: 200
  },
  Reservatorio_CME_current: {
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    capacidade: 1000
  },
  Reservatorio_Abrandada_current: {
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
    capacidade: 9000
  },

  // Sensores de pressão (BAR)
  Pressao_Saida_Osmose_current: { tipo: "pressao" },
  Pressao_Retorno_Osmose_current: { tipo: "pressao" },
  Pressao_Saida_CME_current: { tipo: "pressao" }
};

// ----------------------------
//   CONVERSÃO DE LEITURA
// ----------------------------
function converterLeitura(ref, valor) {
  const sensor = SENSORES[ref];
  if (!sensor) return { bruto: valor, convertido: valor };

  // ----- PRESSÃO -----
  if (sensor.tipo === "pressao") {
    let bar = ((valor - 0.004) / 0.016) * 20; // 0–20 BAR
    bar = Math.max(0, Math.min(20, bar));
    return { bruto: valor, convertido: Number(bar.toFixed(2)) };
  }

  // ----- RESERVATÓRIO -----
  const { leituraVazio, leituraCheio, capacidade } = sensor;

  if (valor <= leituraVazio) return { bruto: valor, convertido: 0 };
  if (valor >= leituraCheio) return { bruto: valor, convertido: capacidade };

  const litros =
    ((valor - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;

  return { bruto: valor, convertido: Math.round(litros) };
}

// ----------------------------
//   MEMÓRIA EM RAM
// ----------------------------
let ultimaLeitura = {};
let historico = {};

// ----------------------------
//   REGISTRAR HISTÓRICO
// ----------------------------
function salvarHistorico(dados) {
  const dia = new Date().toISOString().split("T")[0];
  if (!historico[dia]) historico[dia] = {};

  Object.entries(dados).forEach(([ref, obj]) => {
    if (ref === "timestamp" || typeof obj.convertido !== "number") return;

    if (!historico[dia][ref]) {
      historico[dia][ref] = {
        min: obj.convertido,
        max: obj.convertido,
        pontos: []
      };
    }

    const reg = historico[dia][ref];
    reg.min = Math.min(reg.min, obj.convertido);
    reg.max = Math.max(reg.max, obj.convertido);

    const ultimo = reg.pontos.at(-1);
    if (!ultimo || Math.abs(obj.convertido - ultimo.valor) >= 2) {
      reg.pontos.push({
        hora: new Date().toLocaleTimeString("pt-BR"),
        valor: obj.convertido
      });
    }
  });
}

// ----------------------------
//   ENDPOINT DO GATEWAY
// ----------------------------
app.post("/atualizar", (req, res) => {
  const brutos = req.body;
  let convertidos = {};

  Object.entries(brutos).forEach(([ref, valor]) => {
    convertidos[ref] = converterLeitura(ref, Number(valor));
  });

  convertidos.timestamp = new Date().toISOString();
  ultimaLeitura = convertidos;

  salvarHistorico(convertidos);

  res.json({ status: "ok", dados: convertidos });
});

// ----------------------------
//   ENDPOINTS DE CONSULTA
// ----------------------------
app.get("/dados", (req, res) => {
  res.json(ultimaLeitura);
});

app.get("/historico", (req, res) => {
  res.json(historico);
});

// ----------------------------
//    FRONT-END
// ----------------------------
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ----------------------------
//    INICIAR SERVIDOR
// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
