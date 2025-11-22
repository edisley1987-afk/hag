// === dashboard.js ===
// Exibe leituras em tempo real com nível visual (caixa d'água)

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
let ultimaLeitura = 0;

// Configuração dos reservatórios (em litros)
const RESERVATORIOS = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    capacidade: 20000,
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    capacidade: 200,
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    capacidade: 1000,
  },
  Reservatorio_Agua_Abrandada_current: {
    nome: "Água Abrandada",
    capacidade: 9000,
  },
};

// Pressões
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME",
};

// === Cria os cards dinamicamente ===
function criarCards() {
  const container = document.getElementById("cardsRow");
  if (!container) {
    console.error("ERRO: .cards-container não encontrado no HTML.");
    return;
  }

  container.innerHTML = "";

  // Reservatórios
  Object.keys(RESERVATORIOS).forEach((id) => {
    const card = document.createElement("div");
    card.className = "card";
    card.id = id;

    card.innerHTML = `
      <div class="fill"></div>
      <div class="content">
        <div class="title">${RESERVATORIOS[id].nome}</div>
        <div class="percent-large">--%</div>
        <div class="liters">0 L</div>
        <button class="btn-menu" onclick="abrirHistorico('${id}')">Ver Histórico</button>
      </div>
    `;

    container.appendChild(card);
  });

  // Pressões
  Object.keys(PRESSOES).forEach((id) => {
    const card = document.createElement("div");
    card.className = "card pressao";
    card.id = id;

    card.innerHTML = `
      <div class="content">
        <div class="title">${PRESSOES[id]}</div>
        <div class="percent-large">-- bar</div>
      </div>
    `;

    container.appendChild(card);
  });
}

// === Atualiza as leituras do servidor ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();
    if (!dados || Object.keys(dados).length === 0) return;

    ultimaLeitura = Date.now();

    // Atualiza reservatórios
    Object.entries(RESERVATORIOS).forEach(([id, conf]) => {
      const card = document.getElementById(id);
      if (!card) return;

      const valor = dados[id];
      const percentEl = card.querySelector(".percent-large");
      const litrosEl = card.querySelector(".liters");
      const fill = card.querySelector(".fill");

      if (!fill) return;

      if (typeof valor !== "number" || isNaN(valor)) {
        percentEl.innerHTML = "--%";
        litrosEl.innerHTML = "0 L";
        fill.style.height = "0%";
        card.classList.remove("critico");
        return;
      }

      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));

      percentEl.innerHTML = perc.toFixed(0) + "%";
      litrosEl.innerHTML = valor.toLocaleString() + " L";
      fill.style.height = perc + "%";

      // Cores
      if (perc < 30) {
        fill.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
        card.classList.add("critico");
      } else if (perc < 70) {
        fill.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
        card.classList.remove("critico");
      } else {
        fill.style.background = "linear-gradient(to top, #3498db, #2ecc71)";
        card.classList.remove("critico");
      }
    });

    // Atualiza pressões
    Object.keys(PRESSOES).forEach((id) => {
      const card = document.getElementById(id);
      if (!card) return;
      const el = card.querySelector(".percent-large");

      const valor = dados[id];
      if (typeof valor !== "number") {
        el.innerHTML = "-- bar";
        return;
      }

      el.innerHTML = valor.toFixed(2) + " bar";
    });

    // Atualiza data/hora
    const last = document.getElementById("lastUpdate");
    if (last) {
      const dt = new Date(dados.timestamp || Date.now());
      last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
    }

  } catch (err) {
    console.error("Erro ao buscar leituras:", err);
  }
}

// === Reset se ficar sem atualizar ===
setInterval(() => {
  if (Date.now() - ultimaLeitura > 240000) {
    document.querySelectorAll(".card").forEach((c) => {
      const fill = c.querySelector(".fill");
      const perc = c.querySelector(".percent-large");
      const lit = c.querySelector(".liters");

      if (fill) fill.style.height = "0%";
      if (perc) perc.innerHTML = "--%";
      if (lit) lit.innerHTML = "0 L";
    });
  }
}, 10000);

// Init
window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

// Histórico
window.abrirHistorico = function (reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
