// === Dashboard com autenticação ===

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
let ultimaLeitura = 0;

// Se não estiver logado, volta pro login
const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

// Reservatórios
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 },
};

// Pressões
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME",
};

// Cria cards
function criarCards() {
  const container = document.querySelector(".cards-container");
  container.innerHTML = "";

  Object.keys(RESERVATORIOS).forEach((id) => {
    const card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;
    card.innerHTML = `
      <h2>${RESERVATORIOS[id].nome}</h2>
      <p class="nivel">--%</p>
      <p class="litros">0 L</p>
      <button class="historico-btn" onclick="abrirHistorico('${id}')">Ver Histórico</button>
    `;
    container.appendChild(card);
  });

  Object.keys(PRESSOES).forEach((id) => {
    const card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;
    card.innerHTML = `<h2>${PRESSOES[id]}</h2><p class="pressao">-- bar</p>`;
    container.appendChild(card);
  });
}

// Atualiza dados
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    const dados = await res.json();
    ultimaLeitura = Date.now();

    Object.entries(RESERVATORIOS).forEach(([id, conf]) => {
      const card = document.getElementById(id);
      const valor = dados[id];
      if (!card || typeof valor !== "number") return;

      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));
      let cor = "linear-gradient(to top, #3498db, #2ecc71)";
      if (perc < 30) cor = "linear-gradient(to top, #e74c3c, #ff8c00)";
      else if (perc < 70) cor = "linear-gradient(to top, #f1c40f, #f39c12)";
      card.querySelector(".nivel").textContent = perc.toFixed(0) + "%";
      card.querySelector(".litros").textContent = valor.toLocaleString() + " L";
      card.style.setProperty("--corNivel", cor);
    });

    Object.entries(PRESSOES).forEach(([id]) => {
      const card = document.getElementById(id);
      const valor = dados[id];
      if (!card || typeof valor !== "number") return;
      card.querySelector(".pressao").textContent = valor.toFixed(2) + " bar";
    });

  } catch (err) {
    console.error("Erro ao buscar leituras:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

window.abrirHistorico = function (id) {
  window.location.href = `historico.html?reservatorio=${id}`;
};
