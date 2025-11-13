// === historico.js ===

const params = new URLSearchParams(window.location.search);
const reservatorioId = params.get("res");
const API_HIST = window.location.origin + `/historico/${reservatorioId}`;

document.title = "Histórico — " + reservatorioId;

async function carregarHistorico() {
  try {
    const res = await fetch(API_HIST);
    if (!res.ok) throw new Error("Erro ao carregar histórico");
    const dados = await res.json();

    const ctx = document.getElementById("grafico").getContext("2d");
    const labels = dados.map(d => new Date(d.hora).toLocaleTimeString());
    const valores = dados.map(d => d.nivelPercentual);

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Nível (%)",
          data: valores,
          fill: true,
          tension: 0.3
        }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });
  } catch (err) {
    console.error(err);
  }
}

carregarHistorico();
