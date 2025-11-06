const API_URL = "https://hag-9umi.onrender.com/dados";

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

  const labels = [];
  const valores = [];

  Object.entries(dados).forEach(([key, sensor]) => {
    const nome = sensor.nome || key;
    const valor = sensor.valor ?? 0;
    const raw = sensor.raw ?? 0;
    let capacidade = 0;

    // tenta estimar a capacidade com base no nome
    if (nome.includes("Elevador")) capacidade = 20000;
    if (nome.includes("Osmose")) capacidade = 200;
    if (nome.includes("CME")) capacidade = 1000;
    if (nome.includes("Abrandada")) capacidade = 9000;

    const porcent = capacidade > 0 ? (valor / capacidade) * 100 : 0;

    // monta o card
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${nome}</h2>
      <div class="progress">
        <div class="progress-fill" style="width:${porcent.toFixed(1)}%"></div>
      </div>
      <div class="valor">${valor.toFixed(0)} L (${porcent.toFixed(1)}%)</div>
    `;
    cards.appendChild(card);

    labels.push(nome);
    valores.push(valor);
  });

  // Atualiza hora
  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleString("pt-BR");

  // Atualiza gráfico
  atualizarGrafico(labels, valores);
}

let chart;
function atualizarGrafico(labels, valores) {
  const ctx = document.getElementById("chartCanvas").getContext("2d");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Nível (litros)",
          data: valores,
          backgroundColor: "#00a88f",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

// Atualiza a cada 15 segundos
setInterval(carregarDados, 15000);
carregarDados();
