// Rotas
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

let ultimaLeitura = null;

// Configuração dos reservatórios
const RESERVATORIOS = {
  Reservatorio_Elevador: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose: { nome: "Osmose Reversa", capacidade: 200 },
  Reservatorio_CME: { nome: "CME", capacidade: 5000 },
  Reservatorio_Abrandada: { nome: "Abrandada", capacidade: 5000 }
};

// Configuração das pressões
const PRESSOES_CFG = {
  Pressao_Saida_CME: "Pressão Saída CME",
  Pressao_Abrandada: "Pressão Abrandada",
  Pressao_Rede: "Pressão Rede Interna"
};

document.addEventListener("DOMContentLoaded", () => {
  criarEstruturaInicial();
  atualizar();
  setInterval(atualizar, UPDATE_INTERVAL);
});

/* -----------------------------------------
   CRIA STRUCT DOS CARDS
----------------------------------------- */
function criarEstruturaInicial() {

  const res = document.getElementById("reservatoriosContainer");
  const pres = document.getElementById("pressoesContainer");

  res.innerHTML = "";
  pres.innerHTML = "";

  // RESERVATÓRIOS ------------------------------
  Object.keys(RESERVATORIOS).forEach(chave => {
    res.innerHTML += `
      <div class="card-reservatorio" id="${chave}">
        <h3>${RESERVATORIOS[chave].nome}</h3>
        <div class="tanque-visu">
          <div class="nivel-agua" id="${chave}_nivel"></div>
        </div>
        <p class="percentual" id="${chave}_percent">--%</p>
      </div>`;
  });

  // PRESSÕES ----------------------------------
  Object.keys(PRESSOES_CFG).forEach(chave => {
    pres.innerHTML += `
      <div class="card-pressao" id="${chave}">
        <h3>${PRESSOES_CFG[chave]}</h3>
        <p class="pressao-valor" id="${chave}_valor">-- bar</p>
      </div>`;
  });
}

/* -----------------------------------------
   ATUALIZA OS DADOS
----------------------------------------- */
async function atualizar() {
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error("Erro na API");

    const dados = await resp.json();
    ultimaLeitura = dados;

    renderizarDados(dados);

  } catch (e) {
    if (ultimaLeitura) renderizarDados(ultimaLeitura);
  }
}

/* -----------------------------------------
   RENDERIZA NA TELA
----------------------------------------- */
function renderizarDados(raw) {

  // RESERVATÓRIOS ----------------------------
  Object.keys(RESERVATORIOS).forEach(chave => {
    const capacidade = RESERVATORIOS[chave].capacidade;
    const valor = raw[chave + "_current"];

    if (valor == null) return;

    const percent = Math.min(100, Math.max(0, (valor / capacidade) * 100));

    document.getElementById(chave + "_nivel").style.height = percent + "%";
    document.getElementById(chave + "_percent").textContent = percent.toFixed(1) + "%";

    const card = document.getElementById(chave);
    if (percent <= 30) card.classList.add("alerta");
    else card.classList.remove("alerta");
  });

  // PRESSÕES ----------------------------------
  Object.keys(PRESSOES_CFG).forEach(chave => {
    const valor = raw[chave + "_current"];
    if (valor == null) return;
    document.getElementById(chave + "_valor").textContent = valor.toFixed(2) + " bar";
  });
}
