// =========================
//  HISTÓRICO — HAG
// =========================

const API_URL = window.location.origin;

// Elementos do DOM
const selectReservatorio = document.getElementById("selectReservatorio");
const botaoConsumo = document.getElementById("botaoConsumo");
const ctx = document.getElementById("graficoHistorico");

// Evento para abrir consumo diário
botaoConsumo.onclick = () => window.location.href = "consumo.html";

let grafico = null;

// =========================
//  CARREGAR HISTÓRICO
// =========================

async function carregarHistorico() {
  try {
    const resp = await fetch(`${API_URL}/historico`);
    const historico = await resp.json();

    if (!Array.isArray(historico) || historico.length === 0) {
      alert("Nenhum dado de histórico encontrado.");
      return;
    }

    atualizarReservatorioSelect(historico);

    // Seleciona automaticamente o primeiro reservatório disponível
    if (!selectReservatorio.value) {
      selectReservatorio.selectedIndex = 1;
    }

    atualizarGrafico(historico, selectReservatorio.value);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

// =========================
//  POPULAR SELECT
// =========================

function atualizarReservatorioSelect(historico) {
  if (!selectReservatorio) return;

  selectReservatorio.innerHTML = "";
  const opcaoPadrao = document.createElement("option");
  opcaoPadrao.value = "";
  opcaoPadrao.textContent = "Selecione um reservatório...";
  selectReservatorio.appendChild(opcaoPadrao);

  const opcoes = new Set();

  historico.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key.includes("_current") && typeof item[key] === "number") {
        opcoes.add(key);
      }
    });
  });

  opcoes.forEach(ref => {
    const option = document.createElement("option");
    option.value = ref;
    option.textContent = ref.replace("_current", "").replace(/_/g, " ");
    selectReservatorio.appendChild(option);
  });
}

// =========================
//  ATUALIZAR GRÁFICO
// =========================

function atualizarGrafico(historico, ref) {
  if (!ref) return;

  const labels = historico.map(item =>
    new Date(item.timestamp).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    })
  );

  const valores = historico.map(item => item[ref] ?? 0);

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: ref.replace("_current", "").replace(/_/g, " "),
        data: valores,
        borderWidth: 2,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// =========================
//  EVENTOS
// =========================

selectReservatorio.addEventListener("change", () => {
  carregarHistorico();
});

// =========================
//  INICIAR
// =========================

carregarHistorico();
