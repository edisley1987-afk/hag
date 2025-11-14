// === CONFIGURAÇÃO DOS RESERVATÓRIOS ===
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Abrandada_current: { nome: "Reservatório Abrandada", capacidade: 9000 }
};

async function carregarHistorico() {
  const resposta = await fetch("/historico");
  const dados = await resposta.json();

  const tabela = document.getElementById("tabelaHistorico");
  tabela.innerHTML = `
    <tr>
      <th>Data</th>
      <th>Reservatório</th>
      <th>Litros</th>
      <th>Percentual (%)</th>
    </tr>
  `;

  let labelsGrafico = [];
  let valoresGrafico = [];
  let percentuaisGrafico = [];

  for (const item of dados) {
    const config = RESERVATORIOS[item.nomeReservatorio];
    if (!config) continue;

    const percentual = ((item.valor / config.capacidade) * 100).toFixed(1);

    tabela.innerHTML += `
      <tr>
        <td>${item.data}</td>
        <td>${config.nome}</td>
        <td>${item.valor} L</td>
        <td>${percentual}%</td>
      </tr>
    `;

    // Dados para o gráfico
    labelsGrafico.push(item.data + " - " + config.nome);
    valoresGrafico.push(item.valor);
    percentuaisGrafico.push(percentual);
  }

  atualizarGrafico(labelsGrafico, valoresGrafico, percentuaisGrafico);
}

// === GRÁFICO ===
let grafico;

function atualizarGrafico(labels, valores, percentuais) {
  const ctx = document.getElementById("graficoHistorico").getContext("2d");

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Litros",
          data: valores,
          borderWidth: 1
        },
        {
          label: "Percentual (%)",
          data: percentuais,
          type: "line",
          borderWidth: 2,
          yAxisID: "percent"
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Litros" }
        },
        percent: {
          beginAtZero: true,
          max: 100,
          position: "right",
          title: { display: true, text: "%" }
        }
      }
    }
  });
}

carregarHistorico();
