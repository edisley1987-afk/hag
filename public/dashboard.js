// ====================== dashboard.js ======================

// ROTA da API
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// Última leitura salva
let ultimaLeitura = null;

// Configuração dos reservatórios (nomes e capacidades)
const RESERVATORIOS = {
  Reservatorio_elevador: { nome: "Reservatório Elevador", capacidade: 20000 },
  RESERVATORIO_Osmose: { nome: "Osmose Reversa", capacidade: 200 },
  RESERVATORIO_CME: { nome: "CME", capacidade: 1000 },
  RESERVATORIO_Abrandada: { nome: "Abrandada", capacidade: 9000 }
};

// Configuração das pressões
const PRESSOES_CFG = {
  Pressao_saida_CME: "Pressão Saída CME",
  Pressao_Abrandada: "Pressão Abrandada",
  Pressao_Rede_Interna: "Pressão Rede Interna",
  Pressao_saida: "Pressão Saída",
  Pressao_retorno: "Pressão Retorno"
};

// Ao carregar
document.addEventListener("DOMContentLoaded", () => {
  montarEstruturas();
  atualizar();
  setInterval(atualizar, UPDATE_INTERVAL);
});

/* ------------------------------------------------------------
   CRIA CARDS NA TELA
------------------------------------------------------------ */
function montarEstruturas() {
  const contR = document.getElementById("reservatoriosContainer");
  const contP = document.getElementById("pressoesContainer");

  contR.innerHTML = "";
  contP.innerHTML = "";

  // Cards dos reservatórios
  Object.keys(RESERVATORIOS).forEach(chave => {
    contR.innerHTML += `
      <div class="card tanque">
        <h3>${RESERVATORIOS[chave].nome}</h3>

        <div class="tanque-visu">
          <div class="nivel-agua" id="${chave}_nivel"></div>
        </div>

        <p class="percentual" id="${chave}_percent">--%</p>
      </div>
    `;
  });

  // Cards das pressões
  Object.keys(PRESSOES_CFG).forEach(chave => {
    contP.innerHTML += `
      <div class="card pressao-card">
        <h3>${PRESSOES_CFG[chave]}</h3>
        <p id="${chave}_valor" class="pressao-valor">-- bar</p>
      </div>
    `;
  });
}

/* ------------------------------------------------------------
   BUSCA DADOS
------------------------------------------------------------ */
async function atualizar() {
  try {
    const r = await fetch(API_URL);
    if (!r.ok) throw new Error("Erro API");

    const dados = await r.json();
    ultimaLeitura = dados;

    renderizar(dados);
    atualizarRelogio();
  } catch (e) {
    if (ultimaLeitura) {
      renderizar(ultimaLeitura);
    }
  }
}

/* ------------------------------------------------------------
   DESENHA OS DADOS NA TELA
------------------------------------------------------------ */
function renderizar(raw) {

  // --------- RESERVATÓRIOS ---------
  Object.keys(RESERVATORIOS).forEach(chave => {
    const capacidade = RESERVATORIOS[chave].capacidade;
    const valor = raw[chave + "_current"];

    if (valor == null) return;

    const percent = Math.min(100, Math.max(0, (valor / capacidade) * 100));

    document.getElementById(chave + "_nivel").style.height = percent + "%";
    document.getElementById(chave + "_percent").textContent = percent.toFixed(1) + "%";
  });

  // --------- PRESSÕES ---------
  Object.keys(PRESSOES_CFG).forEach(chave => {
    const v = raw[chave + "_current"];
    if (v == null) return;

    document.getElementById(chave + "_valor").textContent = v.toFixed(2) + " bar";
  });
}

/* ------------------------------------------------------------
   RELÓGIO
------------------------------------------------------------ */
function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + agora.toLocaleTimeString("pt-BR");
}
