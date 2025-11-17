//-------------------------------------------
//  CONFIGURAÇÕES INICIAIS
//-------------------------------------------
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();
app.use(express.json());
app.use(cors());

//-------------------------------------------
//  BANCO DE DADOS MONGODB ATLAS
//-------------------------------------------
const MONGO_URI =
  "mongodb+srv://edisley1987_db_user:31UwWXzo5ru26zE2@cluster0.tbnesoa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("🔥 Conectado ao MongoDB"))
  .catch((err) => console.error("Erro ao conectar no MongoDB:", err));

//-------------------------------------------
//  ESQUEMA DAS LEITURAS
//-------------------------------------------
const LeituraSchema = new mongoose.Schema({
  reservatorio: String,
  valorBruto: Number,
  nivel_percent: Number,
  volume: Number,
  recebidoEm: Date,
});

const Leitura = mongoose.model("Leitura", LeituraSchema);

//-------------------------------------------
//  CONFIGURAÇÕES DE CADA RESERVATÓRIO
//-------------------------------------------
const RESERVATORIOS = {
  Reservatorio_Elevador: {
    capacidade: 20000,
    leitura_vazio: 0.004168,
    leitura_cheio: 0.008056,
  },
  RESERVATORIO_Osmose: {
    capacidade: 200,
    leitura_vazio: 0.005050,
    leitura_cheio: 0.006693,
  },
  RESERVATORIO_CME: {
    capacidade: 1000,
    leitura_vazio: 0.004088,
    leitura_cheio: 0.004408,
  },
  RESERVATORIO_Abrandada: {
    capacidade: 9000,
    leitura_vazio: 0.004008,
    leitura_cheio: 0.004929,
  },
};

//-------------------------------------------
//  FUNÇÃO PARA CALCULAR NÍVEL E VOLUME
//-------------------------------------------
function calcularNivel(reservatorio, valor) {
  const cfg = RESERVATORIOS[reservatorio];

  if (!cfg) return { porcentagem: 0, volume: 0 };

  const { capacidade, leitura_vazio, leitura_cheio } = cfg;

  const porcentagem =
    ((valor - leitura_vazio) / (leitura_cheio - leitura_vazio)) * 100;

  const percCorrigido = Math.min(100, Math.max(0, porcentagem));
  const volume = (percCorrigido / 100) * capacidade;

  return {
    porcentagem: percCorrigido.toFixed(1),
    volume: Number(volume.toFixed(1)),
  };
}

//-------------------------------------------
//  MIDDLEWARE PARA LOGAR TODAS REQUISIÇÕES
//-------------------------------------------
app.use((req, res, next) => {
  console.log("\n===================================");
  console.log("=== NOVA REQUISIÇÃO DO GATEWAY ===");
  console.log("IP:", req.ip);
  console.log("Método:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("===================================\n");
  next();
});

//-------------------------------------------
//  ROTA PRINCIPAL DE RECEBIMENTO DO GATEWAY
//-------------------------------------------
app.post("/atualizar/api/v1_2/json/itg/data", async (req, res) => {
  try {
    const dados = req.body?.data;

    if (!dados || !Array.isArray(dados)) {
      return res.status(400).json({ erro: "Formato inválido" });
    }

    for (const item of dados) {
      const { ref, value } = item;

      if (!ref || typeof value !== "number") continue;

      if (!RESERVATORIOS[ref]) continue;

      const { porcentagem, volume } = calcularNivel(ref, value);

      const nova = new Leitura({
        reservatorio: ref,
        valorBruto: value,
        nivel_percent: porcentagem,
        volume: volume,
        recebidoEm: new Date(),
      });

      await nova.save();

      console.log(
        `💧 Salvo: ${ref} | valor=${value} | ${porcentagem}% | ${volume} L`
      );
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ erro: "Erro interno" });
  }
});

//-------------------------------------------
//  ROTA DO DASHBOARD (VALORES ATUAIS)
//-------------------------------------------
app.get("/dashboard", async (req, res) => {
  const resposta = {};

  for (const nome in RESERVATORIOS) {
    const ultima = await Leitura.findOne({ reservatorio: nome })
      .sort({ _id: -1 })
      .lean();

    resposta[nome] = ultima
      ? {
          nivel_percent: ultima.nivel_percent,
          volume: ultima.volume,
          recebidoEm: ultima.recebidoEm,
        }
      : {
          nivel_percent: null,
          volume: null,
          recebidoEm: null,
        };
  }

  res.json(resposta);
});

//-------------------------------------------
//  ROTA DE HISTÓRICO
//-------------------------------------------
app.get("/historico/:reservatorio", async (req, res) => {
  const { reservatorio } = req.params;

  const itens = await Leitura.find({ reservatorio })
    .sort({ recebidoEm: -1 })
    .limit(300)
    .lean();

  res.json(itens);
});

//-------------------------------------------
//  INICIAR SERVIDOR
//-------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
);
