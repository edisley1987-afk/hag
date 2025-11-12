// === dashboard.js ===
// Mantém última leitura válida, alerta crítico e mostra "em manutenção" no card

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 30000; // 30s
let ultimaLeitura = 0;
let alertando = false;
let emManutencao = {};
let audioBip;
let dadosAntigos = {};

// === Configurações ===
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 }
};

const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

// === Criação dos cards ===
function criarCards() {
  const container = document.querySelector(".cards-container");
  if (!container) return;
  container.innerHTML = "";

  Object.keys(RESERVATORIOS).forEach(id => {
    const card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;
    card.innerHTML = `
      <h2>${RESERVATORIOS[id].nome}</h2>
      <p class="nivel">--%</p>
      <p class="litros">0 L</p>
      <p class="status-manutencao" style="display:none; color:#f1c40f; font-weight:bold;">🛠️ Em manutenção</p>
      <button class="historico-btn" onclick="abrirHistorico('${id}')">Ver Histórico</button>
    `;
    container.appendChild(card);
  });

  Object.keys(PRESSOES).forEach(id => {
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

// === Atualização periódica ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("Falha ao buscar dados");
    const dados = await res.json();

    if (!dados || Object.keys(dados).length === 0) {
      usarCacheLocal();
      return;
    }

    ultimaLeitura = Date.now();
    dadosAntigos = dados;
    salvarCacheLocal(dados);
    atualizarDisplay(dados);
  } catch {
    usarCacheLocal();
  }
}

// === Cache local ===
function salvarCacheLocal(dados) {
  dados.timestamp = Date.now();
  localStorage.setItem("ultimaLeituraDados", JSON.stringify(dados));
}

function usarCacheLocal() {
  const cache = localStorage.getItem("ultimaLeituraDados");
  if (!cache) return;
  const obj = JSON.parse(cache);
  if (Date.now() - (obj.timestamp || 0) < 10 * 60 * 1000) atualizarDisplay(obj);
  else verificarInatividade();
}

// === Atualização visual dos cards ===
function atualizarDisplay(dados) {
  let reservatoriosCriticos = [];

  Object.entries(RESERVATORIOS).forEach(([id, conf]) => {
    const card = document.getElementById(id);
    const valor = dados[id];
    if (!card || typeof valor !== "number" || isNaN(valor)) return;

    const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));
    card.classList.remove("sem-dados");

    // === status do nível ===
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

    // === manutenção: remove automaticamente se passar de 30% ===
    if (emManutencao[id] && perc > 30) {
      delete emManutencao[id];
    }

    // === aplica ao card ===
    card.dataset.status = status;
    card.querySelector(".nivel").textContent = Math.round(perc) + "%";
    card.querySelector(".litros").textContent = Math.round(valor).toLocaleString() + " L";
    card.style.setProperty("--nivel", perc + "%");
    card.style.setProperty("--corNivel", cor);

    // === exibe ou oculta aviso de manutenção ===
    const aviso = card.querySelector(".status-manutencao");
    if (emManutencao[id]) {
      aviso.style.display = "block";
    } else {
      aviso.style.display = "none";
    }

    const avisoInat = card.querySelector(".aviso-inatividade");
    if (avisoInat) avisoInat.remove();
  });

  Object.keys(PRESSOES).forEach(id => {
    const card = document.getElementById(id);
    const valor = dados[id];
    if (!card || typeof valor !== "number" || isNaN(valor)) return;
    card.classList.remove("sem-dados");
    card.querySelector(".pressao").textContent = valor.toFixed(2) + " bar";
  });

  const last = document.getElementById("lastUpdate");
  if (last) {
    const dt = new Date(dados.timestamp || Date.now());
    last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
  }

  if (reservatoriosCriticos.length > 0) exibirAlerta(reservatoriosCriticos);
  else ocultarAlerta();
}

// === Painel de alerta ===
function exibirAlerta(reservatorios) {
  let painel = document.getElementById("painelAlerta");
  if (!painel) {
    painel = document.createElement("div");
    painel.id = "painelAlerta";
    painel.className = "painel-alerta";
    document.body.appendChild(painel);
  }

  const lista = reservatorios.map(r => {
    const emManut = emManutencao[r.id];
    const botao = emManut
      ? `<button class="remover-btn" onclick="removerManutencao('${r.id}')">Remover da manutenção</button>`
      : `<button onclick="marcarManutencao('${r.id}')">Marcar como em manutenção</button>`;
    return `<div class="alert-item">⚠️ <strong>${r.nome}</strong><br>Nível atual: <b>${Math.round(r.perc)}%</b><div>${botao}</div></div>`;
  }).join("");

  painel.innerHTML = `<h2>🚨 Alerta de Nível Crítico</h2>${lista}`;
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

function ocultarAlerta() {
  alertando = false;
  const painel = document.getElementById("painelAlerta");
  if (painel) painel.style.display = "none";
}

window.marcarManutencao = id => {
  emManutencao[id] = true;
  const card = document.getElementById(id);
  if (card) {
    const aviso = card.querySelector(".status-manutencao");
    if (aviso) aviso.style.display = "block";
  }
  atualizarPainelAlerta();
};

window.removerManutencao = id => {
  delete emManutencao[id];
  const card = document.getElementById(id);
  if (card) {
    const aviso = card.querySelector(".status-manutencao");
    if (aviso) aviso.style.display = "none";
  }
  atualizarPainelAlerta();
};

function atualizarPainelAlerta() {
  const painel = document.getElementById("painelAlerta");
  if (painel && painel.style.display === "block") atualizarLeituras();
}

// === Som do alerta ===
function tocarBip() {
  try {
    if (!audioBip)
      audioBip = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audioBip.currentTime = 0;
    audioBip.play();
  } catch {}
}

// === Inatividade ===
function verificarInatividade() {
  const tempoSemAtualizar = Date.now() - ultimaLeitura;
  const cards = document.querySelectorAll(".card");

  if (tempoSemAtualizar > 10 * 60 * 1000) {
    cards.forEach(card => {
      card.classList.add("sem-dados");
      const nivel = card.querySelector(".nivel");
      const litros = card.querySelector(".litros");
      const pressao = card.querySelector(".pressao");
      if (nivel) nivel.textContent = "--%";
      if (litros) litros.textContent = "0 L";
      if (pressao) pressao.textContent = "-- bar";

      let aviso = card.querySelector(".aviso-inatividade");
      if (!aviso) {
        aviso = document.createElement("p");
        aviso.className = "aviso-inatividade";
        aviso.textContent = "⚠ Sem atualização há mais de 10 minutos!";
        aviso.style.color = "#e74c3c";
        aviso.style.fontWeight = "bold";
        aviso.style.textAlign = "center";
        aviso.style.animation = "piscar 1s infinite";
        card.appendChild(aviso);
      }
    });

    const last = document.getElementById("lastUpdate");
    if (last) last.innerHTML = "Sem atualização há mais de 10 minutos!";
  } else {
    cards.forEach(card => {
      const aviso = card.querySelector(".aviso-inatividade");
      if (aviso) aviso.remove();
    });
  }
}

// === CSS ===
const style = document.createElement("style");
style.textContent = `
@keyframes piscar { 0%, 50%, 100% {opacity:1;} 25%,75%{opacity:0;} }
.status-manutencao { animation: piscar 2s infinite; }
`;
document.head.appendChild(style);

// === Inicialização ===
window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  usarCacheLocal();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
  setInterval(verificarInatividade, 30000);
});

window.abrirHistorico = id => {
  window.location.href = "historico.html?reservatorio=" + id;
};
