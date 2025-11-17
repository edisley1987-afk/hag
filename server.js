// ============================
// 🔵 SERVIDOR UNIVERSAL HAG — VERSÃO FINAL
// Aceita qualquer porta, qualquer content-type,
// compatível com Render, gateway e dashboard.
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

// Aceita QUALQUER tipo de request
app.use(cors());
app.use(express.json({ limit: "20mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

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
// 🔵 ROTA PRINCIPAL /atualizar (GATEWAY)
// Aceita JSON, texto, form-data, urlencoded
// ==============================
app.post("/atualizar", (req, res) => {

    console.log("\n=========================");
    console.log("📩 RECEBIDO /atualizar");
    console.log("=========================");
    console.log("📦 RAW BODY:", req.body);

    let body = req.body;

    // CONVERTER PARA JSON SE VIER COMO STRING
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            console.log("❌ Não é JSON puro, tentando converter formato bruto");
            return res.status(400).json({ erro: "Formato inválido. Envie JSON." });
        }
    }

    // VALIDAR FORMATO DO GATEWAY
    if (!body || !Array.isArray(body.data)) {
        return res.status(400).json({
            erro: "Formato inválido: esperado { seq, data[] }"
        });
    }

    const timestamp = new Date().toISOString();

    // CARREGAR ÚLTIMAS LEITURAS
    let ultima = {};
    try {
        ultima = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch { ultima = {}; }

    // PROCESSAR CADA ITEM DA LISTA
    body.data.forEach(item => {
        if (!item.ref || typeof item.value === "undefined") return;

        ultima[item.ref] = {
            value: item.value,
            time: item.time,
            dev_id: item.dev_id,
            unit: item.unit,
            timestamp
        };
    });

    // SALVAR ARQUIVO /dados
    fs.writeFileSync(DATA_FILE, JSON.stringify(ultima, null, 2));

    console.log(`💾 Leituras recebidas: ${body.data.length}`);

    // ===== SALVAR HISTÓRICO =====
    let historico = [];

    try {
        historico = JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"));
        if (!Array.isArray(historico)) historico = [];
    } catch {
        historico = [];
    }

    historico.push({
        seq: body.seq,
        timestamp,
        data: body.data
    });

    fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));

    return res.json({
        status: "OK",
        recebidos: body.data.length
    });
});


// ==============================
// 🔵 ROTA /dados → Dashboard
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
// 🔵 ROTA /historico
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
// INICIAR SERVIDOR (QUALQUER PORTA)
// 0 = Node escolhe automaticamente
// Render sobrepõe com process.env.PORT
// ==============================
const PORT = process.env.PORT || 0;

app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta: ${PORT}`);
});
