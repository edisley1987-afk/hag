// ======= Servidor Universal HAG (com autenticação do ITG-200) =======
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// ======= Middlewares padrão =======
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ======= Caminhos =======
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ======= Autenticação BASIC (ITG-200) =======
app.use("/atualizar", (req, res, next) => {
  const auth = req.headers["authorization"] || "";
  const validUser = "118582";
  const validPass = "HAG-CHAVE-123";
  const expected = "Basic " + Buffer.from(`${validUser}:${validPass}`).toString("base64");

  if (auth !== expected) {
    console.warn("🚫 Acesso negado: credenciais inválidas");
    return res.status(403).json({ error: "Acesso negado. Credenciais inválidas." });
  }

  next();
});

// ======= Rota para receber dados do Gateway =======
app.post("/atualizar", (req, res) => {
  try {
    const data = req.body;
    let jsonData = {};

    // Suporte a diferentes formatos de corpo
    if (typeof data === "string") {
      try {
        jsonData = JSON.parse(data);
      } catch {
        jsonData = { leitura: data };
      }
    } else {
      jsonData = data;
    }

    if (!jsonData || Object.keys(jsonData).length === 0) {
      return res.status(400).json({ error: "Dados inválidos ou vazios." });
    }

    // Lê dados anteriores
    let existingData = [];
    if (fs.existsSync(DATA_FILE)) {
      existingData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }

    // Adiciona novo registro com data/hora
    const registro = {
      timestamp: new Date().toISOString(),
      dados: jsonData,
    };

    existingData.push(registro);
    fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2));

    console.log("✅ Dados recebidos e salvos:", registro);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao salvar dados:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ======= Rota para o Dashboard / Histórico =======
app.get("/dados", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json([]);
    }
    const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(dados);
  } catch (err) {
    console.error("❌ Erro ao ler dados:", err);
    res.status(500).json({ error: "Erro ao ler dados." });
  }
});

// ======= Servir arquivos estáticos =======
app.use(express.static(path.join(__dirname, "public")));

// ======= Inicialização =======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log("🔒 Autenticação BASIC ativada para /atualizar");
  console.log("👤 Usuário:", "118582");
  console.log("🔑 Senha:", "HAG-CHAVE-123");
});
