import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// 🔧 Ajuste para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Pasta pública (HTML, JS, CSS)
app.use(express.static(path.join(__dirname, "public")));

// Arquivo de histórico
const HIST_FILE = path.join(__dirname, "historico.json");

// Se não existir, cria
if (!fs.existsSync(HIST_FILE)) {
  fs.writeFileSync(HIST_FILE, JSON.stringify([]));
}

// Lista de reservatórios válidos
const RESERVATORIOS = {
  "Reservatorio_Elevador": true,
  "Reservatorio_Osmose": true,
  "Reservatorio_CME": true,
  "Agua_Abrandada": true,
  "Pressao_Saida_Osmose": true,
  "Pressao_Retorno_Osmose": true,
  "Pressao_Saida_CME": true
};

// Variável para armazenar último valor de cada reservatório
let dadosAtuais = {};

// 📌 ROTA: Receber dados do Arduino (POST)
app.post("/update", (req, res) => {
  const { name, litros, porcentagem, pressao } = req.body;

  if (!RESERVATORIOS[name]) {
    return res.status(400).json({ error: "Reservatório inválido" });
  }

  // Aceitar os dois formatos enviados pelo Arduino
  let litrosFinal = litros ?? null;
  let porcentagemFinal = porcentagem ?? null;

  // Se vier só porcentagem → converte para litros automaticamente
  if (porcentagem != null && litros == null) {
    // Cada reservatório tem capacidade diferente → configure aqui:
    const capacidade = {
      "Reservatorio_Elevador": 20000,
      "Reservatorio_Osmose": 200,
      "Reservatorio_CME": 1000,
      "Agua_Abrandada": 1000
    };

    if (capacidade[name]) {
      litrosFinal = Math.round((porcentagem / 100) * capacidade[name]);
    }
  }

  // Se vier só litros → converte para porcentagem automaticamente
  if (litros != null && porcentagem == null) {
    const capacidade = {
      "Reservatorio_Elevador": 20000,
      "Reservatorio_Osmose": 200,
      "Reservatorio_CME": 1000,
      "Agua_Abrandada": 1000
    };

    if (capacidade[name]) {
      porcentagemFinal = Math.round((litros / capacidade[name]) * 100);
    }
  }

  // Salva valores atuais
  dadosAtuais[name] = {
    litros: litrosFinal,
    porcentagem: porcentagemFinal,
    pressao: pressao ?? null,
    timestamp: new Date().toISOString()
  };

  // --- SALVAR NO HISTÓRICO (JSON) ---
  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf8"));

  historico.push({
    name,
    litros: litrosFinal,
    porcentagem: porcentagemFinal,
    pressao: pressao ?? null,
    timestamp: new Date().toISOString()
  });

  fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));

  res.json({ status: "OK", recebido: dadosAtuais[name] });
});

// 📌 ROTA: enviar dados atuais para o dashboard
app.get("/dados", (req, res) => {
  res.json(dadosAtuais);
});

// 📌 ROTA: histórico individual
app.get("/historico/:reservatorio", (req, res) => {
  const r = req.params.reservatorio;

  if (!RESERVATORIOS[r]) {
    return res.status(400).json({ error: "Reservatório inválido" });
  }

  const historico = JSON.parse(fs.readFileSync(HIST_FILE, "utf8"));

  // Filtra somente aquele reservatório
  const filtrado = historico.filter((h) => h.name === r);

  res.json(filtrado);
});

// Render.com usa porta do ambiente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
