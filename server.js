import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const PUBLIC_DIR = path.join(__dirname, "public"); // pasta do dashboard

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);

// Servir os arquivos estáticos (HTML, CSS, JS, imagens)
app.use(express.static(PUBLIC_DIR));

// Endpoint para receber dados do gateway
app.post("/dados", (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar dados:", err);
    res.status(500).json({ error: "Falha ao salvar" });
  }
});

// Endpoint para ler os dados mais recentes
app.get("/dados", (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      res.json(data);
    } else {
      res.json({});
    }
  } catch (err) {
    console.error("Erro ao ler dados:", err);
    res.status(500).json({ error: "Falha ao ler" });
  }
});

// Página inicial (dashboard)
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Porta (Render define automaticamente)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
