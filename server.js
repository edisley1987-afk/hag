// ======================================================
//  SERVER.JS — VERSÃO CORRIGIDA, OTIMIZADA E COMPLETA
//  COMPATÍVEL COM RENDER, EXPRESS, WEBSOCKET E JSON RAW
// ======================================================

// ---------------------- IMPORTS -----------------------
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import WebSocket, { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------- CONSTANTES --------------------
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());

// ---------------------- ARQUIVOS ----------------------
const ARQUIVO_DADOS = path.join(__dirname, "dados.json");
const ARQUIVO_HISTORICO = path.join(__dirname, "historico.json");

// ---------------------- UTILS -------------------------
function lerJSON(caminho, padrao = {}) {
    try {
        if (!fs.existsSync(caminho)) {
            fs.writeFileSync(caminho, JSON.stringify(padrao, null, 2));
        }
        const raw = fs.readFileSync(caminho);
        return JSON.parse(raw);
    } catch (e) {
        console.error("Erro ao ler JSON:", caminho, e);
        return padrao;
    }
}

function salvarJSON(caminho, dados) {
    try {
        fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
    } catch (e) {
        console.error("Erro ao salvar JSON:", caminho, e);
    }
}

// ---------------------- BANCO EM MEMÓRIA -------------------------
let banco = lerJSON(ARQUIVO_DADOS, {
    reservatorios: {},
    pressoes: {},
    bombas: {},
    lastUpdate: null
});

// ---------------------- MEDIÇÕES CONFIG --------------------------
const CONFIG_RESERVATORIOS = {
    "Reservatorio_Elevador": {
        capacidade: 20000,
        leitura_vazio: 0.004168,
        leitura_cheio: 0.008742
    },
    "Reservatorio_Osmose": {
        capacidade: 200,
        leitura_vazio: 0.00505,
        leitura_cheio: 0.006492
    },
    "Reservatorio_CME": {
        capacidade: 1000,
        leitura_vazio: 0.004088,
        leitura_cheio: 0.004408
    },
    "Reservatorio_Abrandada": {
        capacidade: 9000,
        leitura_vazio: 0.004048,
        leitura_cheio: 0.004229
    },
    "Reservatorio_Lavanderia": {
        capacidade: 1000,
        leitura_vazio: 0.006012,
        leitura_cheio: 0.009458
    }
};

// ---------------------- CÁLCULOS -------------------------
function calcularPercentual(leitura, vazio, cheio) {
    if (typeof leitura !== "number") return 0;
    if (leitura <= vazio) return 0;
    if (leitura >= cheio) return 100;

    return Number((((leitura - vazio) / (cheio - vazio)) * 100).toFixed(2));
}

function calcularLitros(percent, capacidade) {
    return Math.max(0, Math.round((percent / 100) * capacidade));
}

// ---------------------- RESERVATÓRIO → OBJETO NORMALIZADO -------------------------
function montarReservatorio(nome, leitura) {
    const cfg = CONFIG_RESERVATORIOS[nome];
    if (!cfg) return null;

    const percent = calcularPercentual(
        leitura,
        cfg.leitura_vazio,
        cfg.leitura_cheio
    );

    const litros = calcularLitros(percent, cfg.capacidade);

    return {
        setor: nome,
        nome: nome.replace(/_/g, " "),
        leitura,
        percent,
        capacidade: cfg.capacidade,
        current_liters: litros
    };
}
// ======================================================
//  RECEBIMENTO DAS LEITURAS (POST /api/update)
// ======================================================
app.post("/api/update", (req, res) => {
    try {
        const dados = req.body;
        const agora = new Date().toISOString();

        // Atualiza LAST UPDATE
        banco.lastUpdate = agora;

        // ------------ RESERVATÓRIOS ------------
        Object.keys(CONFIG_RESERVATORIOS).forEach(nome => {
            if (dados[nome] !== undefined) {
                const leitura = Number(dados[nome]);

                const r = montarReservatorio(nome, leitura);
                if (!r) return;

                banco.reservatorios[nome] = r;
            }
        });

        // ------------ PRESSÕES ------------
        if (dados.pressoes) {
            banco.pressoes = dados.pressoes;
        }

        // ------------ BOMBAS ------------
        if (dados.bombas) {
            banco.bombas = dados.bombas;
        }

        // Salva em disco
        salvarJSON(ARQUIVO_DADOS, banco);

        // Salva histórico individual
        registrarHistorico(banco);

        // Envia via WebSocket
        broadcastWS({
            type: "update",
            data: banco
        });

        res.json({ status: "ok", atualizado: agora });

    } catch (e) {
        console.error("ERRO POST /api/update", e);
        res.status(500).json({ erro: "Falha ao processar dados" });
    }
});

