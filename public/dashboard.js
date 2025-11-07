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

  const labels = [];
  const valores = [];
  const capacidades = [];

  // Ignora a chave "timestamp"
  Object.entries(dados).forEach(([key, valorBruto]) => {
    if (key === "timestamp") return;

    const nome = key
      .replace("Reservatorio_", "Reservatório ")
      .replace("_current", "");

    // Garante que é número
    const valor = Number(valorBruto) || 0;

    // Define capacidade conforme o reservatório
    let capacidade = 0;
    if (nome.includes("Elevador")) capacidade = 20000;
    if (nome.includes("Osmose")) capacidade = 200;
    if (nome.includes("CME")) capacidade = 1000;
    if (nome.includes("Abrandada")) capacidade = 9000;

    const porcent = capacidade > 0 ? (valor / capacidade) * 100 : 0;

    // Define cor conforme o nível
    let cor = "#00c9a7"; // verde
    if (porcent < 30) cor = "#e53935"; // vermelho
    else if (porcent < 50) cor = "#fbc02d"; // amarelo

    // Cria o card
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${nome}</h2>
      <div class="progress">
        <div class="progress-fill" style="width:${porcent.toFixed(1)}%; background:${cor}"></div>
      </div>
      <div class="valor" style="color:${cor}">
        ${valor.toFixed(0)} L (${porcent.toFixed(1)}%)
      </div>
    `;
    cards.appendChild(card);

    labels.push(nome);
    valores.push(valor);
    capacidades.push(capacidade);
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleString("pt-BR");

  atualizarGrafico(labels, valores, capacidades);
}

let chart;
function atualizarGrafico(labels, valores, capacidades) {
  const ctx = document.getElementById("chartCanvas").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Capacidade Total (L)",
          data: capacidades,
          backgroundColor: "rgba(0, 120, 166, 0.3)",
          borderColor: "#0078a6",
          borderWidth: 2,
        },
        {
          label: "Nível Atual (L)",
          data: valores,
          backgroundColor: valores.map((v, i) => {
            const porcent = (v / capacidades[i]) * 100;
            if (porcent < 30) return "#e53935";
            if (porcent < 50) return "#fbc02d";
            return "#00c9a7";
          }),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#fff" } },
        title: {
          display: true,
          text: "Níveis dos Reservatórios (litros) — Hospital Arnaldo Gavazza",
          color: "#fff",
          font: { size: 16 },
        },
      },
      scales: {
        x: {
          ticks: { color: "#ddd" },
          grid: { color: "rgba(255,255,255,0.1)" },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#ddd" },
          grid: { color: "rgba(255,255,255,0.1)" },
        },
      },
    },
  });
}

// Atualiza automaticamente a cada 15s
setInterval(carregarDados, 15000);
carregarDados();
