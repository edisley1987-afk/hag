// ======= SERVIDOR UNIVERSAL HAG (ACEITA QUALQUER CONTEÚDO) ======= //
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

app.use(cors());

// aceita QUALQUER tipo de dado vindo do gateway
app.use(express.text({ limit: "10mb", type: "*/*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ========== ARQUIVOS DE DADOS ========== //
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HIST_FILE = path.join(DATA_DIR, "historico.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
if (!fs.existsSync(HIST_FILE)) fs.writeFileSync(HIST_FILE, "[]");

// ========== AUTENTICAÇÃO BÁSICA ========== //
const USER = "118582";
const PASS = "SUA_SENHA_AQUI";

function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.split(" ")[1] || "";
    const [user, pass] = Buffer.from(token, "base64").toString().split(":");

    if (user === USER && pass === PASS) return next();

    return res.status(401).json({ erro: "Acesso não autorizado" });
}

// ========== ROTA DE ATUALIZAÇÃO DO GATEWAY ========== //
app.post("/atualizar", authMiddleware, (req, res) => {
    let body = req.body;

    // se vier texto simples → tentar converter para JSON
    try {
        if (typeof body === "string") body = JSON.parse(body);
    } catch (e) {
        console.log("⚠ Body não era JSON. Body recebido:", req.body);
        return res.status(400).json({ erro: "Body inválido (não é JSON)" });
    }

    body.timestamp = new Date().toISOString();

    fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2));

    const historico = JSON.parse(fs.readFileSync(HIST_FILE));
    historico.push(body);
    fs.writeFileSync(HIST_FILE, JSON.stringify(historico, null, 2));

    console.log("📩 Dados recebidos:", body);

    return res.json({ status: "OK", recebido: body });
});

// ========== ROTAS DO DASHBOARD ========== //
app.get("/dados", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(DATA_FILE)));
});

app.get("/historico", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(HIST_FILE)));
});

// ========== PASTA PUBLIC ========== //
app.use(express.static(path.join(__dirname, "public")));

// ========== START ========== //
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
