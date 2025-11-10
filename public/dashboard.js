// === Dashboard.js ===
// Exibe leituras diretamente (em litros) com cores e bordas dinâmicas

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // atualização a cada 5s

// Configuração dos reservatórios (capacidade total em litros)
const RESERVATORIOS = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    capacidade: 20000,
    valorId: "elevadorValor",
    percentId: "elevadorPercent",
    cardId: "cardElevador",
    barraId: "nivelElevador",
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    capacidade: 200,
    valorId: "osmoseValor",
    percentId: "osmosePercent",
    cardId: "cardOsmose",
    barraId: "nivelOsmose",
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    capacidade: 1000,
    valorId: "cmeValor",
    percentId: "cmePercent",
    cardId: "cardCME",
    barraId: "nivelCME",
  },
  Agua_Abrandada_current: {
    nome: "Água Abrandada",
    capacidade: 9000,
    valorId: "abrandadaValor",
    percentId: "abrandadaPercent",
    cardId: "cardAbrandada",
    barraId: "nivelAbrandada",
  },
};

// === Busca dados no servidor ===
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    atualizarDashboard(dados);
  } catch (e) {
    console.error("❌ Erro ao buscar dados:", e);
  }
}

// === Atualiza a interface ===
function atualizarDashboard(dados) {
  Object.entries(RESERVATORIOS).forEach(([chave, cfg]) => {
    const litros = dados[chave];
    if (litros == null) return;

    const porcentagem = Math.min(100, Math.max(0, (litros / cfg.capacidade) * 100));

    const valorEl = document.getElementById(cfg.valorId);
    const percentEl = document.getElementById(cfg.percentId);
    const cardEl = document.getElementById(cfg.cardId);
    const barraEl = document.getElementById(cfg.barraId);

    if (!valorEl || !percentEl || !cardEl) {
      console.warn("⚠️ Elemento ausente:", cfg.cardId);
      return;
    }

    // === Define cor conforme o nível ===
    let cor = "#2196f3"; // azul padrão
    if (porcentagem >= 90) cor = "#4caf50";      // verde
    else if (porcentagem >= 60) cor = "#ffeb3b"; // amarelo
    else if (porcentagem >= 30) cor = "#ff9800"; // laranja
    else cor = "#f44336";                        // vermelho crítico

    // === Atualiza valores visuais ===
    valorEl.textContent = `${litros.toFixed(0)} L`;
    percentEl.textContent = `${porcentagem.toFixed(1)}%`;

    // === Atualiza a barrinha interna ===
    if (barraEl) {
      barraEl.style.width = `${porcentagem}%`;
      barraEl.style.backgroundColor = cor;
    }

    // === Borda e brilho do card ===
    cardEl.style.border = `4px solid ${cor}`;
    cardEl.style.boxShadow = `0 0 12px ${cor}77`;

    // === Efeito de pulsação se nível for crítico ===
    if (porcentagem < 30) {
      cardEl.classList.add("alerta-pulso");
    } else {
      cardEl.classList.remove("alerta-pulso");
    }
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " +
    new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

// === Abre histórico ===
function abrirHistorico(nomeReservatorio) {
  window.location.href = `historico.html?reservatorio=${nomeReservatorio}`;
}

// === Relógio no rodapé ===
function atualizarRelogio() {
  const agora = new Date();
  const clock = document.getElementById("clock");
  if (clock) clock.textContent = agora.toLocaleTimeString("pt-BR", { hour12: false });
}

// === Inicialização ===
setInterval(carregarDados, UPDATE_INTERVAL);
setInterval(atualizarRelogio, 1000);
carregarDados();
atualizarRelogio();
