const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

async function carregarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();
    atualizarPainel(dados);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

function atualizarPainel(dados) {
  const cards = document.getElementById("cards");
  cards.innerHTML = "";

  Object.entries(dados).forEach(([key, valor]) => {
    if (key === "timestamp" || key.toLowerCase().includes("pressao")) return;

    const nome = key
      .replace("Reservatorio_", "Reservatório ")
      .replace("Agua_", "Água ")
      .replace("_current", "");

    const capacidade = nome.includes("Elevador")
      ? 20000
      : nome.includes("Osmose")
      ? 200
      : nome.includes("CME")
      ? 1000
      : nome.includes("Abrandada")
      ? 9000
      : 0;

    const porcent = capacidade ? (valor / capacidade) * 100 : 0;
    const cor =
      porcent < 30 ? "#e53935" : porcent < 50 ? "#fbc02d" : "#00c9a7";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${nome}</h2>
      <div class="gauge-container">
        <canvas id="gauge_${key}"></canvas>
      </div>
      <div style="font-size:1rem; color:${cor}">
        ${valor.toFixed(0)} L — ${porcent.toFixed(1)}%
      </div>
    `;
    cards.appendChild(card);

    desenharGauge(`gauge_${key}`, porcent, cor);
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleString("pt-BR");
}

function desenharGauge(canvasId, porcent, cor) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [porcent, 100 - porcent],
          backgroundColor: [cor, "rgba(255,255,255,0.1)"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "75%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          display: true,
          color: "#fff",
          formatter: () => `${porcent.toFixed(0)}%`,
          font: { weight: "bold", size: 16 },
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

// Atualiza a cada 15 segundos
setInterval(carregarDados, 15000);
carregarDados();
