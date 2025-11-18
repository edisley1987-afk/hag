// =====================
//  HISTORICO.JS FINAL CORRIGIDO
// =====================

// URL da API de histórico gerada pelo servidor Node
const API_URL = window.location.origin + "/historico";

// Elementos da página (devem existir no HTML)
const selectReservatorio = document.getElementById("reservatorioSelect");
const cardsContainer = document.getElementById("history-cards");
const graficoCanvas = document.getElementById("graficoHistorico");

let grafico = null;

// Mapa do valor do <select> para o nome interno no arquivo historico.json
const MAPA_NOMES = {
  elevador: "Reservatorio_Elevador_current",
  osmose: "Reservatorio_Osmose_current",
  cme: "Reservatorio_CME_current",
  abrandada: "Reservatorio_Agua_Abrandada_current",
};

// Cores (mesma lógica do resto do sistema)
const CORES = {
  Reservatorio_Elevador_current: "#2c8b7d",
  Reservatorio_Osmose_current: "#57b3a0",
  Reservatorio_CME_current: "#3498db",
  Reservatorio_Agua_Abrandada_current: "#9b59b6",
};

// =====================
// FUNÇÃO PRINCIPAL
// =====================
async function carregarHistorico() {
  const chaveReservatorio = MAPA_NOMES[selectReservatorio.value];

  if (!chaveReservatorio) {
    cardsContainer.innerHTML =
      "<p style='color:red;'>Reservatório inválido.</p>";
    return;
  }

  cardsContainer.innerHTML = "⏳ Carregando histórico...";

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Falha ao buscar histórico");
    const historico = await res.json();

    if (!historico || !Object.keys(historico).length) {
      cardsContainer.innerHTML =
        "<p style='text-align:center;'>📭 Nenhum dado encontrado.</p>";
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

      const infoReservatorio = registroDia[chaveReservatorio];
      if (!infoReservatorio) return;

      const { min, max } = infoReservatorio;

      // média em % (o servidor já envia convertido)
      const media = (min + max) / 2;

      labels.push(data);
      valoresMedios.push(media);

      ultimaLeitura = infoReservatorio;
      ultimaData = data;
    });

    if (!labels.length) {
      cardsContainer.innerHTML =
        "<p style='text-align:center;'>📭 Não há dados para esse reservatório.</p>";
      if (grafico) grafico.destroy();
      return;
    }

    // ============================
    // CARD DE ÚLTIMA LEITURA (LITROS)
    // ============================
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

    // ============================
    // GRÁFICO EM PORCENTAGEM (%)
    // ============================
    if (grafico) grafico.destroy();

    grafico = new Chart(graficoCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nível médio diário (%)",
            data: valoresMedios,
            borderColor: CORES[chaveReservatorio] || "#2c8b7d",
            backgroundColor: CORES[chaveReservatorio] || "#2c8b7d",
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 },
        },
      },
    });
  } catch (err) {
    console.error(err);
    cardsContainer.innerHTML = `<p style="color:red;">Erro ao carregar histórico: ${err.message}</p>`;
    if (grafico) grafico.destroy();
  }
}

// Evento ao mudar o select
selectReservatorio.addEventListener("change", carregarHistorico);

// Carregar ao abrir
carregarHistorico();
