// =====================
//  HISTORICO.JS – COMPATÍVEL COM O SERVIDOR ATUAL
// =====================

const selectReservatorio = document.getElementById("reservatorioSelect");
const selectPeriodo = document.getElementById("periodoSelect"); 
const cardsContainer = document.getElementById("history-cards");
const graficoCanvas = document.getElementById("graficoHistorico");

let grafico = null;

const MAPA_NOMES = {
  elevador: "elevador",
  osmose: "osmose",
  cme: "cme",
  abrandada: "abrandada",
};

const NOMES_COMPLETOS = {
  elevador: "Reservatório Elevador",
  osmose: "Osmose",
  cme: "CME",
  abrandada: "Água Abrandada",
};

const CAPACIDADES = {
  elevador: 20000,
  osmose: 200,
  cme: 1000,
  abrandada: 9000,
};

const CORES = {
  elevador: "#2c8b7d",
  osmose: "#57b3a0",
  cme: "#3498db",
  abrandada: "#9b59b6",
};

// =====================
//  CARREGAR HISTÓRICO
// =====================

async function carregarHistorico() {
  const reservatorio = MAPA_NOMES[selectReservatorio.value];
  const periodo = selectPeriodo.value;

  let API_URL = "";
  if (periodo === "24h") {
    API_URL = `${window.location.origin}/historico/24h/${reservatorio}`;
  } else {
    API_URL = `${window.location.origin}/historico`;
  }

  cardsContainer.innerHTML = "⏳ Carregando...";

  try {
    const res = await fetch(API_URL);
    const dados = await res.json();

    if (!Array.isArray(dados) || dados.length === 0) {
      cardsContainer.innerHTML = "<p>📭 Nenhum dado encontrado.</p>";
      if (grafico) grafico.destroy();
      return;
    }

    // Filtra somente o reservatório desejado
    const filtrado = dados.filter(d => d.reservatorio === reservatorio);

    if (filtrado.length === 0) {
      cardsContainer.innerHTML = "<p>📭 Não há dados para esse reservatório.</p>";
      if (grafico) grafico.destroy();
      return;
    }

    // Organiza por timestamp
    filtrado.sort((a, b) => a.timestamp - b.timestamp);

    // Prepara gráfico
    const labels = filtrado.map(d => formatarHoraOuDia(d.timestamp, periodo));
    const valores = filtrado.map(d => d.valor);

    // Última leitura
    const last = filtrado[filtrado.length - 1];
    const dataUltima = new Date(last.timestamp).toLocaleString("pt-BR");

    cardsContainer.innerHTML = `
      <div class="card historico-card-resumo">
        <h3>Última leitura</h3>
        <p><strong>Data:</strong> ${dataUltima}</p>
        <p><strong>Nível:</strong> ${last.valor} L</p>
      </div>
    `;

    // GRAFICO
    if (grafico) grafico.destroy();

    grafico = new Chart(graficoCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nível (L)",
            data: valores,
            borderColor: CORES[reservatorio],
            backgroundColor: CORES[reservatorio],
            tension: 0.3
          },
          {
            label: "Capacidade Máxima",
            data: labels.map(() => CAPACIDADES[reservatorio]),
            borderColor: "#d9534f",
            borderDash: [5, 4],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: CAPACIDADES[reservatorio]
          }
        }
      }
    });

  } catch (e) {
    cardsContainer.innerHTML = `<p style="color:red;">Erro: ${e.message}</p>`;
  }
}

// =====================
//  FORMATAÇÃO PARA GRÁFICO
// =====================
function formatarHoraOuDia(ts, periodo) {
  const d = new Date(ts);
  if (periodo === "24h") {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR");
}

selectReservatorio.addEventListener("change", carregarHistorico);
selectPeriodo.addEventListener("change", carregarHistorico);

carregarHistorico();
