/**
 * HAG SCADA V6.1 - HARDENED REAL (PRODUÇÃO)
 * Servidor completo com todas as rotas de recepção e API
 */
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Configurações e caminhos
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

// Middleware de Acesso
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 1. ESTATÍSTICOS (Acesso público para o Dashboard funcionar)
app.use(express.static(path.join(__dirname, "public")));

// 2. AUTENTICAÇÃO (Apenas para rotas de API/Dados)
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/atualizar') || req.path.startsWith('/iot')) {
        const auth = req.headers.authorization;
        const expected = 'Basic ' + Buffer.from('118582:118582').toString('base64');
        if (!auth || auth !== expected) {
            return res.status(401).send('Unauthorized');
        }
    }
    next();
});

// Funções de Persistência e Lógica (Mantidas da estrutura original)
function safeReadJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function safeWriteJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Lógica de processamento de sensores (Normalização)
function convertAndMerge(dataArray) {
    const ultimo = safeReadJson(DATA_FILE, {});
    const novo = { ...ultimo };
    const ts = new Date().toISOString();
    
    dataArray.forEach(item => {
        novo[item.ref] = item.value;
        novo[`${item.ref}_timestamp`] = ts;
    });
    
    novo.timestamp = ts;
    safeWriteJson(DATA_FILE, novo);
    return novo;
}

// Websocket Broadcast
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(JSON.stringify(data));
    });
}

// --- ROTAS DE RECEPÇÃO DO GATEWAY ---
// Estas são as rotas que o Gateway HAG chama para enviar dados
app.post(["/atualizar/api/v1_2/json/itg/data", "/atualizar", "/iot"], (req, res) => {
    console.log("📥 Recebendo dados do Gateway...");
    const dados = req.body.data || [];
    const estadoAtual = convertAndMerge(dados);
    
    // Notifica o dashboard em tempo real
    broadcast({ type: "update", dados: estadoAtual });
    
    res.status(200).json({ status: "ok" });
});

// --- ROTAS DE API DO DASHBOARD ---
// Rota utilizada pelo dashboard para carregar o estado inicial
app.get("/api/dados", (req, res) => {
    const dados = safeReadJson(DATA_FILE, {});
    res.json(dados);
});

// Rota de status geral
app.get("/api/dashboard", (req, res) => {
    const dados = safeReadJson(DATA_FILE, {});
    res.json({ lastUpdate: dados.timestamp || "Sem dados" });
});

// Servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor HAG SCADA rodando na porta ${PORT}`);
});
