// ======== SERVIDOR UNIVERSAL HAG - COMPLETO E CORRIGIDO ========

import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Corrigir __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// =========================
// 🔥 VARIÁVEIS DO DASHBOARD
// =========================
let dashboard = {
    lastUpdate: null,
    reservatorios: [
        { name: "Reservatório Elevador", setor: "elevador", percent: 0, current_liters: 0, capacidade: 20000 },
        { name: "Reservatório Osmose", setor: "osmose", percent: 0, current_liters: 0, capacidade: 200 },
        { name: "Reservatório CME", setor: "cme", percent: 0, current_liters: 0, capacidade: 1000 },
        { name: "Água Abrandada", setor: "abrandada", percent: 0, current_liters: 0, capacidade: 9000 },
        { name: "Lavanderia", setor: "lavanderia", percent: 0, current_liters: 0, capacidade: 10000 }
    ],
    pressoes: [
        { nome: "Pressão Saída Osmose", setor: "saida_osmose", pressao: 0 },
        { nome: "Pressão Retorno Osmose", setor: "retorno_osmose", pressao: 0 },
        { nome: "Pressão Saída CME", setor: "saida_cme", pressao: 0 }
    ],
    bombas: [
        { nome: "Bomba 01", estado_num: 0, estado: "desligada", ciclo: 0 },
        { nome: "Bomba 02", estado_num: 0, estado: "desligada", ciclo: 0 }
    ]
};

// ================================
// 🔥 MAPA CORRIGIDO DOS SENSORES
// ================================
const sensorMap = {
    // Reservatórios
    "Reservatorio_Elevador_current": "Reservatório Elevador",
    "Reservatorio_Osmose_current": "Reservatório Osmose",
    "Reservatorio_CME_current": "Reservatório CME",
    "Reservatorio_Agua_Abrandada_current": "Água Abrandada",
    "Reservatorio_lavanderia_current": "Lavanderia",

    // Pressões
    "Pressao_Saida_Osmose_current": "Pressão Saída Osmose",
    "Pressao_Retorno_Osmose_current": "Pressão Retorno Osmose",
    "Pressao_Saida_CME_current": "Pressão Saída CME",

    // Bombas
    "Bomba_01_binary": "Bomba 01",
    "Bomba_02_binary": "Bomba 02",

    // Ciclos
    "Ciclos_Bomba_01_counter": "Ciclos_Bomba_01",
    "Ciclos_Bomba_02_counter": "Ciclos_Bomba_02"
};

// ===========================
// 🔥 RECEBE DADOS DO GATEWAY
// ===========================
app.post("/atualizar/api/v1_2/json/itg/data", (req, res) => {
    const data = req.body;

    dashboard.lastUpdate = new Date().toISOString();

    Object.keys(data).forEach(sensorName => {
        const mapped = sensorMap[sensorName];
        const value = data[sensorName];

        if (!mapped) return; // Ignora sensores não mapeados

        // ---------- Reservatórios ----------
        let reserv = dashboard.reservatorios.find(r => r.name === mapped);
        if (reserv) {
            reserv.current_liters = Math.round(value);
            reserv.percent = Math.round((reserv.current_liters / reserv.capacidade) * 100);
        }

        // ---------- Pressões ----------
        let press = dashboard.pressoes.find(p => p.nome === mapped);
        if (press) press.pressao = Number(value.toFixed(2));

        // ---------- Bombas ----------
        let bomba = dashboard.bombas.find(p => p.nome === mapped);
        if (bomba) {
            bomba.estado_num = Number(value);
            bomba.estado = value === 1 ? "ligada" : "desligada";
        }

        // ---------- Ciclos ----------
        if (mapped === "Ciclos_Bomba_01") {
            dashboard.bombas[0].ciclo = value;
        }
        if (mapped === "Ciclos_Bomba_02") {
            dashboard.bombas[1].ciclo = value;
        }
    });

    res.json({ status: "OK", recebido: data });
});

// ==========================
// 🔥 RETORNAR DASHBOARD JSON
// ==========================
app.get("/api/dashboard", (req, res) => {
    res.json(dashboard);
});

// =========================
// 🔥 SERVIR SITE ESTÁTICO
// =========================
app.use(express.static(path.join(__dirname, "public")));

// =========================
// 🔥 INICIAR SERVIDOR
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
