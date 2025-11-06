
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

// === Corrigir __dirname para ES Modules ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Inicializa servidor ===
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// === Caminhos ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// === Cria pasta data se não existir ===
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}", "utf8");

// === Rota principal ===
app.get("/", (req, res) => {
  res.send("Servidor HAG Proxy rodando com sucesso ✅");
});

// === Rota do painel ===
app.use(express.static(PUBLIC_DIR));

// === Rota para receber dados do gateway ===
app.post("/api/data", (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "JSON inválido" });
    }

    // Exemplo de payload:
    // { "ref": "Reservatorio_Elevador_current", "valor": 12500 }

    const ref = body.ref;
    const valor = body.value ?? body.valor ?? 0;

    if (!ref) return res.status(400).json({ error: "Campo 'ref' obrigatório" });

    let readings = {};
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      readings = JSON.parse(raw || "{}");
    }

    // Atualiza o valor
    readings[ref] = {
      nome: ref.replace(/_/g, " "),
      valor: valor,
      hora: new Date().toISOString(),
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(readings, null, 2), "utf8");

    console.log(`✅ Atualizado: ${ref} = ${valor}`);
    res.json({ success: true, saved: ref });
  } catch (err) {
    console.error("Erro ao salvar dados:", err);
    res.status(500).json({ error: "Falha ao salvar dados" });
  }
});

// === Configuração de HTTPS (Render usa certificados internos, mas mantemos suporte local) ===
const PORT = process.env.PORT || 443;

try {
  const keyPath = path.join(__dirname, "certs", "private.key");
  const certPath = path.join(__dirname, "certs", "certificate.crt");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    https.createServer(options, app).listen(PORT, () => {
      console.log(`🌐 Servidor HTTPS rodando na porta ${PORT}`);
    });
  } else {
    // fallback HTTP se não tiver certificados
    http.createServer(app).listen(PORT, () => {
      console.log(`⚙️ Servidor HTTP rodando na porta ${PORT}`);
    });
  }
} catch (e) {
  console.error("Erro ao iniciar HTTPS:", e);
  http.createServer(app).listen(PORT, () => {
    console.log(`⚙️ Servidor iniciado em modo HTTP (sem certificado)`);
  });
}
