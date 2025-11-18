// =====================
//  HISTORICO.JS FINAL (com Trendline)
// =====================

// URL da API de histórico gerada pelo servidor Node
const API_URL = window.location.origin + "/historico";

// Elementos da página
const selectReservatorio = document.getElementById("reservatorioSelect");
const cardsContainer = document.getElementById("history-cards");
const graficoCanvas = document.getElementById("graficoHistorico");

let grafico = null;

// Mapa do value → chave interna usada no servidor
const MAPA_NOMES = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
};

// Cores iguais ao dashboard
const CORES = {
  Reservatorio_Elevador_current: "#2c8b7d",
  Reservatorio_Osmose_current: "#57b3a0",
  Reservatorio_CME_current: "#3498db",
  Reservatorio_Agua_Abrandada_current: "#9b59b6",
};

// ========================================
// FUNÇÃO DE REGRESSÃO LINEAR (TRENDLINE)
// ========================================
function calcularTrendline(x, y) {
  const n = y.length;
  if (n === 0) return [];

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return x.map((xi) => slope * xi + intercept);
}

// =====================
// FUNÇÃO PRINCIPAL
// =====================
async function carregarHistorico() {
  const chaveReservatorio = MAPA_NOMES[selectReservatorio.value];

  if (!chaveReservatorio) {
    cardsContainer.innerHTML = "<p style='color:red;'>Reservatório inválido.</p>";
    return;
  }

  cardsContainer.innerHTML = "⏳ Carregando histórico...";

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Falha ao buscar histórico");

    const historico = await res.json();
    if (!historico || !Object.keys(historico).length) {
      cardsContainer.innerHTML = "<p style='text-align:center;'>📭 Nenhum dado encontrado.</p>";
      if (grafico) grafico.destroy();
      return;
    }

    const datasOrdenadas = Object.keys(historico).sort();

    const labels = [];
    const valoresMedios = [];

    let ultimaLeitura = null;
    let ultimaData = null;

    datasOrdenadas.forEach((data) => {
      const registroDia = historico[data];
      if (!registroDia) return;

      const info = registroDia[chaveReservatorio];
      if (!info) return;

      const { min, max } = info;
      const media = (min + max) / 2;

      labels.push(data);
      valoresMedios.push(media);

      ultimaLeitura = info;
      ultimaData = data;
    });

    if (!labels.length) {
      cardsContainer.innerHTML = "<p style='text-align:center;'>📭 Não há dados para esse reservatório.</p>";
      if (grafico) grafico.destroy();
      return;
    }

    // ==========================
    // CARD DE ÚLTIMA LEITURA
    // ==========================
    if (ultimaLeitura && ultimaData) {
      const hoje = new Date();
      const dataUltima = new Date(ultimaData);
      const diffMin = Math.round((hoje - dataUltima) / 60000);

      const alerta =
        diffMin > 10
          ? "<div class='alerta'>⚠ Mais de 10 minutos sem atualização</div>"
          : "";

      cardsContainer.innerHTML = `
        <div class="card historico-card-resumo">
          <h3>Última leitura</h3>
          <p><strong>Data:</strong> ${ultimaData}</p>
          <p><strong>Mínimo:</strong> ${ultimaLeitura.min} L</p>
          <p><strong>Máximo:</strong> ${ultimaLeitura.max} L</p>
          ${alerta}
        </div>
      `;
    }

    // =======================================
    // TRENDLINE (REGRESSÃO LINEAR)
    // =======================================
    const indices = valoresMedios.map((_, i) => i);
    const trendline = calcularTrendline(indices, valoresMedios);

    // ==========================
    // GRÁFICO
    // ==========================
    if (grafico) grafico.destroy();

    grafico = new Chart(graficoCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nível médio diário (L)",
            data: valoresMedios,
            borderColor: CORES[chaveReservatorio],
            backgroundColor: CORES[chaveReservatorio],
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
          },

          // 🎯 LINHA DE TENDÊNCIA PROFISSIONAL
          {
            label: "Linha de tendência",
            data: trendline,
            borderColor: "#555",
            borderDash: [6, 6],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            fill: false,
          },
        ],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  } catch (err) {
    console.error(err);
    cardsContainer.innerHTML = `<p style="color:red;">Erro ao carregar histórico: ${err.message}</p>`;
    if (grafico) grafico.destroy();
  }
}

// Evento ao trocar o reservatório
selectReservatorio.addEventListener("change", carregarHistorico);

// Carregar na abertura da página
carregarHistorico();
