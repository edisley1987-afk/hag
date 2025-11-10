// === dashboard.js ===
// Local: /public/dashboard.js

const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

// === Capacidades fixas ===
const CAPACIDADE = {
  Reservatorio_Elevador_current: 20000,
  Reservatorio_Osmose_current: 200,
  Reservatorio_CME_current: 1000,
  Agua_Abrandada_current: 9000,
};

// === Atualiza dashboard (sem recalcular litros!) ===
function atualizarDashboard(dados) {
  if (!dados) return;

  const campos = {
    Reservatorio_Elevador_current: ["elevadorValor", "elevadorPercent", "relogioElevador"],
    Reservatorio_Osmose_current: ["osmoseValor", "osmosePercent", "relogioOsmose"],
    Reservatorio_CME_current: ["cmeValor", "cmePercent", "relogioCME"],
    Agua_Abrandada_current: ["abrandadaValor", "abrandadaPercent", "relogioAbrandada"],
  };

  Object.entries(campos).forEach(([key, [valorID, percentID, canvasID]]) => {
    const litros = dados[key];
    if (litros === undefined) return;

    const capacidade = CAPACIDADE[key];
    const porcentagem = (litros / capacidade) * 100;

    // Atualiza card
    document.getElementById(valorID).textContent = `${litros} L`;
    document.getElementById(percentID).textContent = `${porcentagem.toFixed(1)}%`;

    // Atualiza gauge
    desenharGauge(
      document.getElementById(canvasID),
      porcentagem,
      "#1e88e5",
      key.replace("Reservatorio_", "").replace("_current", "")
    );
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
}

// === Gauge (mostrador de nível) ===
function desenharGauge(ctx, porcent, cor, nome) {
  if (!ctx) return;
  const existente = Chart.getChart(ctx);
  if (existente) existente.destroy();

  new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [porcent, 100 - porcent],
          backgroundColor: [cor, "#333"],
          cutout: "75%",
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false },
        title: { text: nome, display: true, color: "#fff" },
      },
    },
  });
}

// === Relógio ===
setInterval(() => {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString("pt-BR");
}, 1000);

// === Buscar dados ===
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    const dados = await res.json();
    atualizarDashboard(dados);
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
  }
}

setInterval(carregarDados, 5000);
carregarDados();

// === Histórico ===
function abrirHistorico(res) {
  window.location.href = "historico.html?res=" + res;
}
