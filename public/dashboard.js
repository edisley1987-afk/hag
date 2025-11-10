// === dashboard.js ===
// Local: /public/dashboard.js

const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

// === Configuração dos reservatórios ===
const CONFIG = {
  Reservatorio_Elevador_current: { capacidade: 20000, leituraVazio: 0.004168, leituraCheio: 0.008056 },
  Reservatorio_Osmose_current: { capacidade: 200, leituraVazio: 0.00505, leituraCheio: 0.006533 },
  Reservatorio_CME_current: { capacidade: 1000, leituraVazio: 0.004088, leituraCheio: 0.004408 },
  Agua_Abrandada_current: { capacidade: 9000, leituraVazio: 0.004008, leituraCheio: 0.004929 },
};

// === Função de cálculo ===
function calcularNivel(reservatorio, leitura) {
  const cfg =
    CONFIG[reservatorio] ||
    CONFIG[reservatorio.replace("_current", "")] ||
    CONFIG[reservatorio.replace("Reservatorio_", "")];

  if (!cfg) return { litros: 0, porcentagem: 0 };

  const perc = ((leitura - cfg.leituraVazio) / (cfg.leituraCheio - cfg.leituraVazio)) * 100;
  const porcentagem = Math.max(0, Math.min(100, perc));
  const litros = (cfg.capacidade * porcentagem) / 100;
  return { litros, porcentagem };
}

// === Atualização do dashboard ===
function atualizarDashboard(dados) {
  if (!dados) return;

  const campos = {
    Reservatorio_Elevador_current: ["elevadorValor", "elevadorPercent", "relogioElevador"],
    Reservatorio_Osmose_current: ["osmoseValor", "osmosePercent", "relogioOsmose"],
    Reservatorio_CME_current: ["cmeValor", "cmePercent", "relogioCME"],
    Agua_Abrandada_current: ["abrandadaValor", "abrandadaPercent", "relogioAbrandada"],
  };

  Object.keys(campos).forEach((res) => {
    const leitura = dados[res];
    if (leitura === undefined) return;

    const { litros, porcentagem } = calcularNivel(res, leitura);
    const [valorID, percentID, canvasID] = campos[res];

    document.getElementById(valorID).textContent = `${litros.toFixed(0)} L`;
    document.getElementById(percentID).textContent = `${porcentagem.toFixed(1)}%`;

    desenharGauge(document.getElementById(canvasID), porcentagem, "#1e88e5", res.replace("Reservatorio_", ""));
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
}

// === Desenhar gauge (gráfico de nível) ===
function desenharGauge(ctx, porcent, cor, nome) {
  if (!ctx) return;
  const chartExistente = Chart.getChart(ctx);
  if (chartExistente) chartExistente.destroy();

  new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [porcent, 100 - porcent],
          backgroundColor: [cor, "#2c2c2c"],
          cutout: "75%",
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false },
        title: {
          display: true,
          text: nome.replace("_current", ""),
          color: "#fff",
          font: { size: 12 },
        },
      },
    },
  });
}

// === Relógio ===
function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("clock").textContent = agora.toLocaleTimeString("pt-BR");
}
setInterval(atualizarRelogio, 1000);

// === Buscar dados do servidor ===
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    atualizarDashboard(dados);
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
  }
}
setInterval(carregarDados, 5000);
carregarDados();

// === Abrir histórico ===
function abrirHistorico(reservatorio) {
  window.location.href = `historico.html?res=${encodeURIComponent(reservatorio)}`;
}
