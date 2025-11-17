// =============================
//  SERVER.JS COMPLETO E FUNCIONAL
// =============================

import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

// Configurações
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Arquivo JSON de armazenamento
const DATA_FILE = path.join(process.cwd(), "dados.json");

// Garante que o arquivo JSON exista
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

// =============================
//   FUNÇÃO: SALVAR DADOS
// =============================
function salvarDados(name, litros, pressao) {
    let dados = {};

    try {
        dados = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (err) {
        console.error("Erro lendo JSON:", err);
    }

    dados[name] = {
        litros: litros,
        pressao: pressao,
        atualizado: new Date().toISOString()
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
}

// =============================
//   ROTA GET (para testar no navegador)
// =============================
app.get("/update", (req, res) => {
    const { name, litros, pressao } = req.query;

    if (!name) return res.status(400).send("Erro: name não enviado.");

    salvarDados(name, litros, pressao);
    res.send("OK - Dados atualizados via GET");
});

// =============================
//   ROTA POST (para ESP8266/ESP32)
// =============================
app.post("/update", (req, res) => {
    const { name, litros, pressao } = req.body;

    if (!name) return res.status(400).send("Erro: name não enviado.");

    salvarDados(name, litros, pressao);
    res.json({ status: "OK", message: "Dados atualizados via POST" });
});

// =============================
//   ROTA PARA VISUALIZAR OS DADOS SALVOS
// =============================
app.get("/dados", (req, res) => {
    try {
        const dados = JSON.parse(fs.readFileSync(DATA_FILE));
        res.json(dados);
    } catch (err) {
        res.status(500).json({ erro: "Não foi possível ler o arquivo" });
    }
});

// =============================
//   ROTA PRINCIPAL
// =============================
app.get("/", (req, res) => {
    res.send("Servidor funcionando - HAG Reservatórios");
});

// =============================
//   INICIAR SERVIDOR
// =============================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
