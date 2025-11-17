// === CONFIGURAÇÃO DO SERVIDOR ===
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// === MAPA DOS SENSORES ===
// Aceita com e sem "_current" — sempre converte para "_current" internamente
const SENSORES = {
  // === RESERVATÓRIOS ===
  Reservatorio_Elevador_current: {
    tipo: "reservatorio",
    capacidade: 20000,
    leituraVazio: 0.004,
    leituraCheio: 0.02
  },
  Reservatorio_Osmose_current: {
    tipo: "reservatorio",
    capacidade: 200,
    leituraVazio: 0.004,
    leituraCheio: 0.02
  },
  Reservatorio_CME_current: {
    tipo: "reservatorio",
    capacidade: 1000,
    leituraVazio: 0.004,
    leituraCheio: 0.02
  },
  Reservatorio_Agua_Abrandada_current: {
    tipo: "reservatorio",
    capacidade: 9000,
    leituraVazio: 0.004,
    leituraCheio: 0.02
  },

  // === PRESSÕES ===
  Pressao_Saida_Osmose_current: { tipo: "pressao" },
  Pressao_Retorno_Osmose_current: { tipo: "pressao" },
  Pressao_Saida_CME_current: { tipo: "pressao" },
};

// === ARMAZENAMENTO TEMPORÁRIO DAS ÚLTIMAS LEITURAS ===
let dadosConvertidos = {};
let ultimaAtualizacao = 0;

// === RECEBIMENTO DOS DADOS DO GATEWAY ===
app.post("/gateway", (req, res) => {
  let data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).send("Nenhum dado recebido");
  }

  // aceitar formatos diferentes
  let dataArray = [];

  if (Array.isArray(data)) {
    dataArray = data;
  } else if (data.data && Array.isArray(data.data)) {
    dataArray = data.data;
  } else {
    // formato simples: { "Pressao_Saida_Osmose": 0.00529 }
    dataArray = Object.entries(data).map(([k, v]) => ({
      ref: k,
      value: v
    }));
  }

  for (const item of dataArray) {
    let ref = item.ref || item.name;
    let valor = Number(item.value);

    if (!ref || isNaN(valor)) continue;

    // === NORMALIZAÇÃO ===
    if (!ref.endsWith("_current")) ref += "_current";

    const sensor = SENSORES[ref];
    if (!sensor) continue;

    let leituraConvertida = 0;

    if (sensor.tipo === "pressao") {
      // 4-20mA → 0-20 bar
      leituraConvertida = ((valor - 0.004) / 0.016) * 20;
      leituraConvertida = Math.max(0, Math.min(20, leituraConvertida));
      leituraConvertida = Number(leituraConvertida.toFixed(2));
    } else {
      // reservatórios em litros
      leituraConvertida = Math.round(
        ((valor - sensor.leituraVazio) /
          (sensor.leituraCheio - sensor.leituraVazio)) *
        sensor.capacidade
      );

      leituraConvertida = Math.max(0, Math.min(sensor.capacidade, leituraConvertida));
    }

    dadosConvertidos[ref] = leituraConvertida;
  }

  ultimaAtualizacao = Date.now();
  res.send("OK");
});

// === ROTA DE FORNECIMENTO DE DADOS PARA O DASHBOARD ===
app.get("/dados", (req, res) => {
  res.json({
    ...dadosConvertidos,
    timestamp: ultimaAtualizacao
  });
});

// === INICIAR SERVIDOR ===
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
