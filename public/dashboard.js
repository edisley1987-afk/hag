// === dashboard.js ===
// Exibe leituras em tempo real com barra de nível lateral e cores dinâmicas

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // Atualiza a cada 5s
const DATA_TIMEOUT = 240000; // 240s = 4 minutos

let ultimaLeitura = 0;

// === Configuração dos sensores ===
const SENSORES = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    tipo: "nivel",
    capacidade: 20000,
    leituraVazio: 0.004168,
    leituraCheio: 0.008056,
    cardId: "cardElevador",
    valorId: "nivelElevador",
    litrosId: "litrosElevador"
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    tipo: "nivel",
    capacidade: 200,
    leituraVazio: 0.00505,
    leituraCheio: 0.006693,
    cardId: "cardOsmose",
    valorId: "nivelOsmose",
    litrosId: "litrosOsmose"
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    tipo: "nivel",
    capacidade: 1000,
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    cardId: "cardCME",
    valorId: "nivelCME",
    litrosId: "litrosCME"
  },
  Reservatorio_Agua_Abrandada_current: {
    nome: "Água Abrandada",
    tipo: "nivel",
    capacidade: 9000,
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
    cardId: "cardAbrandada",
    valorId: "nivelAbrandada",
    litrosId: "litrosAbrandada"
  },
  Pressao_Saida_Osmose_current: {
    nome: "Pressão Saída Osmose",
    tipo: "pressao",
    cardId: "cardPressaoSaida",
    valorId: "pressaoSaida"
  },
  Pressao_Retorno_Osmose_current: {
    nome: "Pressão Retorno Osmose",
    tipo: "pressao",
    cardId: "cardPressaoRetorno",
    valorId: "pressaoRetorno"
  },
  Pressao_Saida_CME_current: {
    nome: "Pressão Saída CME",
    tipo: "pressao",
    cardId: "cardPressaoCME",
    valorId: "pressaoCME"
  }
};

// === Função para buscar dados ===
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    atualizarDashboard(dados);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
  }
}

// === Atualiza cards ===
function atualizarDashboard(dados) {
  const agora = Date.now();
  ultimaLeitura = new Date(dados.timestamp).getTime();

  Object.entries(SENSORES).forEach(([chave, cfg]) => {
    const valorBruto = dados[chave];
    const card = document.getElementById(cfg.cardId);
    const valorEl = document.getElementById(cfg.valorId);
    const litrosEl = document.getElementById(cfg.litrosId);

    if (!card) return;

    // Verifica se os dados estão desatualizados
    const tempoSemAtualizar = agora - ultimaLeitura;
    if (tempoSemAtualizar > DATA_TIMEOUT || valorBruto == null) {
      card.classList.add("sem-dados");
      if (valorEl) valorEl.textContent = "Sem leitura";
      if (litrosEl) litrosEl.textContent = "--";
      card.style.setProperty("--nivel", "0%");
      return;
    } else {
      card.classList.remove("sem-dados");
    }

    if (cfg.tipo === "nivel") {
      // Converte leitura analógica para litros e %
      const proporcao = Math.min(
        1,
        Math.max(
          0,
          (valorBruto - cfg.leituraVazio) /
            (cfg.leituraCheio - cfg.leituraVazio)
        )
      );
      const litros = proporcao * cfg.capacidade;
      const porcentagem = proporcao * 100;

      let cor =
        porcentagem < 50 ? "#e74c3c" : porcentagem < 80 ? "#f1c40f" : "#2ecc71";

      card.style.borderColor = cor;
      card.style.setProperty("--nivel", `${porcentagem}%`);
      if (valorEl) valorEl.textContent = `${porcentagem.toFixed(1)}%`;
      if (litrosEl)
        litrosEl.textContent = `${litros.toFixed(0)} L de ${cfg.capacidade.toLocaleString()} L`;
    } else if (cfg.tipo === "pressao") {
      const valor = parseFloat(valorBruto);
      if (valorEl) valorEl.textContent = `${valor.toFixed(2)} bar`;
      card.style.borderColor = valor < 1 ? "#e74c3c" : "#2ecc71";
    }
  });

  // Atualiza hora da leitura
  const last = document.getElementById("lastUpdate");
  if (last)
    last.textContent =
      "Última atualização: " +
      new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

// === Timer automático ===
setInterval(carregarDados, UPDATE_INTERVAL);
carregarDados();

// === Função de histórico ===
function abrirHistorico(reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
}
window.abrirHistorico = abrirHistorico;
