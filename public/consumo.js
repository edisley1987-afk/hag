// consumo.js - busca dados reais do servidor

const ctx = document.getElementById('graficoConsumo').getContext('2d');

// Função para buscar dados da API
async function buscarConsumo() {
  try {
    const resp = await fetch('/api/consumo?dias=5');
    const dados = await resp.json();

    return {
      labels: dados.dias.map(d => d),
      datasets: [
        {
          label: 'Elevador (L)',
          data: dados.elevador,
          borderColor: '#2c8b7d',
          backgroundColor: 'rgba(44, 139, 125, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Osmose (L)',
          data: dados.osmose,
          borderColor: '#256f64',
          backgroundColor: 'rgba(37, 111, 100, 0.2)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Lavanderia (L)',
          data: dados.lavanderia,
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.2)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  } catch (err) {
    console.error('Erro ao buscar consumo:', err);
    return null;
  }
}

// Inicializa o gráfico
async function initGrafico() {
  const dadosGrafico = await buscarConsumo();
  if (!dadosGrafico) return;

  new Chart(ctx, {
    type: 'line',
    data: dadosGrafico,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 14 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: context => `${context.dataset.label}: ${context.parsed.y} L`
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Litros (L)', font: { size: 14, weight: 'bold' } }
        },
        x: {
          title: { display: true, text: 'Dias', font: { size: 14, weight: 'bold' } }
        }
      }
    }
  });
}

// Executa ao carregar a página
initGrafico();
