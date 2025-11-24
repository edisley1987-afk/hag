// ====================== dashboard.js ======================

// Rotas da API
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// Última leitura armazenada em caso de falha
let ultimaLeitura = null;

// Configuração dos reservatórios
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

// Cria os cards quando a página carrega
document.addEventListener("DOMContentLoaded", () => {
  criarEstruturas();
  atualizar();
  setInterval(atualizar, UPDATE_INTERVAL);
});

/* ------------------------------------------------------------
   CRIA OS CARDS NA TELA
------------------------------------------------------------ */
function criarEstruturas() {
  const r = document.getElementById("reservatoriosContainer");
  const p = document.getElementById("pressoesContainer");

  r.innerHTML = "";
  p.innerHTML = "";

  // Criar cards dos reservatórios
  Object.keys(RESERVATORIOS).forEach(chave => {
    r.innerHTML += `
      <div class="card tanque">
        <h3>${RESERVATORIOS[chave].nome}</h3>

        <div class="tanque-visu">
          <div class="nivel-agua" id="${chave}_nivel"></div>
        </div>

        <p class="percentual" id="${chave}_percent">--%</p>
      </div>
    `;
  });

  // Criar cards das pressões
  Object.keys(PRESSOES_CFG).forEach(chave => {
    p.innerHTML += `
      <div class="card pressao-card">
        <h3>${PRESSOES_CFG[chave]}</h3>
        <p id="${chave}_valor" class="pressao-valor">-- bar</p>
      </div>
    `;
  });
}

/* ------------------------------------------------------------
   BUSCAR DADOS DA API
------------------------------------------------------------ */
async function atualizar() {
  try {
    const r = await fetch(API_URL);
    if (!r.ok) throw new Error("Falha API");

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
   MOSTRA DADOS NA TELA
------------------------------------------------------------ */
function renderizar(raw) {

  // -------- RESERVATÓRIOS --------
  Object.keys(RESERVATORIOS).forEach(chave => {
    const capacidade = RESERVATORIOS[chave].capacidade;

    const valor = raw[chave + "_current"];
    if (valor == null) return;

    const percent = Math.min(100, Math.max(0, (valor / capacidade) * 100));

    document.getElementById(chave + "_nivel").style.height = percent + "%";
    document.getElementById(chave + "_percent").textContent = percent.toFixed(1) + "%";
  });

  // -------- PRESSÕES --------
  Object.keys(PRESSOES_CFG).forEach(chave => {
    const v = raw[chave + "_current"];
    if (v == null) return;

    document.getElementById(chave + "_valor").textContent = v.toFixed(2) + " bar";
  });
}

/* ------------------------------------------------------------
   RELÓGIO DE ULTIMA ATUALIZAÇÃO
------------------------------------------------------------ */
function atualizarRelogio() {
  const div = document.getElementById("lastUpdate");
  const agora = new Date();
  div.textContent = "Última atualização: " +
    agora.toLocaleTimeString("pt-BR");
}
