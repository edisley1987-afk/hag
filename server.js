// ============================
// 🔵 SERVIDOR UNIVERSAL HAG
// ============================

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// =====================
// CONFIGURAÇÕES
// =====================
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// =====================
// PASTA PUBLIC
// =====================
app.use(express.static(path.join(__dirname, "public")));


// =====================
// ARQUIVOS DE DADOS
// =====================
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DATA_FILE = path.join(DATA_DIR, "readings.json");
const HISTORICO_FILE = path.join(DATA_DIR, "historico.json");

// cria arquivos se não existirem
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
if (!fs.existsSync(HISTORICO_FILE)) fs.writeFileSync(HISTORICO_FILE, "[]");


// ==============================
// 🔵 ROTA PRINCIPAL DE ATUALIZAÇÃO
// ==============================
app.post("/atualizar", (req, res) => {

    // ============================
    // LOG SUPER DETALHADO DO GATEWAY
    // ============================
    console.log("\n\n=========================");
    console.log("📩 RECEBEU /atualizar");
    console.log("=========================");

    console.log("🌐 IP REAL:", req.headers["x-forwarded-for"] || req.socket.remoteAddress);
    console.log("🛰 HOST DE ORIGEM:", req.headers["host"]);
    console.log("🔌 PROTOCOLO:", req.headers["x-forwarded-proto"] || req.protocol);
    console.log("📎 USER-AGENT:", req.headers["user-agent"]);
    console.log("🛠 CONTENT-TYPE:", req.headers["content-type"]);
    console.log("📦 TAMANHO BODY:", req.headers["content-length"]);
    console.log("➡ MÉTODO:", req.method);
    console.log("➡ PATH:", req.originalUrl);
    console.log("📬 HEADERS:", JSON.stringify(req.headers, null, 2));
    console.log("📨 BODY CRU:", req.body);


    // PROCESSAMENTO DO BODY
    let body = req.body;

    if (Buffer.isBuffer(body)) {
        body = body.toString("utf8");
        console.log("📨 BODY CONVERTIDO DE BUFFER:", body);
    }

    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
            console.log("📦 BODY PARSEADO:", body);
        } catch {
            console.log("❌ BODY NÃO É JSON VÁLIDO");
        }
    }

    if (!body || typeof body !== "object") {
        return res.status(400).json({ erro: "JSON inválido ou vazio" });
    }


    // ==============================
    // SALVAR ÚLTIMA LEITURA
    // ==============================
    body.timestamp = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2));

    console.log("💾 ÚLTIMA LEITURA SALVA");


    // ==============================
    // SALVAR NO HISTÓRICO
    // ==============================
    let historico = [];

    try {
        historico = JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"));
        if (!Array.isArray(historico)) historico = [];
    } catch {
        historico = [];
    }

    historico.push(body);

    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));

    console.log("📚 HISTÓRICO ATUALIZADO (total:", historico.length, ")");

    return res.json({ status: "OK", recebido: body });
});


// ==============================
// 🔵 ROTA /dados → Dashboard lê aqui
// ==============================
app.get("/dados", (req, res) => {
    try {
        const dados = JSON.parse(fs.readFileSync(DATA_FILE));
        return res.json(dados);
    } catch {
        return res.json({});
    }
});


// ==============================
// 🔵 ROTA /historico → Histórico completo
// ==============================
app.get("/historico", (req, res) => {
    try {
        const historico = JSON.parse(fs.readFileSync(HISTORICO_FILE));
        return res.json(historico);
    } catch {
        return res.json([]);
    }
});


// ==============================
// INICIAR SERVIDOR
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
