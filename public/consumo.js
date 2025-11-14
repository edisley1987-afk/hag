// ======= consumo.js =======
// Agora o histórico de consumo vem do servidor, salvo em /consumo-diario

async function carregarConsumo() {
  try {
    const resp = await fetch("/consumo-diario");
    const consumo = await resp.json();

    if (!consumo.length) {
      document.getElementById("graficoContainer").innerHTML =
        "<p style='text-align:center; color:gray;'>Ainda não há dados de consumo diário salvos.</p>";
      return;
    }

    exibirGrafico(consumo.slice(-7)); // últimos 7 dias
  } catch (err) {
    console.error("Erro ao carregar consumo diário:", err);
  }
}

function exibirGrafico(consumo) {
  const ctx = document.getElementById("graficoConsumo").getContext("2d");

  if (window.graficoConsumo instanceof Chart) {
    window.graficoConsumo.destroy();
  }

  const valores = [
    ...consumo.map(d => d.elevador),
    ...consumo.map(d => d.osmose)
  ];

  const maxValor = Math.max(...valores, 1);
  const margem = maxValor * 0.30;
  const limiteY = Math.ceil(maxValor + margem);

  window.graficoConsumo = new Chart(ctx, {
    type: "bar",
    data: {
      labels: consumo.map(d => d.dia),
      datasets: [
        {
          label: "Reservatório Elevador (L)",
          data: consumo.map(d => d.elevador),
          backgroundColor: "#2c8b7d",
        },
        {
          label: "Reservatório Osmose (L)",
          data: consumo.map(d => d.osmose),
          backgroundColor: "#57b3a0",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Consumo Diário de Água — Histórico",
          font: { size: 18 },
        },
        legend: { position: "top" },
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: limiteY,
          title: { display: true, text: "Litros Consumidos" },
        },
        x: { title: { display: true, text: "Dia" } },
      },
    },
  });
}

window.addEventListener("load", carregarConsumo);
