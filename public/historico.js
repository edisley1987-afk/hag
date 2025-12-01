// ===============================
// 🔗 APIs
// ===============================
const API_HIST = "/historico";
const API_CONSUMO = "/consumo/5dias";

const select = document.getElementById("reservatorioSelect");
let grafico = null;

// ===============================
// 📊 CARREGAR GRÁFICO
// ===============================
async function carregarGrafico() {
  try {
    const reservatorio = select.value;

    const resp = await fetch(API_HIST);

    if (!resp.ok) {
      console.error("Erro ao acessar /historico:", resp.status);
      return;
    }

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
          legend: { labels: { font: { size: 16 } } },
          tooltip: {
            backgroundColor: "#004d50",
            titleColor: "#fff",
            bodyColor: "#fff",
          }
        },
        scales: {
          x: { ticks: { font: { size: 12 } }, grid: { color: "rgba(0,0,0,0.05)" } },
          y: { ticks: { font: { size: 14 } }, grid: { color: "rgba(0,0,0,0.05)" } }
        }
      }
    });

  } catch (err) {
    console.error("Erro no gráfico:", err);
  }
}

// ===============================
// 📅 CONSUMO DIÁRIO (ELEVADOR / OSMOSE / LAVANDERIA)
// ===============================
async function carregarConsumo() {
  const reservatorio = select.value;

  // Reservatórios que têm consumo diário
  const RES_CONSUMO = ["elevador", "osmose", "lavanderia"];

  if (!RES_CONSUMO.includes(reservatorio)) {
    document.getElementById("tabelaConsumo").innerHTML =
      "<tr><td colspan='3'>Consumo disponível apenas para Elevador, Osmose e Lavanderia</td></tr>";
    return;
  }

  try {
    const endpoint = `${API_CONSUMO}/${reservatorio}`;
    const resp = await fetch(endpoint);

    if (!resp.ok) {
      console.error("Erro ao acessar:", endpoint, "status:", resp.status);

      document.getElementById("tabelaConsumo").innerHTML =
        `<tr><td colspan="3">Erro: servidor retornou ${resp.status}</td></tr>`;
      return;
    }

    const dados = await resp.json();

    const tabela = document.getElementById("tabelaConsumo");
    tabela.innerHTML = "";

    dados.forEach(item => {
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
    document.getElementById("tabelaConsumo").innerHTML =
      `<tr><td colspan="3">Erro ao carregar consumo</td></tr>`;
  }
}

// ===============================
// EVENTOS
// ===============================
select.addEventListener("change", () => {
  carregarGrafico();
  carregarConsumo();
});

// ===============================
// CARREGAR AO INICIAR
// ===============================
carregarGrafico();
carregarConsumo();
