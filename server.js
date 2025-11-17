import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho seguro dentro do projeto (Render permite)
const dataDir = path.join(__dirname, "storage");
const historicoFile = path.join(dataDir, "historico.json");

// Garante que a pasta existe
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Garante que o arquivo existe
if (!fs.existsSync(historicoFile)) {
    fs.writeFileSync(historicoFile, "[]");
}

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- ROTAS -----------------

// Receber dados do APIDOG / IoT
app.post("/api/update", (req, res) => {
    try {
        const dados = req.body;

        let historico = JSON.parse(fs.readFileSync(historicoFile));

        historico.push({
            timestamp: Date.now(),
            ...dados
        });

        fs.writeFileSync(historicoFile, JSON.stringify(historico, null, 2));

        res.json({ status: "OK", recebido: dados });
    } catch (error) {
        res.status(500).json({ error: "Erro ao salvar dados", detalhes: error.message });
    }
});

// Histórico completo
app.get("/api/historico", (req, res) => {
    try {
        const historico = JSON.parse(fs.readFileSync(historicoFile));
        res.json(historico);
    } catch (error) {
        res.status(500).json({ error: "Erro ao ler histórico" });
    }
});

// Servir arquivos do frontend
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
