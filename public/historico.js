const API_HIST = "/historico";
const API_CONSUMO = "/consumo/5dias";

const select = document.getElementById("reservatorioSelect");
let grafico = null;

// ===============================
// 📊 CARREGAR GRÁFICO MELHORADO
// ===============================
async function carregarGrafico() {
  try {
    const reservatorio = select.value;

    const resp = await fetch(API_HIST);
    const dados = await resp.json();

    const filtrado = dados
      .filter(d => d.reservatorio === reservatorio)
      .sort((a, b) => a.timestamp - b.timestamp);

    const labels = filtrado.map(p =>
      new Date(p.timestamp).toLocaleString("pt-BR")
    );

    const valores = filtrado.map(p => p.valor);

    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `Nível – ${reservatorio}`,
          data: valores,
          borderWidth: 4,
          borderColor: "#007b83",
          backgroundColor: "rgba(0,123,131,0.12)",
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { font: { size: 16 } }
          },
          tooltip: {
            backgroundColor: "#004d50",
            titleColor: "#fff",
            bodyColor: "#fff",
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 12 }},
            grid: { color: "rgba(0,0,0,0.05)" }
          },
          y: {
            ticks: { font: { size: 14 }},
            grid: { color: "rgba(0,0,0,0.05)" }
          }
        }
      }
    });

  } catch (err) {
    console.error("Erro no gráfico:", err);
  }
}

// ===============================
// 📅 CONSUMO DIÁRIO (Corrigido)
// ===============================
async function carregarConsumo() {
  const reservatorio = select.value;

  if (!["elevador", "osmose"].includes(reservatorio)) {
    document.getElementById("tabelaConsumo").innerHTML =
      "<tr><td colspan='3'>Consumo disponível apenas para Elevador e Osmose</td></tr>";
    return;
  }

  try {
    const resp = await fetch(`${API_CONSUMO}/${reservatorio}`);
    const dados = await resp.json();

    const tabela = document.getElementById("tabelaConsumo");
    tabela.innerHTML = "";

    dados.forEach(item => {
      // corrige consumo negativo
      let consumoCorrigido = item.consumo;
      if (consumoCorrigido < 0) consumoCorrigido = Math.abs(consumoCorrigido);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.dia}</td>
        <td>${reservatorio}</td>
        <td>${consumoCorrigido}</td>
      `;
      tabela.appendChild(tr);
    });

  } catch (err) {
    console.error("Erro no consumo:", err);
  }
}

select.addEventListener("change", () => {
  carregarGrafico();
  carregarConsumo();
});

carregarGrafico();
carregarConsumo();
