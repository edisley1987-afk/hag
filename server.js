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
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/dados", (req, res) => {
  try {
    const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(dados);
  } catch (e) {
    res.status(500).json({ error: "Erro ao ler dados" });
  }
});

app.post("/atualizar", (req, res) => {
  try {
    const body = req.body;
    if (Array.isArray(body)) {
      let dados = {};
      body.forEach(item => {
        if (item.ref && item.value !== undefined) {
          dados[item.ref] = {
            nome: item.ref.replace(/_/g, " "),
            valor: item.value * 10000 // conversão simples
          };
        }
      });
      fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
      res.json({ success: true, saved: Object.keys(dados).length });
    } else {
      res.status(400).json({ error: "Formato inválido" });
    }
  } catch (e) {
    res.status(500).json({ error: "Erro ao salvar dados", details: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor HAG rodando na porta ${PORT}`));
