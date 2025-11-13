const API_URL = window.location.origin + "/historico";

async function carregarConsumo() {
  try {
    const res = await fetch(API_URL);
    const historico = await res.json();

    // Calcular consumo dos últimos 5 dias para os reservatórios Elevador e Osmose
    const consumoDiario = calcularConsumoDiario(historico);
    exibirGrafico(consumoDiario);
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar dados de consumo diário.");
  }
}

function calcularConsumoDiario(historico) {
  const CAPACIDADES = {
    "Reservatorio_Elevador_current": 20000,
    "Reservatorio_Osmose_current": 200
  };

  // Agrupar por dia
  const dias = {};
  historico.forEach(h => {
    const data = new Date(h.timestamp);
    const dia = data.toLocaleDateString("pt-BR");

    for (const key of Object.keys(CAPACIDADES)) {
      if (h[key] !== undefined) {
        if (!dias[dia]) dias[dia] = {};
        if (!dias[dia][key]) dias[dia][key] = [];
        dias[dia][key].push(h[key]);
      }
    }
  });

  // Calcular consumo (diferença entre máximo e mínimo do dia)
  const resultado = [];
  Object.keys(dias).forEach(dia => {
    const elevador = dias[dia]["Reservatorio_Elevador_current"] || [];
    const osmose = dias[dia]["Reservatorio_Osmose_current"] || [];

    const consumoElevador = elevador.length > 1 ? Math.max(...elevador) - Math.min(...elevador) : 0;
    const consumoOsmose = osmose.length > 1 ? Math.max(...osmose) - Math.min(...osmose) : 0;

    resultado.push({
      dia,
      elevador: consumoElevador,
      osmose: consumoOsmose
    });
  });

  // Ordena por data (mais recente por último)
  return resultado.slice(-5);
}

function exibirGrafico(consumo) {
  const ctx = document.getElementById("graficoConsumo").getContext("2d");
  if (window.graficoConsumo) window.graficoConsumo.destroy();

  const labels = consumo.map(c => c.dia);
  const elevador = consumo.map(c => c.elevador);
  const osmose = consumo.map(c => c.osmose);

  window.graficoConsumo = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Elevador (L)",
          data: elevador,
          backgroundColor: "rgba(20,108,96,0.6)",
          borderColor: "#146C60",
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: "Osmose (L)",
          data: osmose,
          backgroundColor: "rgba(83,178,168,0.6)",
          borderColor: "#53B2A8",
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Consumo de Água (Litros)"
          }
        },
        x: {
          title: {
            display: true,
            text: "Dia"
          }
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#146C60", font: { size: 13 } }
        },
        title: {
          display: true,
          text: "Consumo Diário de Água — Últimos 5 dias",
          color: "#146C60",
          font: { size: 20, weight: "bold" }
        }
      }
    }
  });
}

window.addEventListener("DOMContentLoaded", carregarConsumo);
