import express from "express";
import cors from "cors";
import path from "path";
import mongoose from "mongoose";

const app = express();
app.use(cors());
app.use(express.json());

// ====== Caminho absoluto para a pasta public ======
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "public")));

// ====== Conexão MongoDB ======
mongoose
  .connect("mongodb+srv://edisley1987_db_user:31UwWXzo5ru26zE2@cluster0.tbnesoa.mongodb.net/hag", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB conectado"))
  .catch((err) => console.error("Erro ao conectar Mongo:", err));

// ====== Modelo de Dados ======
const dadoSchema = new mongoose.Schema({
  dev_id: String,
  ref: String,
  value: Number,
  time: Number,
  unit: Number
});

const Dado = mongoose.model("Dado", dadoSchema);

// ====== Rotas API ======

// Receber dados do IoT
app.post("/api/update", async (req, res) => {
  try {
    const dados = req.body;

    await Dado.create(dados);

    res.json({ status: "OK", recebido: true });
  } catch (error) {
    console.error("Erro ao salvar:", error);
    res.status(500).json({ error: "Erro ao salvar dados" });
  }
});

// API para dashboard (últimos valores)
app.get("/api/last", async (req, res) => {
  try {
    const ultimos = await Dado.aggregate([
      { $sort: { time: -1 } },
      {
        $group: {
          _id: "$ref",
          ref: { $first: "$ref" },
          value: { $first: "$value" },
          time: { $first: "$time" },
          unit: { $first: "$unit" },
        }
      }
    ]);

    res.json(ultimos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar últimos dados" });
  }
});

// Histórico
app.get("/api/historico/:ref", async (req, res) => {
  try {
    const lista = await Dado.find({ ref: req.params.ref })
      .sort({ time: -1 })
      .limit(2000);

    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// ====== Rotas de páginas ======

// Página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Histórico
app.get("/historico", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "historico.html"));
});

// Consumo diário
app.get("/consumo", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "consumo.html"));
});

// Login
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ====== Start ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
