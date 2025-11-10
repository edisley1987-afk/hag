// ====== CONFIGURAÇÃO ======
const API_URL = window.location.origin + "/dados"; // rota do servidor
const UPDATE_INTERVAL = 5000; // atualização a cada 5 segundos

// Configuração dos reservatórios
const SENSOR_CONFIG = {
  Reservatorio_Elevador: {
    nome: "Reservatório Elevador",
    leituraVazio: 0.004168,
    leituraCheio: 0.008056,
    capacidadeTotal: 20000,
    valorId: "elevadorValor",
    percentId: "elevadorPercent",
    cardId: "cardElevador",
  },
  Reservatorio_Osmose: {
    nome: "Reservatório Osmose",
    leituraVazio: 0.00505,
    leituraCheio: 0.006533,
    capacidadeTotal: 200,
    valorId: "osmoseValor",
    percentId: "osmosePercent",
    cardId: "cardOsmose",
  },
  Reservatorio_CME: {
    nome: "Reservatório CME",
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    capacidadeTotal: 1000,
    valorId: "cmeValor",
    percentId: "cmePercent",
    cardId: "cardCME",
  },
  Reservatorio_Abrandada: {
    nome: "Água Abrandada",
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
    capacidadeTotal: 9000,
    valorId: "abrandadaValor",
    percentId: "abrandadaPercent",
    cardId: "cardAbrandada",
  },
};

// ====== FUNÇÃO PRINCIPAL ======
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Falha ao buscar dados");
    const dados = await res.json();

    atualizarDashboard(dados);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
  }
}

// ====== ATUALIZAÇÃO DO DASHBOARD ======
function atualizarDashboard(dados) {
  Object.entries(SENSOR_CONFIG).forEach(([chave, cfg]) => {
    const leitura = dados[`${chave}_current`];
    if (leitura == null) return;

    const proporcao =
      (leitura - cfg.leituraVazio) /
      (cfg.leituraCheio - cfg.leituraVazio);

    const porcentagem = Math.min(Math.max(proporcao * 100, 0), 100);
    const volume = (porcentagem / 100) * cfg.capacidadeTotal;

    const valorEl = document.getElementById(cfg.valorId);
    const percentEl = document.getElementById(cfg.percentId);
    const cardEl = document.getElementById(cfg.cardId);

    if (!valorEl || !percentEl || !cardEl) {
      console.warn("Elemento ausente no DOM:", cfg.cardId);
      return;
    }

    valorEl.textContent = `${volume.toFixed(0)} L`;
    percentEl.textContent = `${porcentagem.toFixed(1)}%`;
    cardEl.style.setProperty("--progress", `${porcentagem}%`);
  });

  const agora = new Date();
  document.getElementById("lastUpdate").textContent =
    "Última atualização: " +
    agora.toLocaleTimeString("pt-BR", { hour12: false });
}

// ====== FUNÇÃO PARA VER HISTÓRICO ======
function abrirHistorico(nomeReservatorio) {
  window.location.href = `historico.html?reservatorio=${nomeReservatorio}`;
}

// ====== RELÓGIO ======
function atualizarRelogio() {
  const agora = new Date();
  const clock = document.getElementById("clock");
  if (clock) clock.textContent = agora.toLocaleTimeString("pt-BR", { hour12: false });
}

// ====== INICIALIZAÇÃO ======
setInterval(carregarDados, UPDATE_INTERVAL);
setInterval(atualizarRelogio, 1000);
carregarDados();
atualizarRelogio();
