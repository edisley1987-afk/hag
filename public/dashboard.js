// === dashboard.js ===
// Monitoramento em tempo real com alerta flutuante, aviso de inatividade e manutenção
// Versão sem template literals problemáticos

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 30000; // 30s
let ultimaLeitura = 0;
let alertando = false;
let emManutencao = {}; // { idReservatorio: true }
let audioBip;
let dadosAntigos = {}; // cache da última leitura válida

// Configuração dos reservatórios
var RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 }
};

// Pressões
var PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

// Cria os cards na tela
function criarCards() {
  var container = document.querySelector(".cards-container");
  if (!container) return;
  container.innerHTML = "";

  Object.keys(RESERVATORIOS).forEach(function(id) {
    var card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;
    card.innerHTML =
      "<h2>" + RESERVATORIOS[id].nome + "</h2>" +
      '<p class="nivel">--%</p>' +
      '<p class="litros">0 L</p>' +
      '<button class="historico-btn" onclick="abrirHistorico(\'' + id + '\')">Ver Histórico</button>';
    container.appendChild(card);
  });

  Object.keys(PRESSOES).forEach(function(id) {
    var card = document.createElement("div");
    card.className = "card sem-dados";
    card.id = id;
    card.innerHTML =
      "<h2>" + PRESSOES[id] + "</h2>" +
      '<p class="pressao">-- bar</p>';
    container.appendChild(card);
  });
}

// Atualiza as leituras (com cache)
async function atualizarLeituras() {
  try {
    var res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("Falha ao buscar dados");
    var dados = await res.json();

    if (!dados || Object.keys(dados).length === 0) {
      console.warn("Sem dados novos, mantendo última leitura...");
      atualizarDisplayComCache();
      return;
    }

    ultimaLeitura = Date.now();
    dadosAntigos = dados;
    atualizarDisplay(dados);
  } catch (err) {
    console.error("Erro ao atualizar leituras:", err);
    atualizarDisplayComCache();
  }
}

function atualizarDisplayComCache() {
  var agora = Date.now();
  if (Object.keys(dadosAntigos).length > 0 && agora - ultimaLeitura < 10 * 60 * 1000) {
    atualizarDisplay(dadosAntigos);
  }
}

function atualizarDisplay(dados) {
  var reservatoriosCriticos = [];

  // Reservatórios
  Object.entries(RESERVATORIOS).forEach(function(entry) {
    var id = entry[0];
    var conf = entry[1];
    var card = document.getElementById(id);
    var valor = dados[id];
    if (!card || typeof valor !== "number" || isNaN(valor)) return;

    var perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));
    card.classList.remove("sem-dados");

    var status = "alto";
    var cor = "linear-gradient(to top, #3498db, #2ecc71)";
    if (perc < 30) {
      status = "baixo";
      cor = "linear-gradient(to top, #e74c3c, #ff8c00)";
      if (!emManutencao[id]) reservatoriosCriticos.push({ id: id, nome: conf.nome, perc: perc });
    } else if (perc < 70) {
      status = "medio";
      cor = "linear-gradient(to top, #f1c40f, #f39c12)";
    }

    if (perc >= 70 && emManutencao[id]) delete emManutencao[id];

    card.dataset.status = status;
    var nivelEl = card.querySelector(".nivel");
    var litrosEl = card.querySelector(".litros");
    if (nivelEl) nivelEl.textContent = Math.round(perc) + "%";
    if (litrosEl) litrosEl.textContent = Math.round(valor).toLocaleString() + " L";
    card.style.setProperty("--nivel", perc + "%");
    card.style.setProperty("--corNivel", cor);

    // Remove aviso de inatividade, se existir
    var aviso = card.querySelector(".aviso-inatividade");
    if (aviso) aviso.remove();
  });

  // Pressões
  Object.keys(PRESSOES).forEach(function(id) {
    var card = document.getElementById(id);
    var valor = dados[id];
    if (!card || typeof valor !== "number" || isNaN(valor)) return;
    card.classList.remove("sem-dados");
    var p = card.querySelector(".pressao");
    if (p) p.textContent = Number(valor).toFixed(2) + " bar";
  });

  // Última atualização
  var last = document.getElementById("lastUpdate");
  if (last) {
    var dt = new Date(dados.timestamp || Date.now());
    last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
  }

  // Alerta
  if (reservatoriosCriticos.length > 0) exibirAlerta(reservatoriosCriticos);
  else ocultarAlerta();
}

