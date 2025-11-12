// === dashboard.js ===
// Mantém última leitura válida entre recarregamentos e só zera após 10 min sem dados

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 30000; // 30 segundos
let ultimaLeitura = 0;
let alertando = false;
let emManutencao = {};
let audioBip;
let dadosAntigos = {}; // cache local

// === Configuração ===
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

// === Cria os cards ===
function criarCards() {
  const container = document.querySelector(".cards-container");
  if (!container) return;
  container.innerHTML = "";

  Object.keys(RESERVATORIOS).forEach(id => {
    const card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;
    card.innerHTML =
      "<h2>" + RESERVATORIOS[id].nome + "</h2>" +
      '<p class="nivel">--%</p>' +
      '<p class="litros">0 L</p>' +
      '<button class="historico-btn" onclick="abrirHistorico(\'' + id + '\')">Ver Histórico</button>';
    container.appendChild(card);
  });

  Object.keys(PRESSOES).forEach(id => {
    const card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;
    card.innerHTML =
      "<h2>" + PRESSOES[id] + "</h2>" +
      '<p class="pressao">-- bar</p>';
    container.appendChild(card);
  });
}

// === Atualiza leituras (com cache localStorage) ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("Falha ao buscar dados");
    const dados = await res.json();

    // se dados vierem vazios, não limpa o painel — usa cache
    if (!dados || Object.keys(dados).length === 0) {
      console.warn("Sem novos dados do servidor. Usando cache local...");
      usarCacheLocal();
      return;
    }

    // dados válidos → salva cache
    ultimaLeitura = Date.now();
    dadosAntigos = dados;
    salvarCacheLocal(dados);
    atualizarDisplay(dados);
  } catch (err) {
    console.error("Erro ao atualizar leituras:", err);
    usarCacheLocal();
  }
}

// === Função: usar cache salvo ===
function usarCacheLocal() {
  const cache = localStorage.getItem("ultimaLeituraDados");
  if (cache) {
    const obj = JSON.parse(cache);
    dadosAntigos = obj;
    if (Date.now() - (obj.timestamp || 0) < 10 * 60 * 1000) {
      atualizarDisplay(obj);
    } else {
      console.warn("Cache expirado há mais de 10 minutos");
      verificarInatividade();
    }
  }
}

// === Função: salvar no localStorage ===
function salvarCacheLocal(dados) {
  dados.timestamp = Date.now();
  localStorage.setItem("ultimaLeituraDados", JSON.stringify(dados));
}

// === Atualiza os cards ===
function atualizarDisplay(dados) {
  let reservatoriosCriticos = [];

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

    if (perc >= 70 && emManutencao[id]) delete emManutencao[id];

    card.dataset.status = status;
    card.querySelector(".nivel").textContent = Math.round(perc) + "%";
    card.querySelector(".litros").textContent = Math.round(valor).toLocaleString() + " L";
    card.style.setProperty("--nivel", perc + "%");
    card.style.setProperty("--corNivel", cor);

    const aviso = card.querySelector(".aviso-inatividade");
    if (aviso) aviso.remove();
  });

  Object.keys(PRESSOES).forEach(id => {
    const card = document.getElementById(id);
    const valor = dados[id];
    if (!card || typeof valor !== "number" || isNaN(valor)) return;
    card.classList.remove("sem-dados");
    card.querySelector(".pressao").textContent = Number(valor).toFixed(2) + " bar";
  });

  const last = document.getElementById("lastUpdate");
  if (last) {
    const dt = new Date(dados.timestamp || Date.now());
    last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
  }

  if (reservatoriosCriticos.length > 0) exibirAlerta(reservatoriosCriticos);
  else ocultarAlerta();
}

// === Painel flutuante ===
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
      ? '<button class="remover-btn" onclick="removerManutencao(\'' + r.id + '\')">Remover da manutenção</button>'
      : '<button onclick="marcarManutencao(\'' + r.id + '\')">Marcar como em manutenção</button>';
    return '<div class="alert-item">⚠️ <strong>' + r.nome + '</strong><br>Nível atual: <b>' + Math.round(r.perc) + '%</b><div>' + botao + '</div></div>';
  }).join("");

  painel.innerHTML = '<h2>🚨 Alerta de Nível Crítico</h2>' + lista;
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

window.marcarManutencao = id => { emManutencao[id] = true; atualizarPainelAlerta(); };
window.removerManutencao = id => { delete emManutencao[id]; atualizarPainelAlerta(); };

function atualizarPainelAlerta() {
  const painel = document.getElementById("painelAlerta");
  if (painel && painel.style.display === "block") atualizarLeituras();
}

function tocarBip() {
  try {
    if (!audioBip) audioBip = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audioBip.currentTime = 0;
    audioBip.play();
  } catch (e) {}
}

// === Verifica inatividade ===
function verificarInatividade() {
  const tempoSemAtualizar = Date.now() - ultimaLeitura;
  const cards = document.querySelectorAll(".card");

  if (tempoSemAtualizar > 10 * 60 * 1000) {
    cards.forEach(card => {
      card.classList.add("sem-dados");
      const nivelEl = card.querySelector(".nivel");
      const litrosEl = card.querySelector(".litros");
      const pressaoEl = card.querySelector(".pressao");
      if (nivelEl) nivelEl.textContent = "--%";
      if (litrosEl) litrosEl.textContent = "0 L";
      if (pressaoEl) pressaoEl.textContent = "-- bar";
      card.style.setProperty("--nivel", "0%");

      let aviso = card.querySelector(".aviso-inatividade");
      if (!aviso) {
        aviso = document.createElement("p");
        aviso.className = "aviso-inatividade";
        aviso.textContent = "⚠ Sem atualização há mais de 10 minutos!";
        card.appendChild(aviso);
      }
      aviso.style.color = "#e74c3c";
      aviso.style.fontWeight = "bold";
      aviso.style.marginTop = "5px";
      aviso.style.textAlign = "center";
      aviso.style.animation = "piscar 1s infinite";
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

// === CSS animação ===
const style = document.createElement("style");
style.textContent = "@keyframes piscar { 0%, 50%, 100% { opacity: 1; } 25%, 75% { opacity: 0; } }";
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
