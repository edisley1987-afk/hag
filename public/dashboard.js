const API_URL = "http://localhost:3000/dados"; // altere conforme o servidor real

// Configuração dos reservatórios
const CONFIG = {
  Reservatorio_elevador: { capacidade: 20000, leituraVazio: 0.004168, leituraCheio: 0.008056 },
  Reservatorio_Osmose: { capacidade: 200, leituraVazio: 0.00505, leituraCheio: 0.006533 },
  Reservatorio_CME: { capacidade: 1000, leituraVazio: 0.004088, leituraCheio: 0.004408 },
  Reservatorio_Abrandada: { capacidade: 9000, leituraVazio: 0.004008, leituraCheio: 0.004929 },
};

// Histórico diário de níveis
const historico = {};

function calcularNivel(reservatorio, leitura) {
  const cfg = CONFIG[reservatorio];
  const perc = ((leitura - cfg.leituraVazio) / (cfg.leituraCheio - cfg.leituraVazio)) * 100;
  const porcentagem = Math.max(0, Math.min(100, perc));
  const litros = (cfg.capacidade * porcentagem) / 100;
  return { litros, porcentagem };
}

function atualizarDashboard(dados) {
  if (!dados) return;

  const campos = {
    Reservatorio_elevador: ["elevadorValor", "elevadorPercent", "relogioElevador"],
    Reservatorio_Osmose: ["osmoseValor", "osmosePercent", "relogioOsmose"],
    Reservatorio_CME: ["cmeValor", "cmePercent", "relogioCME"],
    Reservatorio_Abrandada: ["abrandadaValor", "abrandadaPercent", "relogioAbrandada"],
  };

  Object.keys(campos).forEach((res) => {
    const leitura = dados[res];
    if (!leitura) return;

    const { litros, porcentagem } = calcularNivel(res, leitura);
    const [valorID, percentID, canvasID] = campos[res];

    document.getElementById(valorID).textContent = `${litros.toFixed(0)} L`;
    document.getElementById(percentID).textContent = `${porcentagem.toFixed(1)}%`;

    atualizarHistorico(res, porcentagem);
    desenharGauge(document.getElementById(canvasID), porcentagem, "#1e88e5", res.replace("Reservatorio_", ""));
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
}

// Função de histórico (salva níveis + hora)
function atualizarHistorico(res, nivel) {
  const agora = new Date().toLocaleTimeString("pt-BR");
  if (!historico[res]) historico[res] = [];
  historico[res].push({ hora: agora, nivel });
  if (historico[res].length > 50) historico[res].shift(); // mantém só os últimos
}

// Exibir modal com histórico
function abrirModal(res) {
  const modal = document.getElementById("historicoModal");
  const tbody = document.querySelector("#tabelaHistorico tbody");
  const titulo = document.getElementById("modalTitulo");

  titulo.textContent = res.replace("Reservatorio_", "Histórico — ");
  tbody.innerHTML = "";

  if (!historico[res] || historico[res].length === 0) {
    tbody.innerHTML = `<tr><td colspan="2">Sem dados disponíveis.</td></tr>`;
  } else {
    historico[res].forEach((item) => {
      const row = `<tr><td>${item.hora}</td><td>${item.nivel.toFixed(1)}%</td></tr>`;
      tbody.insertAdjacentHTML("beforeend", row);
    });
  }

  modal.style.display = "flex";
}

// Fechar modal
function fecharModal() {
  document.getElementById("historicoModal").style.display = "none";
}

// Gauges (relógios)
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
          backgroundColor: [cor, "#333"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false },
        title: {
          display: true,
          text: nome,
          color: "#fff",
          font: { size: 12 },
        },
      },
    },
  });
}

// Atualizar relógio digital
function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("clock").textContent = agora.toLocaleTimeString("pt-BR");
}
setInterval(atualizarRelogio, 1000);

// Atualização automática dos dados
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
