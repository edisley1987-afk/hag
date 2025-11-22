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
  const container = document.getElementById("cardsRow");
  if (!container) {
    console.error("ERRO: #cardsRow não encontrado no HTML.");
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
      <p class="nivel">--%</p>
      <p class="litros">0 L</p>
      <button class="historico-btn" onclick="abrirHistorico('${id}')">Ver Histórico</button>
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
    let reservatoriosCriticos = [];

    // Atualiza reservatórios
    Object.entries(RESERVATORIOS).forEach(([id, conf]) => {
      const card = document.getElementById(id);
      if (!card) return;

      const valor = dados[id];
      if (typeof valor !== "number" || isNaN(valor)) {
        card.classList.add("sem-dados");
        card.querySelector(".nivel").innerHTML = "--%";
        card.querySelector(".litros").innerHTML = "0 L";
        return;
      }

      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));
      card.classList.remove("sem-dados");

      // Define cores e níveis
      let status = "alto";
      let cor = "linear-gradient(to top, #3498db, #2ecc71)";
      if (perc < 30) {
        status = "baixo";
        cor = "linear-gradient(to top, #e74c3c, #ff8c00)";
        reservatoriosCriticos.push(conf.nome);
      } else if (perc < 70) {
        status = "medio";
        cor = "linear-gradient(to top, #f1c40f, #f39c12)";
      }

      card.dataset.status = status;
      card.querySelector(".nivel").innerHTML = perc.toFixed(0) + "%";
      card.querySelector(".litros").innerHTML = valor.toLocaleString() + " L";
    });

    // Atualiza pressões
    Object.entries(PRESSOES).forEach(([id]) => {
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

    // Atualiza data
    const last = document.getElementById("lastUpdate");
    if (last) {
      const dt = new Date(dados.timestamp || Date.now());
      last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
    }

    // === Alerta global ===
    const alertBox = document.getElementById("globalAlert");
    const list = document.getElementById("criticalList");

    if (reservatoriosCriticos.length > 0) {
      alertBox.style.display = "block";
      alertBox.classList.add("critico");
      list.innerHTML = reservatoriosCriticos.join(", ");
      document.getElementById("alarmSound").play().catch(() => {});
    } else {
      alertBox.style.display = "none";
      alertBox.classList.remove("critico");
    }

  } catch (err) {
    console.error("Erro ao buscar leituras:", err);
  }
}

// === Exibe 0% apenas se passar muito tempo sem atualização ===
setInterval(() => {
  if (Date.now() - ultimaLeitura > 240000) {
    document.querySelectorAll(".card").forEach((card) => {
      card.classList.add("sem-dados");
      if (card.querySelector(".nivel")) card.querySelector(".nivel").innerHTML = "--%";
      if (card.querySelector(".litros")) card.querySelector(".litros").innerHTML = "0 L";
      if (card.querySelector(".pressao")) card.querySelector(".pressao").innerHTML = "-- bar";
    });
  }
}, 10000);

// === Inicializa dashboard ===
window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

// === Função global para abrir histórico ===
window.abrirHistorico = function (reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
