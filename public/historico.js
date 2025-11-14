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

    // Seleciona o primeiro reservatório válido
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
  selectReservatorio.innerHTML = "";

  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = "Selecione um reservatório...";
  selectReservatorio.appendChild(optDefault);

  const nomes = new Set();

  historico.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key.includes("_current") && typeof item[key] === "number") {
        nomes.add(key);
      }
    });
  });

  nomes.forEach(ref => {
    const option = document.createElement("option");
    option.value = ref;
    option.textContent = ref.replace("_current", "").replace(/_/g, " ");
    selectReservatorio.appendChild(option);
  });
}

// =========================
//  ATUALIZAR GRÁFICO + TABELA
// =========================

function atualizarGrafico(historico, ref) {
  if (!ref) return;

  const labels = historico.map(item =>
    new Date(item.timestamp).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
  );

  const valores = historico.map(item => item[ref] ?? 0);

  // ===== ATUALIZAR TABELA =====
  const corpo = document.querySelector("#tabelaHistorico tbody");
  corpo.innerHTML = "";

  historico.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${new Date(item.timestamp).toLocaleString("pt-BR")}</td>
      <td>${item[ref] ?? 0}</td>
    `;

    corpo.appendChild(tr);
  });

  // ===== GRÁFICO =====
  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: ref.replace("_current", "").replace(/_/g, " "),
          data: valores,
          borderColor: "rgba(0, 123, 255, 1)",
          backgroundColor: "rgba(0, 123, 255, 0.2)",
          pointBackgroundColor: "rgba(0, 123, 255, 0.8)",
          pointBorderColor: "rgba(0, 123, 255, 1)",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
        x: {}
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
