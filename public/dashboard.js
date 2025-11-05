// public/dashboard.js
const endpoint = "/dados";
const updateInterval = 10000; // 10 seconds

const config = {
  "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000 },
  "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200 },
  "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000 },
  "Agua_Abrandada_current": { nome: "Reservatório Água Abrandada", capacidade: 9000 }
};

let chart = null;

async function atualizarDados() {
  try {
    const resp = await fetch(endpoint);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dados = await resp.json();

    const container = document.getElementById("cards");
    container.innerHTML = "";

    const labels = [];
    const valores = [];
    const capacidades = [];

    for (const chave of Object.keys(config)) {
      const info = config[chave];
      const valorObj = dados[chave] || {};
      const valor = Number(valorObj.valor || 0);
      const porcentagem = info.capacidade > 0 ? ((valor / info.capacidade) * 100) : 0;
      const pctText = Number.isFinite(porcentagem) ? porcentagem.toFixed(1) : "0.0";

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${info.nome}</h3>
        <p><strong>${valor}</strong> L (${pctText}%)</p>
        <div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(100, pctText))}%"></div></div>
      `;
      container.appendChild(card);

      labels.push(info.nome);
      valores.push(valor);
      capacidades.push(info.capacidade);
    }

    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString();

    atualizarGrafico(labels, valores, capacidades);
  } catch (err) {
    console.error("Erro ao atualizar:", err);
    document.getElementById("lastUpdate").textContent = "Erro ao obter dados do servidor.";
  }
}

function atualizarGrafico(labels, valores, capacidades) {
  const ctx = document.getElementById("chartCanvas").getContext("2d");

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = valores;
    chart.data.datasets[1].data = capacidades;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Volume (L)',
          data: valores,
          backgroundColor: 'rgba(99,180,173,0.9)',
          borderColor: 'rgba(99,180,173,1)',
          borderWidth: 1
        },
        {
          label: 'Capacidade (L)',
          data: capacidades,
          backgroundColor: 'rgba(28,89,86,0.15)',
          borderColor: 'rgba(28,89,86,0.6)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'top' } }
    }
  });
}

setInterval(atualizarDados, updateInterval);
window.onload = atualizarDados;
