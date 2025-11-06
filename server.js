import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 443;

// ===== Configuração =====
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ===== Pasta pública (site) =====
app.use(express.static(path.join(__dirname, "public")));

// ===== Caminho do arquivo de dados =====
const DATA_FILE = path.join(__dirname, "data", "readings.json");

// ===== Recebe dados do gateway =====
app.post("/atualizar", (req, res) => {
  try {
    let body = req.body;

    // Se for array, converte para objeto indexado por ref
    if (Array.isArray(body)) {
      const novo = {};
      body.forEach((item) => {
        if (item.ref && item.value !== undefined) {
          novo[item.ref] = {
            nome: item.ref,
            valor: item.value * 10000, // conversão opcional (ajuste conforme necessidade)
          };
        }
      });
      body = novo;
    }

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ success: false, error: "JSON inválido" });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2));
    console.log("📥 Dados recebidos e salvos:", Object.keys(body).length);
    res.json({ success: true, saved: Object.keys(body).length });
  } catch (err) {
    console.error("❌ Erro ao salvar dados:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== Fornece dados ao dashboard =====
app.get("/dados", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({});
    }
    const dados = JSON.parse(fs.readFileSync(DATA_FILE));
    res.json(dados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Página inicial =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ===== Inicia servidor =====
app.get("/debug", (req, res) => {
  const file = path.join(DATA_DIR, "readings.json");
  if (!fs.existsSync(file)) {
    return res.status(404).send("Arquivo readings.json não encontrado");
  }
  const content = fs.readFileSync(file, "utf8");
  res.type("text/plain").send(content);
});
app.listen(PORT, () => {
  console.log(`✅ Servidor HAG Proxy rodando com sucesso na porta ${PORT}`);
});
