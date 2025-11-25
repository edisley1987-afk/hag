// =======================
// CONFIGURAÇÕES
// =======================
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// Capacidade dos reservatórios
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Elevador", capacidade: 20000 },
  Reservatorio_CME_current: { nome: "CME", capacidade: 5000 },
  Reservatorio_Osmose_current: { nome: "Osmose", capacidade: 200 }
};

// Apenas 3 sensores de pressão
const PRESSOES = {
  Pressao_Saida_CME_current: "Pressão Saída CME",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose"
};

// Manutenção local
let manut = JSON.parse(localStorage.getItem("manutencao")) || {};

function salvarManutencao() {
  localStorage.setItem("manutencao", JSON.stringify(manut));
}

// =======================
// FUNÇÃO PRINCIPAL
// =======================
async function atualizar() {
  try {
    const resp = await fetch(API_URL);
    const dados = await resp.json();

    document.getElementById("lastUpdate").innerText =
      "Última atualização: " + new Date().toLocaleTimeString();

    atualizarReservatorios(dados);
    atualizarPressoes(dados);

  } catch (e) {
    console.warn("Falha ao atualizar:", e);
  }
}

setInterval(atualizar, UPDATE_INTERVAL);
atualizar();

// =======================
// RESERVATÓRIOS
// =======================
function atualizarReservatorios(d) {
  const container = document.getElementById("reservatoriosContainer");
  container.innerHTML = "";

  for (const ref in RESERVATORIOS) {
    const cfg = RESERVATORIOS[ref];
    const litros = d[ref] ?? null;

    const perc = litros !== null
      ? Math.min(100, Math.max(0, (litros / cfg.capacidade) * 100))
      : null;

    const alerta = perc !== null && perc <= 30;
    const isManut = manut[ref] === true;

    // COR DO CARD
    let cor = "normal";
    if (alerta) cor = "alerta";
    if (isManut) cor = "manutencao";

    // AFECTIONS
    const alertaMsg =
      alerta && !isManut ? `<div class="alerta-msg">⚠ Nível abaixo de 30%</div>` : "";

    const litrosTxt = litros === null ? "N/D" : `${litros} L`;
    const percTxt = perc === null ? "--%" : `${perc.toFixed(0)}%`;

    // HTML
    const card = document.createElement("div");
    card.className = `card-res ${cor}`;
    card.innerHTML = `
      <h3>${cfg.nome}</h3>
      <div class="valores">${litrosTxt} — ${percTxt}</div>

      <div class="nivel-barra">
        <div class="nivel-preenchido" style="height:${perc || 0}%;"></div>
      </div>

      ${alertaMsg}

      <button class="btn-manut" data-ref="${ref}">
        ${isManut ? "Em Manutenção" : "Marcar Manutenção"}
      </button>
    `;

    container.appendChild(card);

    // LÓGICA DE AUTO-DESATIVAR MANUTENÇÃO
    if (isManut && perc > 31) {
      manut[ref] = false;
      salvarManutencao();
    }
  }

  // EVENTO DOS BOTÕES
  document.querySelectorAll(".btn-manut").forEach(btn => {
    btn.onclick = () => {
      const ref = btn.getAttribute("data-ref");
      manut[ref] = !manut[ref];
      salvarManutencao();
      atualizar(); // redesenhar
    };
  });
}

// =======================
// PRESSÕES
// =======================
function atualizarPressoes(d) {
  const container = document.getElementById("pressoesContainer");
  container.innerHTML = "";

  for (const ref in PRESSOES) {
    const nome = PRESSOES[ref];
    const val = d[ref];

    const valorTxt = val == null ? "N/D" : val.toFixed(2) + " bar";

    const card = document.createElement("div");
    card.className = "card-pres";
    card.innerHTML = `
      <h3>${nome}</h3>
      <div class="valor-pressao">${valorTxt}</div>
    `;

    container.appendChild(card);
  }
}
