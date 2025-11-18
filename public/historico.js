// =====================
//  HISTORICO.JS FINAL
// =====================

// URL da API
const API_URL = window.location.origin + "/historico";

// Elementos da página
const selectReservatorio = document.getElementById("reservatorioSelect");
const cardsContainer = document.getElementById("history-cards");
const graficoCanvas = document.getElementById("graficoHistorico");

let grafico = null;

// Mapa dos nomes internos → nomes amigáveis
const MAPA_NOMES = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current"
};

// Cores iguais ao dashboard
const CORES = {
  Reservatorio_Elevador_current: "#007bff",
  Reservatorio_Osmose_current: "#00bcd4",
  Reservatorio_CME_current: "#4caf50",
  Reservatorio_Agua_Abrandada_current: "#9c27b0"
};

// =====================
// FUNÇÃO PRINCIPAL
// =====================
async function carregarHistorico() {
  
  const reservatorioSelecionado = MAPA_NOMES[selectReservatorio.value];
  cardsContainer.innerHTML = "⏳ Carregando...";

  try {
    const res = await fetch(API_URL);
    const historico = await res.json();

    if (!historico || !Object.keys(historico).length) {
      cardsContainer.innerHTML = "<p>📭 Nenhum dado encontrado</p>";
      return;
    }

    const datas = Object.keys(historico).sort();
    const valores = [];

    // Montar gráfico e encontrar última leitura
    let ultimaLeitura = null;
    let ultimaData = null;

    datas.forEach(data => {
      const item = historico[data][reservatorioSelecionado];
      if (!item) return;

      const media = (item.min + item.max) / 2;
      valores.push(media);

      ultimaLeitura = item;
      ultimaData = data;
    });

    // ==========================
    // MOSTRAR CARD DA ÚLTIMA LEITURA
    // ==========================
    if (ultimaLeitura) {
      const agora = new Date();
      const ultima = new Date(ultimaData);

      const diffMin = Math.round((agora - ultima) / 60000);

      const alerta = diffMin > 10
        ? `<div class="alerta">⚠ Mais de 10 minutos sem atualização</div>`
        : "";

      cardsContainer.innerHTML = `
        <div class="card">
          <h3>Última leitura</h3>
          <p><strong>Data:</strong> ${ultimaData}</p>
          <p><strong>Mínimo:</strong> ${ultimaLeitura.min}%</p>
          <p><strong>Máximo:</strong> ${ultimaLeitura.max}%</p>
          ${alerta}
        </div>
      `;
    }

    // ==========================
    // GRÁFICO
    // ==========================
    if (grafico) grafico.destroy();

    grafico = new Chart(graficoCanvas, {
      type: "line",
      data: {
        labels: datas,
        datasets: [{
          label: "Nível (%)",
          data: valores,
          borderColor: CORES[reservatorioSelecionado],
          backgroundColor: CORES[reservatorioSelecionado],
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

  } catch (e) {
    cardsContainer.innerHTML = `<p style="color:red;">Erro ao carregar histórico</p>`;
  }
}

// =====================
// EVENTO DE TROCA DO SELECT
// =====================
selectReservatorio.addEventListener("change", carregarHistorico);

// Carregar ao abrir a página
carregarHistorico();
