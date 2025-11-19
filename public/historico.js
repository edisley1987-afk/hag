// === CONFIGURAÇÕES ===
const HIST_FILE = "/historico";   // <<< ALTERADO APENAS AQUI

// Capacidade por reservatório
const CAPACIDADES = {
  elevador: 20000,
  osmose: 200,
  cme: 5000,
  abrandada: 9000,
};

// Nome para exibir
const NOMES = {
  elevador: "Elevador",
  osmose: "Osmose",
  cme: "CME",
  abrandada: "Água Abrandada",
};

// === BUSCAR HISTÓRICO ===
async function carregarHistorico() {
  try {
    const resp = await fetch(HIST_FILE + "?v=" + Date.now());
    return await resp.json();
  } catch (e) {
    console.error("Erro ao carregar histórico:", e);
    return {};
  }
}

// === GERAR GRÁFICO COM LINHA DE TENDÊNCIA ===
function gerarGrafico(dias, valores, capacidade) {
  const ctx = document.getElementById("grafico").getContext("2d");

  // Calcular tendência (regressão linear)
  const n = valores.length;
  const x = [...Array(n).keys()];
  const avgX = x.reduce((a, b) => a + b, 0) / n;
  const avgY = valores.reduce((a, b) => a + b, 0) / n;

  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - avgX) * (valores[i] - avgY);
    den += (x[i] - avgX) ** 2;
  }
  const m = num / den;
  const b = avgY - m * avgX;

  const tendencia = x.map(i => m * i + b);

  if (window.graficoInstance) window.graficoInstance.destroy();

  window.graficoInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: dias,
      datasets: [
        {
          label: "Nível médio diário (L)",
          data: valores,
          borderWidth: 3,
          tension: 0.2,
          pointRadius: 5,
          borderColor: "#6a1b9a",
          backgroundColor: "#6a1b9a",
        },
        {
          label: "Linha de tendência",
          data: tendencia,
          borderWidth: 2,
          borderDash: [6, 6],
          tension: 0.1,
          pointRadius: 0,
          borderColor: "#000",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          suggestedMin: 0,
          suggestedMax: capacidade,
        }
      }
    }
  });
}

// === ATUALIZAR TELA ===
async function atualizarHistorico() {
  const select = document.getElementById("reservatorioSelect");
  const chave = select.value;

  const historico = await carregarHistorico();
  const dias = Object.keys(historico).sort();

  if (dias.length === 0) return;

  let valores = [];
  let exibirDias = [];

  dias.forEach(d => {
    const registro = historico[d][chave];
    if (registro) {
      const media = (registro.min + registro.max) / 2;
      valores.push(media);
      exibirDias.push(d);
    }
  });

  // Última leitura
  const ultimoDia = exibirDias[exibirDias.length - 1];
  const ultima = historico[ultimoDia][chave];

  document.getElementById("dadosResumo").innerHTML = `
    <strong>Data:</strong> ${ultimoDia}<br>
    <strong>Mínimo:</strong> ${ultima.min} L<br>
    <strong>Máximo:</strong> ${ultima.max} L<br>
  `;

  gerarGrafico(exibirDias, valores, CAPACIDADES[chave]);
}

document.getElementById("reservatorioSelect").addEventListener("change", atualizarHistorico);

atualizarHistorico();
