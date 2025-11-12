// === dashboard.js ===
// Monitoramento em tempo real com alerta flutuante e manutenção dinâmica

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 30000; // Atualização a cada 30s
let ultimaLeitura = 0;
let alertando = false;
let emManutencao = {}; // { idReservatorio: true }
let audioBip;

// === Configuração dos reservatórios ===
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 },
};

// === Pressões ===
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME",
};

// === Cria os cards na tela ===
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
    card.innerHTML = `
      <h2>${PRESSOES[id]}</h2>
      <p class="pressao">-- bar</p>
    `;
    container.appendChild(card);
  });
}

// === Atualiza os dados ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("Falha ao buscar dados");
    const dados = await res.json();
    if (!dados || Object.keys(dados).length === 0) return;

    ultimaLeitura = Date.now();
    let reservatoriosCriticos = [];

    // --- Reservatórios ---
    Object.entries(RESERVATORIOS).forEach(([id, conf]) => {
      const card = document.getElementById(id);
      const valor = dados[id];
      if (!card || typeof valor !== "number" || isNaN(valor)) return;

      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));
      card.classList.remove("sem-dados");

      let status = "alto";
      let cor = "linear-gradient(to top, #3498db, #2ecc71)";
      if (perc < 30) {
        status = "baixo";
        cor = "linear-gradient(to top, #e74c3c, #ff8c00)";
        if (!emManutencao[id]) reservatoriosCriticos.push({ id, nome: conf.nome, perc });
      } else if (perc < 70) {
        status = "medio";
        cor = "linear-gradient(to top, #f1c40f, #f39c12)";
      }

      // Se estava em manutenção e voltou a nível normal → remove
      if (perc >= 70 && emManutencao[id]) delete emManutencao[id];

      card.dataset.status = status;
      card.querySelector(".nivel").textContent = perc.toFixed(0) + "%";
      card.querySelector(".litros").textContent = valor.toLocaleString() + " L";
      card.style.setProperty("--nivel", perc + "%");
      card.style.setProperty("--corNivel", cor);
    });

    // --- Pressões ---
    Object.entries(PRESSOES).forEach(([id]) => {
      const card = document.getElementById(id);
      const valor = dados[id];
      if (!card || typeof valor !== "number" || isNaN(valor)) return;
      card.classList.remove("sem-dados");
      card.querySelector(".pressao").textContent = valor.toFixed(2) + " bar";
    });

    // --- Última atualização ---
    const last = document.getElementById("lastUpdate");
    if (last) {
      const dt = new Date(dados.timestamp || Date.now());
      last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
    }

    // --- Alerta ---
    if (reservatoriosCriticos.length > 0) exibirAlerta(reservatoriosCriticos);
    else ocultarAlerta();
  } catch (err) {
    console.error("Erro ao atualizar leituras:", err);
  }
}

// === Painel flutuante lateral ===
function exibirAlerta(reservatorios) {
  let painel = document.getElementById("painelAlerta");
  if (!painel) {
    painel = document.createElement("div");
    painel.id = "painelAlerta";
    painel.className = "painel-alerta";
    document.body.appendChild(painel);
  }

  const lista = reservatorios
    .map((r) => {
      const emManut = emManutencao[r.id];
      const botao = emManut
        ? `<button class="remover-btn" onclick="removerManutencao('${r.id}')">Remover da manutenção</button>`
        : `<button onclick="marcarManutencao('${r.id}')">Marcar como em manutenção</button>`;
      return `
        <div class="alert-item">
          ⚠️ <strong>${r.nome}</strong><br>
          Nível atual: <b>${r.perc.toFixed(0)}%</b>
          <div>${botao}</div>
        </div>
      `;
    })
    .join("");

  painel.innerHTML = `
    <h2>🚨 Alerta de Nível Crítico</h2>
    ${lista}
  `;
  painel.style.display = "block";

  if (!alertando) {
    alertando = true;
    tocarBip();
    const bipInterval = setInterval(() => {
      if (!alertando) clearInterval(bipInterval);
      else tocarBip();
    }, 10000);
  }
}

// === Ocultar alerta ===
function ocultarAlerta() {
  alertando = false;
  const painel = document.getElementById("painelAlerta");
  if (painel) painel.style.display = "none";
}

// === Marcar manutenção ===
window.marcarManutencao = function (id) {
  emManutencao[id] = true;
  atualizarPainelAlerta();
};

// === Remover manutenção ===
window.removerManutencao = function (id) {
  delete emManutencao[id];
  atualizarPainelAlerta();
};

// === Atualiza o painel sem recarregar ===
function atualizarPainelAlerta() {
  const painel = document.getElementById("painelAlerta");
  if (painel && painel.style.display === "block") {
    atualizarLeituras(); // recarrega dados e painel
  }
}

// === Som curto de bip ===
function tocarBip() {
  if (!audioBip) {
    audioBip = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  }
  audioBip.currentTime = 0;
  audioBip.play().catch(() => {});
}

// === Verifica inatividade ===
function verificarInatividade() {
  const tempoSemAtualizar = Date.now() - ultimaLeitura;
  if (tempoSemAtualizar > 10 * 60 * 1000) {
    document.querySelectorAll(".card").forEach((card) => {
      card.classList.add("sem-dados");
      if (card.querySelector(".nivel")) card.querySelector(".nivel").textContent = "--%";
      if (card.querySelector(".litros")) card.querySelector(".litros").textContent = "0 L";
      if (card.querySelector(".pressao")) card.querySelector(".pressao").textContent = "-- bar";
      card.style.setProperty("--nivel", "0%");
    });
    const last = document.getElementById("lastUpdate");
    if (last) last.innerHTML = "Sem atualização há mais de 10 minutos!";
  }
}

// === Inicialização ===
window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
  setInterval(verificarInatividade, 30000);
});

window.abrirHistorico = function (id) {
  window.location.href = `historico.html?reservatorio=${id}`;
};
