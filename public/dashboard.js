/* === dashboard.js FINAL === */

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

/* ================================
   CONFIGURAÇÃO DOS RESERVATÓRIOS
================================= */
const RESERVATORIOS = {
  Reservatorio_elevador: {
    nome: "Reservatório Elevador",
    capacidade: 20000,
    altura: 1.45,
    leituraVazio: 0.004168,
    ref: "Reservatorio_elevador_current"
  },

  RESERVATORIO_Osmose: {
    nome: "Reservatório Osmose",
    capacidade: 200,
    altura: 1.0,
    leituraVazio: 0.00505,
    ref: "RESERVATORIO_Osmose_current"
  },

  RESERVATORIO_CME: {
    nome: "Reservatório CME",
    capacidade: 1000,
    altura: 0.45,
    leituraVazio: 0.004088,
    ref: "RESERVATORIO_CME_current"
  },

  RESERVATORIO_Abrandada: {
    nome: "Reservatório Abrandada",
    capacidade: 9000,
    altura: 0.6,
    leituraVazio: 0.004008,
    ref: "RESERVATORIO_Abrandada_current"
  }
};

/* ================================
   CONFIG DOS SENSORES DE PRESSÃO
================================= */
const PRESSOES = {
  Pressao_saida_296: {
    nome: "Pressão Saída (296)",
    ref: "Pressao_Saida_296_current"
  },

  Pressao_retorno_296: {
    nome: "Pressão Retorno (296)",
    ref: "Pressao_Retorno_296_current"
  },

  Pressao_Saida_CME: {
    nome: "Pressão Saída CME",
    ref: "Pressao_Saida_CME_current"
  }
};

/* =============================
    CRIAR OS CARDS DINAMICAMENTE
============================= */
function criarCards() {
  const rContainer = document.getElementById("reservatoriosContainer");
  const pContainer = document.getElementById("pressoesContainer");

  rContainer.innerHTML = "";
  pContainer.innerHTML = "";

  Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
    rContainer.innerHTML += `
      <div class="card" id="card-${key}">
        <h3>${cfg.nome}</h3>
        <div class="nivel">
          <div class="nivel-barra" id="nivel-${key}"></div>
        </div>
        <p class="valor" id="valor-${key}">--</p>
      </div>
    `;
  });

  Object.entries(PRESSOES).forEach(([key, cfg]) => {
    pContainer.innerHTML += `
      <div class="card" id="card-${key}">
        <h3>${cfg.nome}</h3>
        <p class="valor" id="valor-${key}">--</p>
      </div>
    `;
  });
}

/* =============================
    ATUALIZAR NÍVEIS E PRESSÕES
============================= */
function atualizarValores(dados) {
  if (!Array.isArray(dados)) {
    console.error("ERRO: API não retornou array:", dados);
    return;
  }

  dados.forEach(item => {
    const ref = item.ref;
    const valor = item.value;

    /* --- RESERVATÓRIOS --- */
    Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
      if (cfg.ref === ref) {
        const percentual = calcularPercentual(valor, cfg.leituraVazio, cfg.altura);
        const litros = Math.round((percentual / 100) * cfg.capacidade);

        document.getElementById(`valor-${key}`).innerText =
          `${percentual.toFixed(1)}% (${litros} L)`;

        document.getElementById(`nivel-${key}`).style.height = `${percentual}%`;
      }
    });

    /* --- PRESSÕES --- */
    Object.entries(PRESSOES).forEach(([key, cfg]) => {
      if (cfg.ref === ref) {
        document.getElementById(`valor-${key}`).innerText =
          valor.toFixed(3) + " bar";
      }
    });
  });

  document.getElementById("lastUpdate").innerText =
    "Última atualização: " + new Date().toLocaleString("pt-BR");
}

/* =============================
     CÁLCULO DE NÍVEL (%)
============================= */
function calcularPercentual(leitura, leituraVazio, alturaRes) {
  const alturaAtual = leitura - leituraVazio;
  let perc = (alturaAtual / alturaRes) * 100;

  if (perc < 0) perc = 0;
  if (perc > 100) perc = 100;
  return perc;
}

/* =============================
         LOOP PRINCIPAL
============================= */
async function atualizarLoop() {
  try {
    const resp = await fetch(API_URL);
    const dados = await resp.json();
    atualizarValores(dados);
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
  }
}

criarCards();
atualizarLoop();
setInterval(atualizarLoop, UPDATE_INTERVAL);