// ======================================================
//  HISTÓRICO AUTOMÁTICO
// ======================================================
function registrarHistorico(banco) {
    let hist = lerJSON(ARQUIVO_HISTORICO, {});

    Object.values(banco.reservatorios).forEach(r => {
        if (!hist[r.setor]) hist[r.setor] = [];

        hist[r.setor].push({
            data: new Date().toISOString(),
            percent: r.percent,
            litros: r.current_liters
        });

        // limita histórico (últimos 2000)
        if (hist[r.setor].length > 2000) {
            hist[r.setor].splice(0, hist[r.setor].length - 2000);
        }
    });

    salvarJSON(ARQUIVO_HISTORICO, hist);
}

// ======================================================
//  WEBSOCKET
// ======================================================
const wss = new WebSocketServer({ noServer: true });
let clientes = new Set();

function broadcastWS(msg) {
    const raw = JSON.stringify(msg);
    clientes.forEach(ws => {
        try {
            ws.send(raw);
        } catch (e) {
            console.log("WS erro:", e);
        }
    });
}

// Upgrade para WebSocket
const server = app.listen(PORT, () =>
    console.log("Servidor rodando na porta", PORT)
);

server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
        clientes.add(ws);

        ws.on("close", () => clientes.delete(ws));

        // Envia estado inicial ao novo cliente
        ws.send(JSON.stringify({
            type: "init",
            data: banco
        }));
    });
});
// ======================================================
//  API: RETORNA DADOS DO DASHBOARD
// ======================================================
app.get("/api/dashboard", (req, res) => {
    try {
        res.json({
            lastUpdate: banco.lastUpdate,
            reservatorios: Object.values(banco.reservatorios),
            pressoes: banco.pressoes,
            bombas: banco.bombas
        });
    } catch (e) {
        console.error("Erro GET /api/dashboard:", e);
        res.status(500).json({ erro: "Falha ao obter dados" });
    }
});


// ======================================================
//  API: HISTÓRICO POR SETOR
// ======================================================
app.get("/api/historico/:setor", (req, res) => {
    const setor = req.params.setor;

    try {
        let hist = lerJSON(ARQUIVO_HISTORICO, {});
        res.json(hist[setor] || []);
    } catch (e) {
        console.error("Erro GET /api/historico:", e);
        res.status(500).json({ erro: "Falha ao obter histórico" });
    }
});


// ======================================================
//  API: LISTA TODOS SETORES COM HISTÓRICO
// ======================================================
app.get("/api/historico", (req, res) => {
    try {
        let hist = lerJSON(ARQUIVO_HISTORICO, {});
        res.json(Object.keys(hist));
    } catch (e) {
        res.status(500).json({ erro: "Falha ao listar históricos" });
    }
});


// ======================================================
//  API: LIMPAR HISTÓRICO DE UM SETOR
// ======================================================
app.delete("/api/historico/:setor", (req, res) => {
    const setor = req.params.setor;
    try {
        let hist = lerJSON(ARQUIVO_HISTORICO, {});
        hist[setor] = [];
        salvarJSON(ARQUIVO_HISTORICO, hist);

        res.json({ status: "ok", setor });
    } catch (e) {
        res.status(500).json({ erro: "Falha ao limpar histórico" });
    }
});


