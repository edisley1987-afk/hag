// ======= Servidor Universal HAG (com bloqueio de IP do Gateway) =======

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ====== PASTAS PÚBLICAS ======
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HISTORICO_FILE = path.join(DATA_DIR, "historico.json");

// Cria a pasta data se não existir
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ======= Proteção: apenas o Gateway pode enviar dados =======
const IP_GATEWAY = "192.168.1.71";

app.use("/dados", (req, res, next) => {
  const ip = req.ip.replace("::ffff:", ""); // remove prefixo IPv6

  if (ip !== IP_GATEWAY) {
    console.warn(`Tentativa de acesso não autorizada do IP: ${ip}`);
    return res.status(403).json({ error: "Acesso negado. IP não autorizado." });
  }

  // se o IP for o Gateway, continua
  next();
});

// ======= ROTA DE RECEBIMENTO DE DADOS DO GATEWAY =======
app.post("/dados", (req, res) => {
  try {
    const dados = req.body;

    // Garante que existe o arquivo de histórico
    if (!fs.existsSync(HISTORICO_FILE)) {
      fs.writeFileSync(HISTORICO_FILE, "[]");
    }

    // Salva leitura atual
    fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));

    // Adiciona ao histórico (com data/hora)
    const historico = JSON.parse(fs.readFileSync(HISTORICO_FILE));
    historico.push({
      data: new Date().toLocaleString("pt-BR"),
      ...dados,
    });
    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico.slice(-2000), null, 2));

    res.json({ status: "OK", mensagem: "Dados recebidos com sucesso." });
  } catch (err) {
    console.error("Erro ao processar dados:", err);
    res.status(500).json({ error: "Erro ao salvar dados." });
  }
});

// ======= ROTA DE LEITURA (Dashboard) =======
app.get("/dados", (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const dados = JSON.parse(fs.readFileSync(DATA_FILE));
      res.json(dados);
    } else {
      res.status(404).json({ error: "Sem dados disponíveis." });
    }
  } catch (err) {
    console.error("Erro ao ler dados:", err);
    res.status(500).json({ error: "Erro no servidor." });
  }
});

// ======= ROTA HISTÓRICO =======
app.get("/historico", (req, res) => {
  try {
    if (fs.existsSync(HISTORICO_FILE)) {
      const historico = JSON.parse(fs.readFileSync(HISTORICO_FILE));
      res.json(historico);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
    res.status(500).json({ error: "Erro ao carregar histórico." });
  }
});

// ======= ROTA PARA LIMPAR HISTÓRICO =======
app.delete("/historico", (req, res) => {
  try {
    fs.writeFileSync(HISTORICO_FILE, "[]");
    res.json({ status: "OK", mensagem: "Histórico apagado." });
  } catch (err) {
    console.error("Erro ao limpar histórico:", err);
    res.status(500).json({ error: "Erro ao limpar histórico." });
  }
});

// ======= INICIA O SERVIDOR =======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor HAG rodando na porta ${PORT}`);
  console.log(`🔒 Aceitando dados apenas do Gateway em: ${IP_GATEWAY}`);
});
