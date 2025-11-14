// ======= Servidor Universal HAG =======

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// ===========================
// CONFIGURAÇÕES
// ===========================
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// === Servir toda a pasta PUBLIC automaticamente ===
app.use(express.static(path.join(__dirname, "public")));


// ==================================
// PASTA E ARQUIVOS PRINCIPAIS
// ==================================
const DATA_DIR = path.join(__dirname, "data");
const READINGS_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");
const CONSUMO_FILE = path.join(DATA_DIR, "consumo.json");

// Criar pasta data se não existir
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);


// ===========================
// CONFIGURAÇÃO DOS RESERVATÓRIOS
// ===========================
const RESERVATORIOS = {
  "Reservatorio_Elevador_current": {
    nome: "Reservatório Elevador",
    leituraVazio: 0.004168,
    leituraCheio: 0.007855,
    capacidade: 20000
  },
  "Reservatorio_Osmose_current": {
    nome: "Reservatório Osmose",
    leituraVazio: 0.00505,
    leituraCheio: 0.006533,
    capacidade: 200
  },
  "Reservatorio_CME_current": {
    nome: "Reservatório CME",
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    capacidade: 1000
  },
  "Reservatorio_Agua_Abrandada_current": {
    nome: "Reservatório Água Abrandada",
    leituraVazio: 0.144,
    leituraCheio: 1.37,
    capacidade: 5000
  }
};


// =========================================
// FUNÇÃO: Calcular litros a partir da leitura
// =========================================
function calcularLitros(id, leitura) {
  const cfg = RESERVATORIOS[id];
  if (!cfg) return null;

  const { leituraVazio, leituraCheio, capacidade } = cfg;

  // Proteção
  if (leitura <= leituraVazio) return 0;
  if (leitura >= leituraCheio) return capacidade;

  const perc = (leitura - leituraVazio) / (leituraCheio - leituraVazio);
  return Math.round(capacidade * perc);
}


// =========================================
// ROTA: RECEBER LEITURAS DO GATEWAY
// =========================================
app.post("/gateway", (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({ erro: "JSON inválido" });
    }

    // Corrigir nome dos reservatórios recebidos
    const leiturasProcessadas = {};

    Object.keys(data).forEach((id) => {
      if (!RESERVATORIOS[id]) return;

      const leituraBruta = Number(data[id]);
      const litros = calcularLitros(id, leituraBruta);

      leiturasProcessadas[id] = {
        leitura: leituraBruta,
        litros,
        atualizado: new Date().toISOString()
      };
    });

    // Salvar último estado completo
    fs.writeFileSync(READINGS_FILE, JSON.stringify(leiturasProcessadas, null, 2));

    // Registrar no histórico
    const historico = fs.existsSync(HIST_FILE)
      ? JSON.parse(fs.readFileSync(HIST_FILE))
      : [];

    historico.push({
      timestamp: new Date().toISOString(),
      dados: leiturasProcessadas
    });

    fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));

    // Registrar consumo por dia
    const consumo = fs.existsSync(CONSUMO_FILE)
      ? JSON.parse(fs.readFileSync(CONSUMO_FILE))
      : {};

    const dia = new Date().toISOString().slice(0, 10);

    if (!consumo[dia]) consumo[dia] = {};

    Object.keys(leiturasProcessadas).forEach((id) => {
      consumo[dia][id] = leiturasProcessadas[id].litros;
    });

    fs.writeFileSync(CONSUMO_FILE, JSON.stringify(consumo, null, 2));

    return res.json({ status: "ok", atualizado: leiturasProcessadas });

  } catch (err) {
    console.error("Erro no gateway:", err);
    return res.status(500).json({ erro: "Falha interna no servidor" });
  }
});


// =========================================
// ROTA: LER ÚLTIMOS DADOS
// =========================================
app.get("/dados", (req, res) => {
  if (!fs.existsSync(READINGS_FILE)) return res.json({});
  res.sendFile(READINGS_FILE);
});


// =========================================
// ROTA: HISTÓRICO COMPLETO
// =========================================
app.get("/historico", (req, res) => {
  if (!fs.existsSync(HIST_FILE)) return res.json([]);
  res.sendFile(HIST_FILE);
});


// =========================================
// ROTA: CONSUMO DIÁRIO
// =========================================
app.get("/consumo-diario", (req, res) => {
  if (!fs.existsSync(CONSUMO_FILE)) return res.json({});
  res.sendFile(CONSUMO_FILE);
});


// =========================================
// LOGIN SIMPLES
// =========================================
const USERS = {
  admin: "1234",
  hag: "hospital123"
};

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (USERS[usuario] && USERS[usuario] === senha) {
    return res.json({ autorizado: true });
  }

  res.status(401).json({ autorizado: false });
});


// =========================================
// INICIAR SERVIDOR
// =========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor HAG rodando na porta " + PORT);
});
