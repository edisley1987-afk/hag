// ===============================
// 🔗 APIs
// ===============================
const API_HIST = "/historico";
const API_CONSUMO = "/consumo/5dias";

const select = document.getElementById("reservatorioSelect");
let grafico = null;

// ===============================
// 🔧 AGRUPAMENTO MÉDIA 10 MIN
// ===============================
function agruparPorMinutos(dados, minutos = 10) {
  const intervalo = minutos * 60 * 1000;
  const mapa = new Map();

  dados.forEach(d => {
    const ts = new Date(d.timestamp).getTime();
    const chave = Math.floor(ts / intervalo) * intervalo;

    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(d.valor);
  });

  return Array.from(mapa.entries()).map(([ts, valores]) => ({
    x: new Date(ts),
    y: valores.reduce((a, b) => a + b, 0) / valores.length
  }));
}

// ===============================
// 📊 CARREGAR GRÁFICO LIMPO
// ===============================
async function carregarGrafico() {
  try {
    const reservatorio = select.value;
    const resp = await fetch(API_HIST);
    const dados = await resp.json();

    const filtrado = dados
      .filter(d => d.reservatorio === reservatorio)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const dadosAgrupados = agruparPorMinutos(filtrado, 10);

    const ctx = document.getElementById("graficoHistorico").getContext("2d");
    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [{
          label: `Nível – ${reservatorio}`,
          data: dadosAgrupados,
          borderColor: "#007b83",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { font: { size: 14 } } },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "x"
            },
            pan: { enabled: true, mode: "x" }
          }
        },
        scales: {
          x: {
            type: "time",
            time: { unit: "hour", tooltipFormat: "dd/MM HH:mm" },
            ticks: { autoSkip: true, maxTicksLimit: 12 }
          },
          y: { beginAtZero: true }
        }
      }
    });

  } catch (err) {
    console.error("Erro no gráfico:", err);
  }
}

// ===============================
// 📅 CONSUMO DIÁRIO
// ===============================
async function carregarConsumo() {
  const reservatorio = select.value;
  const RES_CONSUMO = ["elevador", "osmose", "lavanderia"];

  if (!RES_CONSUMO.includes(reservatorio)) {
    document.getElementById("tabelaConsumo").innerHTML =
      "<tr><td colspan='3'>Consumo disponível apenas para Elevador, Osmose e Lavanderia</td></tr>";
    return;
  }

  try {
    const endpoint = `${API_CONSUMO}/${reservatorio}`;
    const resp = await fetch(endpoint);
    const dados = await resp.json();

    const tabela = document.getElementById("tabelaConsumo");
    tabela.innerHTML = "";

    dados.forEach(item => {
      let consumo = Math.abs(item.consumo);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.dia}</td>
        <td>${reservatorio}</td>
        <td>${consumo}</td>`;
      tabela.appendChild(tr);
    });

  } catch (err) {
    console.error("Erro consumo:", err);
  }
}

// ===============================
// EVENTOS
// ===============================
select.addEventListener("change", () => {
  carregarGrafico();
  carregarConsumo();
});

carregarGrafico();
carregarConsumo();
