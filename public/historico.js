const API_HIST = "/historico";
const API_CONSUMO = "/consumo/5dias";

const select = document.getElementById("reservatorioSelect");
let grafico = null;

// =========================
// 📌 CARREGAR GRÁFICO
// =========================
async function carregarGrafico() {
  try {
    const reservatorio = select.value;

    const resp = await fetch(API_HIST);
    const dados = await resp.json();

    const filtrado = dados
      .filter(d => d.reservatorio === reservatorio)
      .sort((a, b) => a.timestamp - b.timestamp);

    const labels = filtrado.map(p => new Date(p.timestamp).toLocaleString("pt-BR"));
    const valores = filtrado.map(p => p.valor);

    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Nível (litros)",
          data: valores,
          borderWidth: 2,
          borderColor: "blue",
          backgroundColor: "rgba(0,0,255,0.2)",
          tension: 0.2
        }]
      },
      options: {
        responsive: true
      }
    });

  } catch (err) {
    console.error("Erro gráfico:", err);
  }
}

// ===============================
// 📌 TABELA DE CONSUMO DIÁRIO
// ===============================
async function carregarConsumo() {
  try {
    const reservatorio = select.value;

    const resp = await fetch(`${API_CONSUMO}/${reservatorio}`);
    const dados = await resp.json();

    const tabela = document.getElementById("tabelaConsumo");
    tabela.innerHTML = "";

    dados.forEach(item => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${item.dia}</td>
        <td>${reservatorio}</td>
        <td>${item.consumo}</td>
      `;

      tabela.appendChild(tr);
    });

  } catch (err) {
    console.error("Erro consumo:", err);
  }
}

// ===========================
// Evento ao trocar reservatório
// ===========================
select.addEventListener("change", () => {
  carregarGrafico();
  carregarConsumo();
});

// Inicialização
carregarGrafico();
carregarConsumo();
