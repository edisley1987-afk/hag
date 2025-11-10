async function buscarDados() {
  try {
    const res = await fetch("/dados");
    return await res.json();
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
    return null;
  }
}

function criarCard(nome, litros, percentual, capacidade) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>${nome}</h2>
    <p><strong>${percentual.toFixed(1)}%</strong> — ${litros} L</p>
    <p>Capacidade: ${capacidade} L</p>
  `;
  return card;
}

function criarGauge(nome, percentual) {
  const canvas = document.createElement("canvas");
  canvas.className = "gauge";

  const cor =
    percentual <= 30 ? "#ff4d4d" :
    percentual <= 60 ? "#ffd166" :
    "#00d7a0";

  new Chart(canvas, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [percentual, 100 - percentual],
          backgroundColor: [cor, "#2a9d8f40"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
      labels: ["Nível", "Restante"],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: {
          display: true,
          text: `${nome}\n${percentual.toFixed(1)}%`,
          color: "#fff",
          font: { size: 14 },
        },
      },
    },
  });

  return canvas;
}

async function atualizarDashboard() {
  const dados = await buscarDados();
  if (!dados) return;

  const containerCards = document.getElementById("cards");
  const containerGauges = document.getElementById("graficoContainer");
  containerCards.innerHTML = "";
  containerGauges.innerHTML = "";

  const sensores = [
    { nome: "Reservatório Elevador", key: "Reservatorio_Elevador_current", capacidade: 20000 },
    { nome: "Reservatório Osmose", key: "Reservatorio_Osmose_current", capacidade: 200 },
    { nome: "Reservatório CME", key: "Reservatorio_CME_current", capacidade: 1000 },
    { nome: "Água Abrandada", key: "Agua_Abrandada_current", capacidade: 9000 },
  ];

  sensores.forEach((s) => {
    const valor = dados[s.key] ?? 0;
    const percentual = (valor / s.capacidade) * 100;

    containerCards.appendChild(criarCard(s.nome, valor, percentual, s.capacidade));
    containerGauges.appendChild(criarGauge(s.nome, percentual));
  });

  const updateEl = document.getElementById("lastUpdate");
  updateEl.textContent = "Última atualização: " + new Date().toLocaleString("pt-BR");
}

function atualizarRelogio() {
  const relogio = document.getElementById("relogio");
  relogio.textContent = new Date().toLocaleTimeString("pt-BR");
}

document.addEventListener("DOMContentLoaded", () => {
  atualizarDashboard();
  atualizarRelogio();
  setInterval(atualizarDashboard, 10000);
  setInterval(atualizarRelogio, 1000);
});
