// ======= histórico.js =======

// Capacidade de cada reservatório (em litros)
const CAPACIDADE = {
  elevador: 20000,
  osmose: 200,
  lavanderia: 5000,
};

// Referências para os gráficos
let graficoHistorico = null;
let graficoConsumo = null;

// ============================
// Função para carregar histórico
// ============================
async function carregarHistorico() {
  try {
    const resp = await fetch("/historico");
    const historico = await resp.json();

    if (!historico || historico.length === 0) return;

    montarTabela(historico);
    montarGraficoHistorico(historico);
    montarGraficoConsumo(historico);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

// ============================
// Monta tabela com todos os reservatórios
// ============================
function montarTabela(historico) {
  const tabela = document.getElementById("tabelaHistorico");
  tabela.innerHTML = "";

  // Cabeçalho
  const cabecalho = document.createElement("tr");
  cabecalho.innerHTML = `
    <th>Data/Hora</th>
    <th>Elevador (L)</th>
    <th>Osmose (L)</th>
    <th>Lavanderia (L)</th>
  `;
  tabela.appendChild(cabecalho);

  historico.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(item.time).toLocaleString()}</td>
      <td>${item.elevador}</td>
      <td>${item.osmose}</td>
      <td>${item.lavanderia}</td>
    `;
    tabela.appendChild(tr);
  });
}

// ============================
// Monta gráfico de histórico (linhas)
// ============================
function montarGraficoHistorico(historico) {
  const labels = historico.map(h => new Date(h.time).toLocaleString());
  const data = {
    labels,
    datasets: [
      {
        label: "Elevador",
        data: historico.map(h => h.elevador),
        borderColor: "blue",
        fill: false,
      },
      {
        label: "Osmose",
        data: historico.map(h => h.osmose),
        borderColor: "green",
        fill: false,
      },
      {
        label: "Lavanderia",
        data: historico.map(h => h.lavanderia),
        borderColor: "orange",
        fill: false,
      },
    ],
  };

  const config = {
    type: "line",
    data,
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } },
    },
  };

  if (graficoHistorico) graficoHistorico.destroy();
  graficoHistorico = new Chart(
    document.getElementById("graficoHistorico"),
    config
  );
}

// ============================
// Monta gráfico de consumo diário (barras)
// ============================
function montarGraficoConsumo(historico) {
  // Pegando os últimos 5 dias
  const ultimos5 = historico.slice(-6); // precisa de 6 pontos para calcular diferença de 5 dias

  const labels = ultimos5.slice(1).map(h => new Date(h.time).toLocaleDateString());
  const consumoElevador = [];
  const consumoOsmose = [];
  const consumoLavanderia = [];

  for (let i = 1; i < ultimos5.length; i++) {
    consumoElevador.push(ultimos5[i-1].elevador - ultimos5[i].elevador);
    consumoOsmose.push(ultimos5[i-1].osmose - ultimos5[i].osmose);
    consumoLavanderia.push(ultimos5[i-1].lavanderia - ultimos5[i].lavanderia);
  }

  const data = {
    labels,
    datasets: [
      { label: "Elevador", data: consumoElevador, backgroundColor: "blue" },
      { label: "Osmose", data: consumoOsmose, backgroundColor: "green" },
      { label: "Lavanderia", data: consumoLavanderia, backgroundColor: "orange" },
    ],
  };

  const config = {
    type: "bar",
    data,
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } },
    },
  };

  if (graficoConsumo) graficoConsumo.destroy();
  graficoConsumo = new Chart(
    document.getElementById("graficoConsumo"),
    config
  );
}

// ============================
// Inicialização
// ============================
document.addEventListener("DOMContentLoaded", carregarHistorico);