// ======================================================
//  API: LIMPAR TODO HISTÓRICO
// ======================================================
app.delete("/api/historico", (req, res) => {
    try {
        salvarJSON(ARQUIVO_HISTORICO, {});
        res.json({ status: "ok", msg: "Histórico apagado" });
    } catch (e) {
        res.status(500).json({ erro: "Falha ao limpar histórico geral" });
    }
});
// ======================================================
//  TABELA DE CALIBRAÇÃO DOS RESERVATÓRIOS
// ======================================================
const CALIBRACAO = {
    "Reservatorio_Elevador": {
        capacidade: 20000,
        altura: 1.45,
        vazio: 0.004168,
        cheio: 0.008742
    },
    "RESERVATORIO_Osmose": {
        capacidade: 200,
        altura: 1.00,
        vazio: 0.00505,
        cheio: 0.006492
    },
    "RESERVATORIO_CME": {
        capacidade: 1000,
        altura: 0.45,
        vazio: 0.004088,
        cheio: 0.004408
    },
    "RESERVATORIO_Abrandada": {
        capacidade: 9000,
        altura: 0.60,
        vazio: 0.004048,
        cheio: 0.004229
    },
    "Reservatorio_Lavanderia": {
        capacidade: 1000,
        altura: 1.45,
        vazio: 0.006012,
        cheio: 0.009458,
        cheio_percent: 75 // tanque não enche 100% na prática
    }
};


// ======================================================
//  FUNÇÃO: CALCULAR PERCENTUAL A PARTIR DA LEITURA
// ======================================================
function calcularPercentualReservatorio(nome, leitura) {
    const cfg = CALIBRACAO[nome];
    if (!cfg) return 0;

    // Corrigir leitura inválida
    leitura = Number(leitura);
    if (isNaN(leitura) || leitura <= 0) return 0;

    let percent =
        ((leitura - cfg.vazio) / (cfg.cheio - cfg.vazio)) * 100;

    // Corrigir tanque da lavanderia (cheio real = 75%)
    if (cfg.cheio_percent) {
        percent = percent * (cfg.cheio_percent / 100);
    }

    // Limites
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;

    return Number(percent.toFixed(1));
}


// ======================================================
//  CONVERTER % → LITROS
// ======================================================
function percentParaLitros(nome, percent) {
    const cfg = CALIBRACAO[nome];
    if (!cfg) return 0;

    return Math.round((percent / 100) * cfg.capacidade);
}


// ======================================================
//  CONVERTER LEITURA → LITROS (via %)
// ======================================================
function leituraParaLitros(nome, leitura) {
    const p = calcularPercentualReservatorio(nome, leitura);
    return percentParaLitros(nome, p);
}


// ======================================================
//  REGISTRAR NO HISTÓRICO
// ======================================================
function registrarHistorico(setor, valorPercent, litros) {
    let hist = lerJSON(ARQUIVO_HISTORICO, {});

    if (!hist[setor]) hist[setor] = [];

    hist[setor].push({
        ts: Date.now(),
        percent: valorPercent,
        litros: litros
    });

    // limitar tamanho do histórico
    if (hist[setor].length > 5000) {
        hist[setor].splice(0, hist[setor].length - 5000);
    }

    salvarJSON(ARQUIVO_HISTORICO, hist);
}
// ============================================
//  PARTE 5 — ATUALIZAÇÃO GLOBAL + INICIALIZAÇÃO
// ============================================

// Envia níveis atuais para TODOS os clientes WebSocket conectados
function broadcastLevels() {
    try {
        const payload = JSON.stringify({
            type: "updateLevels",
            ts: Date.now(),
            data: banco.reservatorios
        });

        clientes.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        });
    } catch (e) {
        console.error("Erro ao enviar broadcast WS:", e);
    }
}

// Intervalo opcional para reenviar níveis a cada 30 segundos
setInterval(() => {
    console.log("🔄 Reenvio automático dos níveis...");
    broadcastLevels();
}, 30000);

// Envia níveis imediatamente quando o servidor inicia
console.log("🚀 Servidor iniciado, enviando níveis iniciais...");
broadcastLevels();

// ⚠️ IMPORTANTE:
// O servidor JÁ está sendo iniciado antes com:
// const server = app.listen(PORT, () => console.log(...));
// Portanto NÃO repetir server.listen() aqui.

