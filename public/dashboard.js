// === Dashboard HAG ===
// Lê dados do servidor e exibe como caixas d’água e pressões
// Última atualização: 11/11/2025

const API_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 segundos

// Configurações dos reservatórios (capacidade total em litros)
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
    nome: "Reservatório Água Abrandada",
    capacidade: 9000,
  },
};

// Configurações dos sensores de pressão (em bar)
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME",
};

// === Cria os cards dinamicamente ===
function criarCards() {
  const container = document.getElementById("cards-container");
  container.innerHTML = "";

  // Reservatórios (caixas d’água)
  Object.entries(RESERVATORIOS).forEach(([key, conf]) => {
    const card = document.createElement("div");
    card.className = "card reservatorio";
    card.innerHTML = `
      <h3>${conf.nome}</h3>
      <div class="water-tank">
        <div class="water-fill" id="fill-${key}"></div>
        <div class="water-text" id="text-${key}">-- L</div>
      </div>
    `;
    container.appendChild(card);
  });

  // Pressões
  Object.entries(PRESSOES).forEach(([key, nome]) => {
    const card = document.createElement("div");
    card.className = "card pressao";
    card.innerHTML = `
      <h3>${nome}</h3>
      <div class="pressao-valor" id="pressao-${key}">-- bar</div>
    `;
    container.appendChild(card);
  });
}

// === Atualiza as leituras em tempo real ===
async function atualizarLeituras() {
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch(`${API_URL}/dados?t=${Date.now()}`, {
      headers: { Authorization: token },
    });

    if (res.status === 401) {
      alert("Sessão expirada. Faça login novamente.");
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    const dados = await res.json();

    // Atualiza reservatórios
    Object.entries(RESERVATORIOS).forEach(([key, conf]) => {
      const valor = dados[key];
      const capacidade = conf.capacidade;
      const percent = Math.min(100, Math.max(0, (valor / capacidade) * 100));

      const fill = document.getElementById(`fill-${key}`);
      const text = document.getElementById(`text-${key}`);

      if (fill) fill.style.height = `${percent}%`;
      if (text) text.textContent = `${valor?.toLocaleString("pt-BR")} L`;

      // Cor do nível
      if (percent < 20) fill.style.backgroundColor = "#e63946"; // vermelho crítico
      else if (percent < 50) fill.style.backgroundColor = "#f1c40f"; // amarelo
      else fill.style.backgroundColor = "#3498db"; // azul padrão
    });

    // Atualiza pressões
    Object.entries(PRESSOES).forEach(([key]) => {
      const valor = dados[key];
      const el = document.getElementById(`pressao-${key}`);
      if (!el) return;

      el.textContent = `${valor?.toFixed(2)} bar`;

      // Cor se abaixo de 1 bar
      if (valor < 1) el.style.color = "#e63946";
      else el.style.color = "#2ecc71";
    });

    // Última atualização
    const tempo = new Date().toLocaleTimeString("pt-BR");
    document.getElementById("ultima-atualizacao").textContent = `Atualizado às ${tempo}`;
  } catch (err) {
    console.error("Erro ao atualizar leituras:", err);
  }
}

// === Logout ===
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

// === Inicialização ===
window.addEventListener("DOMContentLoaded", () => {
  const user = localStorage.getItem("authUser");
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("userName").textContent = user;
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
  document.getElementById("logoutBtn").addEventListener("click", logout);
});
