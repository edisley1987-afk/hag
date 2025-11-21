// =====================
//  HISTORICO.JS FINAL (SEM ALERTA) – COM LITROS REAIS + LINHA DE NÍVEL MÁXIMO
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

// CAPACIDADE REAL DE CADA RESERVATÓRIO
const CAPACIDADES = {
  Reservatorio_Elevador_current: 20000,   // 20.000 litros
  Reservatorio_Osmose_current: 200,       // 200 litros
  Reservatorio_CME_current: 1000,         // 1.000 litros
  Reservatorio_Agua_Abrandada_current: 9000, // 9.000 litros
};

// Cores
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
    cardsContainer.innerHTML = "<p style='color:red;'>Reservatório inválido.</p>";
    return;
  }

  const capacidade = CAPACIDADES[chaveReservatorio];

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
    const valoresMediosLitros = [];

    let ultimaLeitura = null;
    let ultimaData = null;

    // Processa cada dia
    datasOrdenadas.forEach((data) => {
      const registroDia = historico[data];
      const info = registroDia[chaveReservatorio];
      if (!info) return;

      const { min, max } = info;

      const mediaLitros = (min + max) / 2; // litros reais

      labels.push(data);
      valoresMediosLitros.push(mediaLitros);

      ultimaLeitura = info;
      ultimaData = data;
    });

    if (!labels.length) {
      cardsContainer.innerHTML = "<p style='text-align:center;'>📭 Não há dados para esse reservatório.</p>";
      if (grafico) grafico.destroy();
      return;
    }

    // ============================
    // CARD DA ÚLTIMA LEITURA (sem alerta)
    // ============================
    if (ultimaLeitura && ultimaData) {
      cardsContainer.innerHTML = `
        <div class="card historico-card-resumo">
          <h3>Última leitura</h3>
          <p><strong>Data:</strong> ${ultimaData}</p>
          <p><strong>Mínimo:</strong> ${ultimaLeitura.min} L</p>
          <p><strong>Máximo:</strong> ${ultimaLeitura.max} L</p>
        </div>
      `;
    }

    // ============================
    // GRÁFICO EM LINHA (LITROS + LINHA DE MÁXIMO)
    // ============================

    if (grafico) grafico.destroy();

    grafico = new Chart(graficoCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nível médio diário (L)",
            data: valoresMediosLitros,
            borderColor: CORES[chaveReservatorio],
            backgroundColor: CORES[chaveReservatorio],
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
          },
          {
            label: "Nível Máximo (L)",
            data: labels.map(() => capacidade), // linha horizontal
            borderColor: "#d9534f",
            backgroundColor: "#d9534f",
            borderDash: [6, 4],
            tension: 0,
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: capacidade, // ESCALA CORRETA
          },
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
