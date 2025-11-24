// === dashboard.js ===
const API_URL = "/api/dashboard";

let ultimoTimestamp = null;
let alertaTimeoutAtivo = false;

// ===============================
//    FUNÇÃO PRINCIPAL DO FETCH
// ===============================
async function carregarDados() {
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    if (data.lastUpdate) {
      ultimoTimestamp = Date.now();
      alertaTimeoutAtivo = false;
    }

    criarCardsSeNecessario(data);
    atualizarDashboard(data);
    atualizarTimestamp(data.lastUpdate);

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

// ===============================
//   CRIA CARDS AUTOMATICAMENTE
// ===============================
function criarCardsSeNecessario(data) {
  const container = document.getElementById("reservatoriosContainer");

  container.innerHTML = ""; // limpa e recria

  data.reservatorios.forEach((res) => {
    const card = document.createElement("div");
    card.className = "card-reservatorio";
    card.dataset.setor = res.setor;

    card.innerHTML = `
      <div class="onda"></div>

      <div class="conteudo">
        <h3>${res.setor.replace(/_/g, " ")}</h3>
        <div class="nivel-text">--%</div>

        <div class="alerta" style="display:none">
          ⚠ Nível crítico
        </div>

        <div class="alerta-atraso" style="display:none">
          ⚠ Sem atualização há mais de 10 minutos
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ===============================
//   ATUALIZA OS CARDS
// ===============================
function atualizarDashboard(data) {
  document.querySelectorAll(".card-reservatorio").forEach((card) => {
    const setor = card.dataset.setor;
    const info = data.reservatorios.find(r => r.setor === setor);
    if (!info) return;

    const nivel = info.percent;

    const onda = card.querySelector(".onda");
    const texto = card.querySelector(".nivel-text");
    const alerta = card.querySelector(".alerta");
    const atraso = card.querySelector(".alerta-atraso");

    texto.textContent = `${nivel}%`;
    onda.style.height = `${nivel}%`;

    if (info.manutencao) {
      onda.style.background = "#777";
      alerta.style.display = "none";
      card.classList.remove("alerta-critico");
    }
    else if (nivel >= 80) {
      onda.style.background = "#0a89e8";
      alerta.style.display = "none";
      card.classList.remove("alerta-critico");
    }
    else if (nivel >= 40) {
      onda.style.background = "#14b86e";
      alerta.style.display = "none";
      card.classList.remove("alerta-critico");
    }
    else {
      onda.style.background = "#d9534f";
      alerta.style.display = "block";
      card.classList.add("alerta-critico");
    }

    // FALTA DE ATUALIZAÇÃO
    atraso.style.display = alertaTimeoutAtivo ? "block" : "none";
  });
}

// ===============================
//     ATUALIZA TIMER NA TELA
// ===============================
function atualizarTimestamp(ms) {
  const el = document.getElementById("lastUpdate");
  if (!ms) {
    el.textContent = "Última atualização: --";
    return;
  }

  const dt = new Date(ms);
  el.textContent = "Última atualização: " + dt.toLocaleTimeString("pt-BR");
}

// ===============================
//   CONTADOR DE ATRASO > 10s
// ===============================
setInterval(() => {
  if (!ultimoTimestamp) return;
  if (Date.now() - ultimoTimestamp >= 10000 && !alertaTimeoutAtivo) {
    alertaTimeoutAtivo = true;
  }
}, 1000);

// ===============================
//   ATUALIZA A CADA 5s
// ===============================
setInterval(carregarDados, 5000);
carregarDados();