// Painel flutuante lateral
function exibirAlerta(reservatorios) {
  var painel = document.getElementById("painelAlerta");
  if (!painel) {
    painel = document.createElement("div");
    painel.id = "painelAlerta";
    painel.className = "painel-alerta";
    document.body.appendChild(painel);
  }

  var lista = reservatorios.map(function(r) {
    var emManut = emManutencao[r.id];
    var botao = emManut
      ? '<button class="remover-btn" onclick="removerManutencao(\'' + r.id + '\')">Remover da manutenção</button>'
      : '<button onclick="marcarManutencao(\'' + r.id + '\')">Marcar como em manutenção</button>';
    return '<div class="alert-item">⚠️ <strong>' + r.nome + '</strong><br>Nível atual: <b>' + Math.round(r.perc) + '%</b><div>' + botao + '</div></div>';
  }).join("");

  painel.innerHTML = '<h2>🚨 Alerta de Nível Crítico</h2>' + lista;
  painel.style.display = "block";

  if (!alertando) {
    alertando = true;
    tocarBip();
    var bipInterval = setInterval(function() {
      if (!alertando) clearInterval(bipInterval);
      else tocarBip();
    }, 10000);
  }
}

function ocultarAlerta() {
  alertando = false;
  var painel = document.getElementById("painelAlerta");
  if (painel) painel.style.display = "none";
}

window.marcarManutencao = function(id) {
  emManutencao[id] = true;
  atualizarPainelAlerta();
};

window.removerManutencao = function(id) {
  delete emManutencao[id];
  atualizarPainelAlerta();
};

function atualizarPainelAlerta() {
  var painel = document.getElementById("painelAlerta");
  if (painel && painel.style.display === "block") {
    atualizarLeituras();
  }
}

function tocarBip() {
  try {
    if (!audioBip) audioBip = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audioBip.currentTime = 0;
    audioBip.play();
  } catch (e) { /* autoplay bloqueado ou erro */ }
}

// Verifica inatividade e exibe aviso dentro do card
function verificarInatividade() {
  var tempoSemAtualizar = Date.now() - ultimaLeitura;
  var cards = document.querySelectorAll(".card");

  if (tempoSemAtualizar > 10 * 60 * 1000) {
    cards.forEach(function(card) {
      card.classList.add("sem-dados");
      var nivelEl = card.querySelector(".nivel");
      var litrosEl = card.querySelector(".litros");
      var pressaoEl = card.querySelector(".pressao");
      if (nivelEl) nivelEl.textContent = "--%";
      if (litrosEl) litrosEl.textContent = "0 L";
      if (pressaoEl) pressaoEl.textContent = "-- bar";
      card.style.setProperty("--nivel", "0%");

      // Mensagem de inatividade piscando
      var aviso = card.querySelector(".aviso-inatividade");
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

    var last = document.getElementById("lastUpdate");
    if (last) last.innerHTML = "Sem atualização há mais de 10 minutos!";
  } else {
    // Remove aviso quando voltar a atualizar
    cards.forEach(function(card) {
      var aviso = card.querySelector(".aviso-inatividade");
      if (aviso) aviso.remove();
    });
  }
}

// Adiciona CSS da animação (sem template literal)
var style = document.createElement("style");
style.textContent = "@keyframes piscar { 0%, 50%, 100% { opacity: 1; } 25%, 75% { opacity: 0; } }";
document.head.appendChild(style);

// Inicialização
window.addEventListener("DOMContentLoaded", function() {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
  setInterval(verificarInatividade, 30000);
});

window.abrirHistorico = function(id) {
  // usa concatenação para evitar backticks
  window.location.href = "historico.html?reservatorio=" + id;
};
