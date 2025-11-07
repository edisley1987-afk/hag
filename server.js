import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb", strict: false }));
app.use(express.text({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "readings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ✅ Função para salvar as leituras no arquivo
function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
  console.log("💾 Leituras atualizadas:", dados);
}

// ✅ Rota principal de atualização
app.all("/atualizar", (req, res) => {
  try {
    let body = req.body;

    // Aceita JSON como texto puro também
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        console.log("⚠️ Corpo recebido não é JSON válido, ignorando parse...");
      }
    }

    // Extrai dados independente do formato
    let dataArray = [];

    if (Array.isArray(body)) {
      dataArray = body;
    } else if (body && Array.isArray(body.data)) {
      dataArray = body.data;
    } else if (typeof body === "object") {
      // Caso seja objeto direto tipo {Reservatorio_Elevador_current: 0.0076}
      dataArray = Object.keys(body)
        .filter((key) => key.includes("_current"))
        .map((key) => ({ ref: key, value: body[key] }));
    }

    if (!dataArray.length) {
      return res.status(400).json({
        status: "erro",
        detalhe: "Nenhum dado de leitura encontrado no corpo da requisição",
      });
    }

    // Monta o objeto final de leituras
    const leituras = {};
    for (const item of dataArray) {
      if (item.ref && typeof item.value === "number") {
        leituras[item.ref] = item.value;
      }
    }

    const dados = {
      status: "ok",
      dados: {
        Reservatorio_Elevador_current:
          leituras.Reservatorio_Elevador_current ?? 0,
        Reservatorio_CME_current: leituras.Reservatorio_CME_current ?? 0,
        Reservatorio_Osmose_current: leituras.Reservatorio_Osmose_current ?? 0,
        timestamp: new Date().toISOString(),
      },
    };

    salvarDados(dados);
    return res.json(dados);
  } catch (err) {
    console.error("❌ Erro ao atualizar:", err);
    res.status(500).json({ status: "erro", detalhe: err.message });
  }
});

// ✅ Rota para retornar as últimas leituras
app.get("/dados", (req, res) => {
  if (!fs.existsSync(DATA_FILE))
    return res.json({ status: "vazio", dados: {} });
  const dados = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  res.json(dados);
});

// ✅ Página simples para teste
app.get("/", (req, res) => {
  res.send("Servidor HAG Proxy rodando com sucesso ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
);
