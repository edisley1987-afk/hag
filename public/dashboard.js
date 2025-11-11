// === Dashboard.js ===
// Exibe leituras de nível e pressão com cores dinâmicas e estilo hospitalar

// URL da API que fornece os dados dos reservatórios e pressões
const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";
const UPDATE_INTERVAL = 5000; // atualização a cada 5s

// Configuração dos sensores
const SENSORES = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    tipo: "nivel",
    capacidade: 20000,
    valorId: "litrosElevador",
    percentId: "nivelElevador",
    cardId: "cardElevador",
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    tipo: "nivel",
    capacidade: 200,
    valorId: "litrosOsmose",
    percentId: "nivelOsmose",
    cardId: "cardOsmose",
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    tipo: "nivel",
    capacidade: 1000,
    valorId: "litrosCME",
    percentId: "nivelCME",
    cardId: "cardCME",
  },
  Agua_Abrandada_current: {
    nome: "Água Abrandada",
    tipo: "nivel",
    capacidade: 9000,
    valorId: "litrosAbrandada",
    percentId: "nivelAbrandada",
    cardId: "cardAbrandada",
  },
  Pressao_Saida_Osmose_current: {
    nome: "Pressão Saída Osmose",
    tipo: "pressao",
    cardId: "cardPressaoSaida",
    valorId: "pressaoSaida",
  },
  Pressao_Retorno_Osmose_current: {
    nome: "Pressão Retorno Osmose",
    tipo: "pressao",
    cardId: "cardPressaoRetorno",
    valorId: "pressaoRetorno",
  },
};

// === Função para abrir histórico ===
function abrirHistorico(sensor) {
  // Redireciona para a página de histórico com o sensor selecionado
  window.location.href = `historico.html?sensor=${encodeURIComponent(sensor)}`;
}

// === Função para buscar dados do servidor ===
async function carregarDados() {
  const last = document.getElementById("lastUpdate");
  if (last) last.textContent = "⏳ Atualizando dados...";

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    const dados = await res.json();

    atualizarDashboard(dados);
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
    if (last)
      last.textContent = "⚠️ Erro ao atualizar dados (" + e.message + ")";
  }
}

// === Atualiza todos os cards com os dados ===
function atualizarDashboard(dados) {
  Object.entries(SENSORES).forEach(([chave, cfg]) => {
    const valor = dados[chave];
    if (valor == null) return; // ignora sensores ausentes

    const cardEl = document.getElementById(cfg.cardId);
    if (!cardEl) return;

    let cor = "#3aa374"; // verde padrão
    let textoPrincipal = "";
    let textoSecundario = "";

    if (cfg.tipo === "nivel") {
      // Nível em litros e %
      const porcentagem = Math.min(100, Math.max(0, (valor / cfg.capacidade) * 100));

      if (porcentagem < 50) cor = "#e64a19"; // vermelho
      else if (porcentagem < 80) cor = "#f4c542"; // amarelo

      textoPrincipal = `${porcentagem.toFixed(1)}%`;
      textoSecundario = `${valor.toFixed(0)} L de ${cfg.capacidade.toLocaleString()} L`;
    } else if (cfg.tipo === "pressao") {
      // Pressão em bar (alerta se < 1 bar)
      textoPrincipal = `${valor.toFixed(2)} bar`;
      cor = valor < 1 ? "#e64a19" : "#3aa374";
    }

    // Atualiza a cor da borda do card
    cardEl.style.border = `3px solid ${cor}`;

    // Atualiza textos
    const valorEl = document.getElementById(cfg.valorId);
    if (valorEl) valorEl.textContent = textoPrincipal;

    const percentEl = document.getElementById(cfg.percentId);
    if (percentEl) percentEl.textContent = textoSecundario;
  });

  // Atualiza hora de atualização
  const last = document.getElementById("lastUpdate");
  if (last)
    last.textContent =
      "Última atualização: " +
      new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

// === Inicia atualização automática ===
setInterval(carregarDados, UPDATE_INTERVAL);
carregarDados();
