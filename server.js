import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();

// Middleware obrigatório para interpretar JSON
app.use(express.json());
app.use(cors());

// 📌 Middleware para LOG COMPLETO → vai mostrar tudo que o Gateway enviar
app.use((req, res, next) => {
  console.log("=== NOVA REQUISIÇÃO DO GATEWAY ===");
  console.log("IP:", req.ip);
  console.log("Método:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("===================================");
  next();
});

// 📌 Caminho da pasta 'public'
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "public")));

// =======================
//  ROTA PARA RECEBER DADOS DO GATEWAY
// =======================
app.post("/api/dados", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "data.json");

    // Garante que existe pasta /data
    if (!fs.existsSync(path.join(__dirname, "data"))) {
      fs.mkdirSync(path.join(__dirname, "data"));
    }

    const novoDado = {
      ...req.body,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(novoDado, null, 2));
    console.log("💾 Dados salvos com sucesso:", novoDado);

    res.json({ status: "ok", recebido: novoDado });
  } catch (error) {
    console.error("❌ Erro ao salvar os dados:", error);
    res.status(500).json({ error: "Erro interno ao salvar os dados" });
  }
});

// =======================
//  ROTA PARA LER DADOS (dashboard.html utiliza)
// =======================
app.get("/api/dados", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "data.json");

    if (!fs.existsSync(filePath)) {
      return res.json({ status: "vazio" });
    }

    const dados = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.json(dados);
  } catch (error) {
    res.status(500).json({ error: "Erro ao ler dados" });
  }
});

// =======================
//   ROTA PADRÃO
// =======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =======================
//   INICIAR SERVIDOR
// =======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
