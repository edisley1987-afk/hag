// === dashboard.js ===
// Exibe leituras em tempo real com alertas visuais e painel lateral

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 30000; // atualização a cada 30s
let ultimaLeitura = 0;
let emManutencao = {}; // reservatórios marcados como manutenção

// Configuração dos reservatórios (em litros)
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

// === Cria os cards dinamicamente ===
function criarCards() {
  const container = document.querySelector(".cards-container");
  if (!container) return;
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

  // Painel lateral para alertas
  criarPainelAlerta();
}

// === Cria painel lateral fixo ===
function criarPainelAlerta() {
  let painel = document.getElementById("painel-alerta");
  if (painel) return;

  painel = document.createElement("div");
  painel.id = "painel-alerta";
  painel.style.cssText = `
    position: fixed;
    top: 0; right: -400px;
    width: 400px;
    height: 100%;
    background: #ffebee;
    color: #b71c1c;
    box-shadow: -4px 0 12px rgba(0,0,0,0.2);
    transition: right 0.5s;
    padding: 20px;
    overflow-y: auto;
    z-index: 9999;
  `;
  painel.innerHTML = `
    <h2>⚠️ Alertas Ativos</h2>
    <div id="lista-alertas">Nenhum alerta ativo</div>
  `;
  document.body.appendChild(painel);
}

// === Atualiza as leituras do servidor ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("Falha ao buscar dados");
    const dados = await res.json();
    if (!dados || Object.keys(dados).length === 0) return;

    ultimaLeitura = Date.now();
    const alertasAtivos = [];

    // Atualiza reservatórios
    Object.entries(RESERVATORIOS).forEach(([id, conf]) => {
      const card = document.getElementById(id);
      if (!card) return;

      const valor = dados[id];
      if (typeof valor !== "number" || isNaN(valor)) return;

      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));
      card.classList.remove("sem-dados");

      let status = "alto";
      let cor = "linear-gradient(to top, #3498db, #2ecc71)";
      if (perc < 30) {
        status = "baixo";
        cor = "linear-gradient(to top, #e74c3c, #ff8c00)";
        if (!emManutencao[id]) alertasAtivos.push(conf.nome);
      } else if (perc < 70) {
        status = "medio";
        cor = "linear-gradient(to top, #f1c40f, #f39c12)";
      }

      card.dataset.status = status;
      card.querySelector(".nivel").innerHTML = perc.toFixed(0) + "%";
      card.querySelector(".litros").innerHTML = valor.toLocaleString() + " L";
      card.style.setProperty("--nivel", perc + "%");
      card.style.setProperty("--corNivel", cor);
    });

    // Atualiza pressões
    Object.entries(PRESSOES).forEach(([id, nome]) => {
      const card = document.getElementById(id);
      if (!card) return;
      const valor = dados[id];
      if (typeof valor !== "number" || isNaN(valor)) return;
      card.classList.remove("sem-dados");
      card.querySelector(".pressao").innerHTML = valor.toFixed(2) + " bar";
    });

    // Atualiza data/hora
    const last = document.getElementById("lastUpdate");
    if (last) {
      const dt = new Date(dados.timestamp || Date.now());
      last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
    }

    // Exibe painel se houver alertas
    atualizarPainel(alertasAtivos);
  } catch (err) {
    console.error("Erro ao buscar leituras:", err);
  }
}

// === Atualiza conteúdo do painel lateral ===
function atualizarPainel(alertas) {
  const painel = document.getElementById("painel-alerta");
  const lista = document.getElementById("lista-alertas");
  if (!painel || !lista) return;

  if (alertas.length === 0) {
    lista.innerHTML = "Nenhum alerta ativo";
    painel.style.right = "-400px";
    return;
  }

  lista.innerHTML = alertas
    .map(
      (nome) => `
      <div class="alerta-item" style="margin-bottom:15px;border-bottom:1px solid #ccc;padding-bottom:10px">
        <p><b>${nome}</b> está abaixo de 30%</p>
        <button onclick="marcarManutencao('${nome}')" 
          style="background:#b71c1c;color:white;border:0;border-radius:6px;padding:6px 12px;cursor:pointer">
          Marcar como manutenção
        </button>
      </div>
    `
    )
    .join("");

  // Exibir o painel por 10s a cada 30s
  painel.style.right = "0";
  setTimeout(() => {
    painel.style.right = "-400px";
  }, 10000);
}

// === Marcar reservatório como manutenção ===
window.marcarManutencao = function (nome) {
  const id = Object.keys(RESERVATORIOS).find((k) => RESERVATORIOS[k].nome === nome);
  if (id) {
    emManutencao[id] = true;
    atualizarPainel([]);
    alert(`${nome} foi marcado como em manutenção e não gerará alertas.`);
  }
};

// === Zera os cards após 10 minutos sem dados ===
function verificarInatividade() {
  const tempoSemAtualizar = Date.now() - ultimaLeitura;
  if (tempoSemAtualizar > 10 * 60 * 1000) {
    document.querySelectorAll(".card").forEach((card) => {
      card.classList.add("sem-dados");
      if (card.querySelector(".nivel")) card.querySelector(".nivel").innerHTML = "--%";
      if (card.querySelector(".litros")) card.querySelector(".litros").innerHTML = "0 L";
      if (card.querySelector(".pressao")) card.querySelector(".pressao").innerHTML = "-- bar";
      card.style.setProperty("--nivel", "0%");
    });
    const last = document.getElementById("lastUpdate");
    if (last) last.innerHTML = "Sem atualização há mais de 10 minutos!";
  }
}

// === Inicializa dashboard ===
window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
  setInterval(verificarInatividade, 30000);
});

// === Abre histórico ===
window.abrirHistorico = function (reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
