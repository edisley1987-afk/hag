// === dashboard.js ===
// Ajuste conforme sua API real
const API_URL = "/api/dashboard";

async function carregarDados() {
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    atualizarDashboard(data);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

function atualizarDashboard(data) {
  document.querySelectorAll(".card-reservatorio").forEach((card) => {
    const id = card.dataset.id;
    const info = data[id];
    if (!info) return;

    const nivel = info.percentual;
    const onda = card.querySelector(".onda");
    const texto = card.querySelector(".nivel-text");
    const alerta = card.querySelector(".alerta");

    texto.textContent = `${nivel}%`;

    // === Ajuste da onda conforme nível ===
    onda.style.height = `${nivel}%`;

    // === Cor da onda ===
    if (info.manutencao) {
      onda.style.background = "#777";
      card.classList.remove("alerta-critico");
      alerta.style.display = "none";
    } else if (nivel >= 80) {
      onda.style.background = "#0a89e8";
      card.classList.remove("alerta-critico");
      alerta.style.display = "none";
    } else if (nivel >= 40) {
      onda.style.background = "#14b86e";
      card.classList.remove("alerta-critico");
      alerta.style.display = "none";
    } else {
      // crítico
      onda.style.background = "#d9534f";
      card.classList.add("alerta-critico");
      alerta.style.display = "block";
    }
  });
}

// Atualização automática
setInterval(carregarDados, 5000);
carregarDados();
