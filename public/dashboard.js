// ====================== CONFIG ===========================
const API_URL = "/dados";  // sua rota que retorna as leituras
const UPDATE_INTERVAL = 5000;

// Capacidades dos reservatórios (litros)
const CAP = {
  elevador: 20000,
  osmose: 200,
  cme: 5000,
  abrandada: 5000
};

// Mapeamento dos nomes do JSON → nomes do dashboard
const MAP = {
  Reservatorio_Elevador_current: "elevador",
  Reservatorio_Osmose_current: "osmose",
  Reservatorio_CME_current: "cme",
  Agua_Abrandada_current: "abrandada",

  Pressao_Saida_Osmose_current: "pressao_saida_osmose",
  Pressao_Retorno_Osmose_current: "pressao_retorno_osmose",
  Pressao_Saida_CME_current: "pressao_saida_cme"
};

// Lista de exibição
const ITEMS = [
  "elevador",
  "osmose",
  "cme",
  "abrandada",
  "pressao_saida_osmose",
  "pressao_retorno_osmose",
  "pressao_saida_cme"
];

// ============================================================
// Criação dos cards
// ============================================================
function criarCards() {
  const div = document.getElementById("cards");
  div.innerHTML = "";

  ITEMS.forEach(id => {
    let tipo = id.includes("pressao") ? "pressao" : "reservatorio";

    let html = `
      <div class="card" id="card_${id}">
        ${
          tipo === "reservatorio"
            ? `
            <div class="nivelBox">
              <div class="nivelInterno" id="nivel_${id}" style="height:0%"></div>
            </div>
            <h3>${formatarNome(id)}</h3>
            <h2 id="pct_${id}">--%</h2>
            <p id="litros_${id}">-- L</p>
            <button class="histBtn" onclick="irHistorico('${id}')">Ver Histórico</button>
          `
            : `
            <h3>${formatarNome(id)}</h3>
            <h2 id="press_${id}">-- bar</h2>
          `
        }
      </div>
    `;

    div.innerHTML += html;
  });
}

criarCards();

// ============================================================
// Nome formatado para os cards
// ============================================================
function formatarNome(str) {
  return str
    .replace("cme", "CME")
    .replace("osmose", "Osmose")
    .replace("elevador", "Elevador")
    .replace("abrandada", "Água Abrandada")
    .replace("pressao_saida_osmose", "Pressão Saída Osmose")
    .replace("pressao_retorno_osmose", "Pressão Retorno Osmose")
    .replace("pressao_saida_cme", "Pressão Saída CME");
}

// ============================================================
// Acessar tela de histórico
// ============================================================
function irHistorico(id) {
  window.location.href = `historico.html?res=${id}`;
}

// ============================================================
// Atualizar interface com dados
// ============================================================
function atualizarUI(data) {
  document.getElementById("lastUpdate").innerHTML =
    "Atualizado em: " + new Date().toLocaleTimeString();

  Object.keys(MAP).forEach(key => {
    const nome = MAP[key];
    const valor = data[key];

    if (valor == null) return;

    // PRESSÃO
    if (nome.includes("pressao")) {
      document.getElementById("press_" + nome).innerHTML =
        valor.toFixed(2) + " bar";
      return;
    }

    // RESERVATÓRIO
    const cap = CAP[nome];
    const pct = Math.min(100, Math.max(0, (valor / cap) * 100));

    const pctEl = document.getElementById("pct_" + nome);
    const litEl = document.getElementById("litros_" + nome);
    const nivEl = document.getElementById("nivel_" + nome);

    pctEl.innerHTML = pct.toFixed(0) + "%";
    litEl.innerHTML = valor + " L";
    nivEl.style.height = pct + "%";
  });
}

// ============================================================
// Buscar dados do servidor
// ============================================================
async function atualizar() {
  try {
    const resp = await fetch(API_URL);
    const json = await resp.json();
    atualizarUI(json);
  } catch (e) {
    console.log("Erro ao buscar dados:", e);
  }
}

atualizar();
setInterval(atualizar, UPDATE_INTERVAL);
