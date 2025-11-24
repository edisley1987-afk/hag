// === dashboard.js ===
// Exibe leituras em tempo real com nível visual (caixa d'água)

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
let ultimaLeitura = 0;

// Estado de manutenção salvo localmente
let manutencao = JSON.parse(localStorage.getItem("manutencaoReservatorios") || "{}");

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

// === Criar cards ===
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

        <button class="btn-maint"
          style="margin-top:6px; padding:4px; width:100%; font-size:12px"
          onclick="toggleManutencao('${id}')">
          ${manutencao[id] ? "Remover Manutenção" : "Marcar Manutenção"}
        </button>

        <div class="manut-label" style="
            margin-top:6px;
            padding:4px;
            display:${manutencao[id] ? "block" : "none"};
            background:rgba(142, 68, 173, 0.2);
            color:#8e44ad;
            font-weight:bold;
            font-size:13px;
            border-radius:6px;
            text-align:center;">
            🔧 Em manutenção
        </div>

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

// === Atualizar leituras ===
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
      const manutLabel = card.querySelector(".manut-label");

      if (!fill) return;

      // Se estiver em manutenção → não mostrar alertas
      if (manutencao[id]) {
        percentEl.innerHTML = "--%";
        litrosEl.innerHTML = "Em manutenção";
        fill.style.height = "0%";
        return;
      }

      if (typeof valor !== "number" || isNaN(valor)) {
        percentEl.innerHTML = "--%";
        litrosEl.innerHTML = "0 L";
        fill.style.height = "0%";
        return;
      }

      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));

      percentEl.innerHTML = perc.toFixed(0) + "%";
      litrosEl.innerHTML = valor.toLocaleString() + " L";
      fill.style.height = perc + "%";

      // Cores
      if (perc < 30) {
        fill.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
      } else if (perc < 70) {
        fill.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
      } else {
        fill.style.background = "linear-gradient(to top, #3498db, #2ecc71)";
      }

      // === ALERTA DE NÍVEL BAIXO (<30%) ===
      let alerta = card.querySelector(".alerta-baixo");

      if (!alerta) {
        alerta = document.createElement("div");
        alerta.className = "alerta-baixo";
        alerta.style.marginTop = "6px";
        alerta.style.fontSize = "13px";
        alerta.style.fontWeight = "bold";
        alerta.style.color = "#c0392b";
        alerta.style.display = "none";
        alerta.style.textAlign = "center";
        alerta.style.background = "rgba(192, 57, 43, 0.2)";
        alerta.style.padding = "4px 6px";
        alerta.style.borderRadius = "6px";
        card.querySelector(".content").appendChild(alerta);
      }

      // Mostrar aviso somente se NÃO estiver em manutenção
      if (perc < 30) {
        alerta.innerHTML = "⚠ Nível muito baixo! (<30%)";
        alerta.style.display = "block";
      } else {
        alerta.style.display = "none";
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

// === Inatividade (>10 min) ===
setInterval(() => {
  const agora = Date.now();
  const diff = agora - ultimaLeitura;

  document.querySelectorAll(".card").forEach(card => {
    const id = card.id;

    // não mostrar alerta se estiver em manutenção
    if (manutencao[id]) return;

    let aviso = card.querySelector(".alerta-inatividade");

    if (!aviso) {
      aviso = document.createElement("div");
      aviso.className = "alerta-inatividade";
      aviso.style.marginTop = "8px";
      aviso.style.fontSize = "13px";
      aviso.style.fontWeight = "bold";
      aviso.style.color = "#e67e22";
      aviso.style.display = "none";
      aviso.style.textAlign = "center";
      aviso.style.background = "rgba(230, 126, 34, 0.15)";
      aviso.style.padding = "4px 6px";
      aviso.style.borderRadius = "6px";
      aviso.innerHTML = "⚠ Sem atualização há mais de 10 minutos";

      card.querySelector(".content").appendChild(aviso);
    }

    aviso.style.display = diff > 10 * 60 * 1000 ? "block" : "none";
  });

}, 10000);

// === Alternar Manutenção ===
function toggleManutencao(id) {
  manutencao[id] = !manutencao[id];

  localStorage.setItem("manutencaoReservatorios", JSON.stringify(manutencao));

  criarCards(); // redesenha com o estado atualizado
  atualizarLeituras();
}

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
