// ====== SERVER COMPLETO COM ALERTA DE TRANSBORDAMENTO ======
const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =======================
// CONFIGURAÇÃO DOS RESERVATÓRIOS
// =======================
const RESERVATORIOS = {
    elevador: {
        capacidade: 20000,
        leituraVazio: 0.004168,
        leituraCheio: 0.008400
    },
    osmose: {
        capacidade: 200,
        leituraVazio: 0.005050,
        leituraCheio: 0.006429
    },
    cme: {
        capacidade: 1000,
        leituraVazio: 0.004088,
        leituraCheio: 0.004408
    },
    abrandada: {
        capacidade: 9000,
        leituraVazio: 0.004008,
        leituraCheio: 0.004929
    }
};

// =======================
// FUNÇÃO DE CÁLCULO DO NÍVEL
// =======================
function calcularNivel(reservatorio, leitura) {
    const conf = RESERVATORIOS[reservatorio];
    if (!conf) return { porcentagem: 0, volume: 0 };

    const { leituraVazio, leituraCheio, capacidade } = conf;

    // Porcentagem normalizada
    let perc = (leitura - leituraVazio) / (leituraCheio - leituraVazio);
    perc = Math.min(Math.max(perc, 0), 1);

    return {
        porcentagem: Math.round(perc * 100),
        volume: Math.round(capacidade * perc)
    };
}

// =======================
// ARMAZENAMENTO DAS ÚLTIMAS LEITURAS
// =======================
let ultimaLeitura = {
    elevador: { valor: 0, alertaAlto: false },
    osmose: { valor: 0, alertaAlto: false },
    cme: { valor: 0, alertaAlto: false },
    abrandada: { valor: 0, alertaAlto: false }
};

// =======================
// ROTA PARA RECEBER DADOS DO GATEWAY
// =======================
app.post("/gateway", (req, res) => {
    try {
        const { reservatorio, leitura } = req.body;

        if (!RESERVATORIOS[reservatorio]) {
            return res.status(400).json({ erro: "Reservatório inválido" });
        }

        ultimaLeitura[reservatorio].valor = leitura;

        // ===== ALERTA DE TRANBORDAMENTO =====
        const limite = RESERVATORIOS[reservatorio].leituraCheio;

        if (leitura > limite) {
            ultimaLeitura[reservatorio].alertaAlto = true;
            console.log(`⚠ ALERTA: ${reservatorio} acima do nível máximo! (${leitura})`);
        } else {
            ultimaLeitura[reservatorio].alertaAlto = false;
        }

        res.json({ status: "OK" });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

// =======================
// ROTA PARA O DASHBOARD OBTER OS DADOS
// =======================
app.get("/dados", (req, res) => {
    let dados = {};

    for (let r in RESERVATORIOS) {
        const leitura = ultimaLeitura[r].valor;
        const nivel = calcularNivel(r, leitura);

        dados[r] = {
            leitura,
            porcentagem: nivel.porcentagem,
            volume: nivel.volume,
            alertaAlto: ultimaLeitura[r].alertaAlto
        };
    }

    res.json(dados);
});

// =======================
// SERVIDOR WEB
// =======================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
