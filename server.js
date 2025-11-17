import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = "/data"; 
const HIST_FILE = path.join(DATA_DIR, "historico.json");

// Garantir pasta /data no Render Free
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Garantir arquivo historico.json
if (!fs.existsSync(HIST_FILE)) {
    fs.writeFileSync(HIST_FILE, JSON.stringify([]));
}

// 🔹 LER histórico
function lerHistorico() {
    try {
        return JSON.parse(fs.readFileSync(HIST_FILE));
    } catch (err) {
        return [];
    }
}

// 🔹 SALVAR histórico
function salvarHistorico(data) {
    fs.writeFileSync(HIST_FILE, JSON.stringify(data, null, 2));
}

// 📌 ROTAS

// ➤ Receber dados do ESP32
app.post("/api/dados", (req, res) => {
    const entrada = {
        timestamp: Date.now(),
        ...req.body
    };

    const hist = lerHistorico();
    hist.push(entrada);
    salvarHistorico(hist);

    res.json({ status: "OK", recebido: entrada });
});

// ➤ Último dado para o dashboard
app.get("/api/ultimo", (req, res) => {
    const hist = lerHistorico();
    if (hist.length === 0) return res.json({});
    res.json(hist[hist.length - 1]);
});

// ➤ Histórico completo
app.get("/api/historico", (req, res) => {
    res.json(lerHistorico());
});

// ➤ Consumo diário (somatório)
app.get("/api/consumo", (req, res) => {
    const hist = lerHistorico();
    let consumoTotal = 0;

    hist.forEach(item => {
        if (item.consumo) consumoTotal += Number(item.consumo);
    });

    res.json({
        total: consumoTotal.toFixed(2),
        registros: hist.length
    });
});

// Servir index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor iniciado na porta " + PORT));
