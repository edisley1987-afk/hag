// === dashboard.js ===
// Exibe leituras em tempo real com nível visual (caixa d'água)

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // atualização a cada 5s
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
  const container = document.querySelector(".cards-container");
  if (!container) {
    console.error("❌ ERRO: .cards-container não encontrado no HTML.");
    return;
  }

  container.innerHTML = "";

  // Reservatórios
  Object.keys(RESERVATORIOS).forEach((id) => {
    const card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;

    card.innerHTML = `
      <h2>${RESERVATORIOS[id].nome}</h2>

      <div class="nivel-visual">
        <div class="nivel-barra"></div>
      </div>

      <p class="nivel">--%</p>
      <p class="litros">0 L</p>

      <button class="historico-btn" onclick="abrirHistorico('${id}')">
        Ver Histórico
      </button>
    `;

    container.appendChild(card);
  });

  // Pressões
  Object.keys(PRESSOES).forEach((id) => {
    const card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;

    card.innerHTML = `
      <h2>${PRESSOES[id]}</h2>
      <p class="pressao">-- bar</p>
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

      if (typeof valor !== "number" || isNaN(valor)) {
        card.classList.add("sem-dados");
        card.querySelector(".nivel").innerHTML = "--%";
        card.querySelector(".litros").innerHTML = "0 L";
        card.querySelector(".nivel-barra").style.height = "0%";
        return;
      }

      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));

      card.classList.remove("sem-dados");

      // Define a cor de acordo com o nível
      let cor = "#3498db"; // azul
      if (perc < 30) cor = "#e74c3c"; // vermelho
      else if (perc < 70) cor = "#f1c40f"; // amarelo

      // Aplica valores
      card.querySelector(".nivel").innerHTML = perc.toFixed(0) + "%";
      card.querySelector(".litros").innerHTML = valor.toLocaleString() + " L";

      const barra = card.querySelector(".nivel-barra");
      barra.style.height = perc + "%";
      barra.style.backgroundColor = cor;
    });

    // Atualiza pressões
    Object.entries(PRESSOES).forEach(([id, nome]) => {
      const card = document.getElementById(id);
      if (!card) return;

      const valor = dados[id];

      if (typeof valor !== "number" || isNaN(valor)) {
        card.classList.add("sem-dados");
        card.querySelector(".pressao").innerHTML = "-- bar";
        return;
      }

      card.classList.remove("sem-dados");
      card.querySelector(".pressao").innerHTML = valor.toFixed(2) + " bar";
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

// Exibe --% se ficar muito tempo sem atualizar
setInterval(() => {
  const tempo = Date.now() - ultimaLeitura;

  if (tempo > 240000) {
    document.querySelectorAll(".card").forEach((card) => {
      card.classList.add("sem-dados");

      if (card.querySelector(".nivel")) card.querySelector(".nivel").innerHTML = "--%";
      if (card.querySelector(".litros")) card.querySelector(".litros").innerHTML = "0 L";
      if (card.querySelector(".pressao")) card.querySelector(".pressao").innerHTML = "-- bar";

      const barra = card.querySelector(".nivel-barra");
      if (barra) barra.style.height = "0%";
    });
  }
}, 10000);

// Inicializa dashboard
window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

// Função global para abrir histórico
window.abrirHistorico = function (reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
