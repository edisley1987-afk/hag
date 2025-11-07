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
  const gaugeGrid = document.getElementById("gaugeGrid");
  cards.innerHTML = "";
  gaugeGrid.innerHTML = "";

  const pressoes = [];

  Object.entries(dados).forEach(([key, valorBruto]) => {
    if (key === "timestamp") return;

    if (key.toLowerCase().includes("pressao")) {
      pressoes.push({ nome: key.replace("_current", ""), valor: valorBruto });
      return;
    }

    const nome = key
      .replace("Reservatorio_", "Reservatório ")
      .replace("Agua_", "Água ")
      .replace("_current", "");

    const valor = Number(valorBruto) || 0;

    // === Capacidade total por reservatório ===
    const nomeLower = nome.toLowerCase();
    let capacidade = 0;
    if (nomeLower.includes("elevador")) capacidade = 20000;
    if (nomeLower.includes("osmose")) capacidade = 200;
    if (nomeLower.includes("cme")) capacidade = 1000;
    if (nomeLower.includes("abrandada")) capacidade = 9000;

    const porcent = capacidade > 0 ? (valor / capacidade) * 100 : 0;

    let cor = "#00c853"; // verde
    if (porcent < 30) cor = "#e53935"; // vermelho
    else if (porcent < 50) cor = "#ffb300"; // amarelo

    // === CARD simples (resumo numérico) ===
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${nome}</h3>
      <p><strong>${valor.toFixed(0)} L</strong> — ${porcent.toFixed(1)}%</p>
    `;
    cards.appendChild(card);

    // === GAUGE circular (substitui o gráfico grande) ===
    const gaugeDiv = document.createElement("div");
    gaugeDiv.className = "gauge-item";
    gaugeDiv.innerHTML = `
      <canvas id="gauge_${key}" width="200" height="200"></canvas>
      <div class="gauge-label">${nome}</div>
    `;
    gaugeGrid.appendChild(gaugeDiv);

    const ctx = document.getElementById(`gauge_${key}`).getContext("2d");
    new Chart(ctx, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: [porcent, 100 - porcent],
            backgroundColor: [cor, "rgba(255,255,255,0.15)"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        rotation: -90,
        circumference: 180,
        cutout: "70%",
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
      plugins: [
        {
          id: "textCenter",
          afterDraw(chart) {
            const { ctx } = chart;
            ctx.save();
            ctx.font = "bold 18px Segoe UI";
            ctx.fillStyle = cor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              `${porcent.toFixed(0)}%`,
              chart.width / 2,
              chart.height / 1.2
            );
            ctx.restore();
          },
        },
      ],
    });
  });

  // === BLOCO DE PRESSÕES ===
  if (pressoes.length > 0) {
    const blocoPressao = document.createElement("div");
    blocoPressao.className = "pressao-bloco";
    blocoPressao.innerHTML = "<h2>Pressões</h2>";

    pressoes.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card-pressao";
      card.innerHTML = `
        <div class="pressao-nome">${p.nome.replace("_", " ")}</div>
        <div class="pressao-valor">${p.valor} A</div>
      `;
      blocoPressao.appendChild(card);
    });

    cards.appendChild(blocoPressao);
  }

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleString("pt-BR");
}

// Atualiza a cada 15 segundos
setInterval(carregarDados, 15000);
carregarDados();
