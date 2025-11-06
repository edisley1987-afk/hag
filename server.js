import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Configurações gerais ===
app.use(cors());
app.use(express.json({ limit: "5mb", strict: false }));
app.use(express.text({ type: "*/*", limit: "5mb" })); // Aceita texto bruto

// === Pastas e arquivos de dados ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// === Configuração dos sensores ===
const SENSORES = {
  "Reservatorio_Elevador_current": { leituraVazio: 0.004168, leituraCheio: 0.007855, capacidade: 20000 },
  "Reservatorio_Osmose_current":   { leituraVazio: 0.00505,  leituraCheio: 0.006533, capacidade: 200 },
  "Reservatorio_CME_current":      { leituraVazio: 0.004088, leituraCheio: 0.004408, capacidade: 1000 },
};

// === Servir arquivos estáticos do dashboard ===
app.use(express.static(path.join(__dirname, "public")));

// === Página principal ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Rota chamada pelo Gateway ITG ===
app.post("/atualizar", (req, res) => {
  try {
    let body = req.body;

    // Se veio como string (texto cru), tenta converter pra JSON
    if (typeof body === "string") {
      try {
        // Remove possível lixo HTML, vírgulas extras, etc.
        const clean = body
          .replace(/^[^{[]+/, "") // remove caracteres antes de { ou [
          .replace(/[\]\}][^{}\[\]]*$/, ""); // remove depois do final de JSON
        body = JSON.parse(clean);
      } catch (e) {
        console.error("❌ Corpo recebido não é JSON válido:", body);
        return res.status(400).send("Formato inválido recebido do Gateway");
      }
    }

    // Aceita tanto array direto quanto { data: [...] }
    const leituras = Array.isArray(body) ? body : body.data;

    if (!Array.isArray(leituras)) {
      console.error("❌ Formato inesperado:", body);
      return res.status(400).json({ erro: "Formato inválido: esperado array ou objeto com campo 'data'" });
    }

    // Processar leituras
    const dadosConvertidos = {};

    for (const item of leituras) {
      const { ref, value } = item;
      const sensor = SENSORES[ref];
      if (!sensor) continue;

      const { leituraVazio, leituraCheio, capacidade } = sensor;
      const nivel = ((value - leituraVazio) / (leituraCheio - leituraVazio)) * capacidade;
      dadosConvertidos[ref] = Math.max(0, Math.min(capacidade, Math.round(nivel)));
    }

    dadosConvertidos.timestamp = new Date().toISOString();

    // Grava no arquivo JSON
    fs.writeFileSync(DATA_FILE, JSON.stringify(dadosConvertidos, null, 2));
    console.log("✅ Dados atualizados com sucesso via Gateway:", dadosConvertidos);

    res.json({ status: "ok", dados: dadosConvertidos });
  } catch (err) {
    console.error("🔥 Erro ao processar atualização:", err);
    res.status(500).json({ erro: "Erro ao processar atualização" });
  }
});

// === Endpoint de leitura (dashboard) ===
app.get("/dados", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return res.json({});
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    res.json(data);
  } catch (err) {
    console.error("Erro ao ler dados:", err);
    res.status(500).json({ erro: "Falha ao ler dados" });
  }
});

// === Inicialização do servidor ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Servidor HAG Proxy rodando com sucesso na porta ${PORT}`);
});
