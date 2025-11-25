const API_HIST = "/historico";
const API_CONSUMO = "/consumo/5dias";

const select = document.getElementById("reservatorioSelect");
let grafico = null;

// =====================================
// 📊 CARREGAR GRÁFICO DO HISTÓRICO
// =====================================
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
          borderWidth: 2,
          borderColor: "#007b83",
          backgroundColor: "rgba(0,123,131,0.25)",
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,   //  ⬅⬅⬅ AQUI FAZ O GRÁFICO FICAR GRANDE
        scales: {
          y: { beginAtZero: false }
        },
        plugins: {
          legend: { labels: { font: { size: 14 } } }
        }
      }
    });
  } catch (err) {
    console.error("Erro no gráfico:", err);
  }
}

// =====================================
// 📅 CONSUMO DIÁRIO (APENAS Elevador / Osmose)
// =====================================

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
      let consumo = item.consumo;

      // 🔥 Se der negativo, corrige automaticamente
      if (consumo < 0) consumo = 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.dia}</td>
        <td>${reservatorio}</td>
        <td>${consumo}</td>
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

// Inicialização
carregarGrafico();
carregarConsumo();
