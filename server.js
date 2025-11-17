// ======= SERVIDOR UNIVERSAL HAG (FUNCIONAL, ACEITA /atualizar) ======= //
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

// ==== CONFIGURAÇÕES BÁSICAS ==== //
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ====== PASTAS DE DADOS ====== //
const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}));
if (!fs.existsSync(HIST_FILE)) fs.writeFileSync(HIST_FILE, JSON.stringify([]));

// ====== AUTENTICAÇÃO DO GATEWAY ===== //
const USER = "118582";
const PASS = "SEU_PASSWORD_AQUI";  // <- COLOQUE A SENHA DO GATEWAY

function authMiddleware(req, res, next) {
    const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
    const [user, pass] = Buffer.from(b64auth, "base64").toString().split(":");

    if (user === USER && pass === PASS) return next();

    return res.status(401).json({ erro: "Acesso não autorizado" });
}

// ====== ROTA PARA RECEBER ENVIO DO GATEWAY ====== //
app.post("/atualizar", authMiddleware, (req, res) => {
    try {
        const dados = req.body;

        // Salvar leitura atual
        fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));

        // Adicionar ao histórico
        const historico = JSON.parse(fs.readFileSync(HIST_FILE));
        historico.push({
            timestamp: Date.now(),
            dados
        });
        fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));

        console.log("📥 Recebido do Gateway:", dados);

        return res.json({ status: "OK", recebido: dados });

    } catch (err) {
        return res.status(500).json({ erro: err.message });
    }
});

// ====== Rotas do Dashboard ======= //
app.get("/dados", (req, res) => {
    const dados = JSON.parse(fs.readFileSync(DATA_FILE));
    res.json(dados);
});

app.get("/historico", (req, res) => {
    const historico = JSON.parse(fs.readFileSync(HIST_FILE));
    res.json(historico);
});

// ====== SERVIR A PASTA PUBLIC ====== //
app.use(express.static(path.join(__dirname, "public")));

// ====== RENDER PORT ====== //
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log("🚀 Servidor ativo na porta:", PORT);
    console.log("📁 DATA_FILE:", DATA_FILE);
    console.log("📁 HIST_FILE:", HIST_FILE);
});
