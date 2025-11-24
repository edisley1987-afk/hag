// === dashboard.js ===
const API_URL = "/api/dashboard";

// Armazena o último timestamp recebido
let ultimoTimestamp = null;

// Controla se já estamos em alerta por falta de atualização
let alertaTimeoutAtivo = false;

// ===============================
//    FUNÇÃO PRINCIPAL DO FETCH
// ===============================
async function carregarDados() {
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    // Salva timestamp caso exista
    if (data.lastUpdate) {
      ultimoTimestamp = Date.now();
      alertaTimeoutAtivo = false;
    }

    atualizarDashboard(data);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

// ===============================
//   ATUALIZA OS CARDS NA TELA
// ===============================
function atualizarDashboard(data) {
  document.querySelectorAll(".card-reservatorio").forEach((card) => {
    const setor = card.dataset.setor;
    const info = data.reservatorios.find(r => r.setor === setor);
    if (!info) return;

    // Elementos do card
    const nivel = info.percent;
    const onda = card.querySelector(".onda");
    const texto = card.querySelector(".nivel-text");
    const alerta = card.querySelector(".alerta");
    const msgAtraso = card.querySelector(".alerta-atraso");

    // Mantém última leitura fixa
    texto.textContent = `${nivel}%`;
    onda.style.height = `${nivel}%`;

    // ==============================
    //     CORES DA ONDA
    // ==============================
    if (info.manutencao) {
      onda.style.background = "#777";
      alerta.style.display = "none";
      card.classList.remove("alerta-critico");
    } else if (nivel >= 80) {
      onda.style.background = "#0a89e8";
      alerta.style.display = "none";
      card.classList.remove("alerta-critico");
    } else if (nivel >= 40) {
      onda.style.background = "#14b86e";
      alerta.style.display = "none";
      card.classList.remove("alerta-critico");
    } else {
      // nível crítico
      onda.style.background = "#d9534f";
      alerta.style.display = "block";
      card.classList.add("alerta-critico");
    }

    // ==============================
    //  ALERTA DE FALTA DE ATUALIZAÇÃO
    // ==============================
    if (alertaTimeoutAtivo) {
      msgAtraso.style.display = "block";
    } else {
      msgAtraso.style.display = "none";
    }
  });
}

// ===============================
//  VERIFICA SE HÁ ATRASO > 10s
// ===============================
setInterval(() => {
  if (!ultimoTimestamp) return;

  const agora = Date.now();
  const diff = agora - ultimoTimestamp;

  if (diff >= 10000 && !alertaTimeoutAtivo) {
    alertaTimeoutAtivo = true;
    console.warn("⚠ Sem atualização há mais de 10 segundos.");
  }
}, 1000);

// ===============================
//    ATUALIZA A CADA 5s
// ===============================
setInterval(carregarDados, 5000);
carregarDados();
