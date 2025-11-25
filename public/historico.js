// === CONFIG ===
const API_HIST = "/historico";
const API_CONSUMO = "/consumo/5dias";

const select = document.getElementById("reservatorioSelect");
let grafico = null;

// ============================================================
// 📊 CARREGAR GRÁFICO DO HISTÓRICO
// ============================================================
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
        datasets: [
          {
            label: `Nível – ${reservatorio}`,
            data: valores,
            borderWidth: 3,
            borderColor: "#008b9a",
            backgroundColor: "rgba(0,139,154,0.25)",
            tension: 0.35,
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false
          }
        }
      }
    });

  } catch (err) {
    console.error("Erro no gráfico:", err);
  }
}

// ============================================================
// 📅 CONSUMO DIÁRIO (APENAS Elevador / Osmose)
// ============================================================
async function carregarConsumo() {
  const reservatorio = select.value;

  const tabela = document.getElementById("tabelaConsumo");
  tabela.innerHTML = "";

  if (!["elevador", "osmose"].includes(reservatorio)) {
    tabela.innerHTML =
      "<tr><td colspan='3'>Consumo disponível apenas para Elevador e Osmose</td></tr>";
    return;
  }

  try {
    const resp = await fetch(`${API_CONSUMO}/${reservatorio}`);
    const dados = await resp.json();

    tabela.innerHTML = "";

    dados.forEach(item => {
      const dia = item.dia ?? "---";
      const consumo = item.consumo ?? 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${dia}</td>
        <td>${reservatorio}</td>
        <td>${consumo}</td>
      `;
      tabela.appendChild(tr);
    });

  } catch (err) {
    console.error("Erro no consumo:", err);
  }
}

// =============================================
select.addEventListener("change", () => {
  carregarGrafico();
  carregarConsumo();
});

// Inicialização
carregarGrafico();
carregarConsumo();
