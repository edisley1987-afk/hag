// =====================================================
// 📊 DASHBOARD HAG - leitura em tempo real do servidor
// =====================================================
const API_URL = "https://hag-9umi.onrender.com/dados";
const cardsContainer = document.getElementById("cards");
const lastUpdateEl = document.getElementById("lastUpdate");
const ctx = document.getElementById("chartCanvas").getContext("2d");

let chart;

// Configuração dos reservatórios
const CONFIG = {
  "Reservatório Elevador": { capacidade: 20000 },
  "Reservatório Osmose": { capacidade: 200 },
  "Reservatório CME": { capacidade: 1000 },
  "Reservatório Água Abrandada": { capacidade: 9000 },
  "Pressão Saída": { capacidade: 0 },
  "Pressão Retorno": { capacidade: 0 }
};

// Função principal de atualização
async function atualizarDashboard() {
  try {
    const res = await fetch(API_URL + "?_=" + Date.now());
    const dados = await res.json();
    cardsContainer.innerHTML = "";

    const labels = [];
    const valores = [];

    Object.values(dados).forEach(sensor => {
      const nome = sensor.nome || "Desconhecido";
      const valor = sensor.valor || 0;
      const capacidade = CONFIG[nome]?.capacidade || 0;
      const percentual = capacidade > 0 ? Math.round((valor / capacidade) * 100) : 0;

      // Cor dinâmica por nível
      let cor = "#00b050"; // verde
      if (percentual < 30) cor = "#ff4d4d";
      else if (percentual < 60) cor = "#ffc000";

      // Card HTML
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-title">${nome}</div>
        <div class="bar">
          <div class="fill" style="width:${percentual}%; background:${cor}"></div>
        </div>
        <div class="info">
          ${valor.toFixed(1)} L — ${percentual}%
        </div>
      `;
      cardsContainer.appendChild(card);

      // Adiciona ao gráfico
      if (capacidade > 0) {
        labels.push(nome);
        valores.push(percentual);
      }
    });

    // Atualiza hora
    lastUpdateEl.innerText = "Última atualização: " + new Date().toLocaleTimeString("pt-BR");

    // Atualiza gráfico
    atualizarGrafico(labels, valores);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    lastUpdateEl.innerText = "Erro ao conectar ao servidor";
  }
}

// Gráfico de barras (nível atual)
function atualizarGrafico(labels, valores) {
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% de Nível Atual",
        data: valores,
        borderWidth: 1,
        backgroundColor: valores.map(v => v < 30 ? "#ff4d4d" : v < 60 ? "#ffc000" : "#00b050")
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 20 }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Atualiza a cada 10 segundos
atualizarDashboard();
setInterval(atualizarDashboard, 10000);
