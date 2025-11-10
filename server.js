import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

// === Configurações gerais ===
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// === Pastas e arquivos de dados ===
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "historico.json");

// Cria a pasta /data se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
  console.log("📁 Pasta 'data' criada.");
}

// Cria o arquivo de histórico se não existir
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]");
  console.log("🆕 Arquivo 'historico.json' criado.");
}

// === Função auxiliar: grava nova leitura e limpa dados antigos ===
function salvarLeitura(novaLeitura) {
  try {
    const agora = new Date();
    const limite = agora.getTime() - 24 * 60 * 60 * 1000; // 24 horas
    let historico = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    // Remove leituras antigas
    historico = historico.filter(item => new Date(item.timestamp).getTime() > limite);

    // Adiciona nova leitura
    historico.push({
      timestamp: agora.toISOString(),
      ...novaLeitura
    });

    // Grava de volta no arquivo
    fs.writeFileSync(DATA_FILE, JSON.stringify(historico, null, 2));
    console.log("💾 Leitura salva com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao salvar leitura:", err);
  }
}

// === Rota: registrar novas leituras ===
app.post("/api/leituras", (req, res) => {
  const leitura = req.body;

  if (!leitura) {
    return res.status(400).json({ erro: "Nenhuma leitura enviada" });
  }

  salvarLeitura(leitura);
  res.json({ status: "Leitura registrada com sucesso" });
});

// === Rota: obter histórico das últimas 24h ===
app.get("/api/historico", (req, res) => {
  try {
    const historico = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    const ultimas24h = historico.filter(
      item => new Date(item.timestamp).getTime() > limite
    );
    res.json(ultimas24h);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao ler histórico" });
  }
});

// === Rota: verificar status do servidor ===
app.get("/api/status", (req, res) => {
  res.json({
    status: "Servidor online",
    hora: new Date().toISOString()
  });
});

// === Inicialização do servidor ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
