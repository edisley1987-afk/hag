// ===============================
// 📊 HISTÓRICO PROFISSIONAL HAG (V2)
// ===============================

const API_URL = window.location.origin + "/historico";

let grafico = null;

// ===============================
// 🚀 CARREGAR HISTÓRICO
// ===============================
async function carregarHistorico() {

  const container = document.getElementById("historico");
  const ctx = document.getElementById("graficoHistorico");

  container.innerHTML = "⏳ Carregando histórico...";

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao buscar histórico");

    const dados = await res.json();

    if (!dados || !dados.length) {
      container.innerHTML = "📭 Nenhum dado encontrado";
      return;
    }

    // ===============================
    // 📋 TABELA
    // ===============================
    let html = `
      <table class="tabela-historico">
        <thead>
          <tr>
            <th>Data</th>
            <th>Reservatório</th>
            <th>Nível (%)</th>
            <th>Volume (L)</th>
          </tr>
        </thead>
        <tbody>
    `;

    // ===============================
    // 📈 DADOS PARA GRÁFICO
    // ===============================
    const datasets = {};

    dados.forEach(p => {

      const dataFormatada = new Date(p.timestamp).toLocaleString("pt-BR");

      html += `
        <tr>
          <td>${dataFormatada}</td>
          <td>${formatarNome(p.reservatorio)}</td>
          <td>${Number(p.percent || 0).toFixed(1)}%</td>
          <td>${formatarNumero(p.valor)} L</td>
        </tr>
      `;

      // agrupar por reservatório
      if (!datasets[p.reservatorio]) {
        datasets[p.reservatorio] = [];
      }

      datasets[p.reservatorio].push({
        x: p.timestamp,
        y: Number(p.percent || 0)
      });

    });

    html += "</tbody></table>";
    container.innerHTML = html;

    // ===============================
    // 📊 DESTRUIR GRÁFICO ANTIGO
    // ===============================
    if (grafico) {
      grafico.destroy();
    }

    // ===============================
    // 🎨 CORES AUTOMÁTICAS
    // ===============================
    const cores = [
      "#00e5ff",
      "#00ff88",
      "#ffd600",
      "#ff9800",
      "#b388ff",
      "#ff5252"
    ];

    // ===============================
    // 📈 CRIAR GRÁFICO
    // ===============================
    grafico = new Chart(ctx, {
      type: "line",
      data: {
        datasets: Object.entries(datasets).map(([nome, valores], index) => ({
          label: formatarNome(nome),
          data: valores.sort((a, b) => a.x - b.x),
          borderColor: cores[index % cores.length],
          backgroundColor: cores[index % cores.length],
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2
        }))
      },
      options: {
        parsing: false,
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            position: "bottom"
          },
          title: {
            display: true,
            text: "📊 Histórico de Nível dos Reservatórios (%)"
          }
        },

        scales: {
          x: {
            type: "time",
            time: {
              unit: "hour",
              tooltipFormat: "dd/MM HH:mm"
            },
            title: {
              display: true,
              text: "Tempo"
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: "Nível (%)"
            }
          }
        }
      }
    });

  } catch (err) {
    container.innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
    console.error(err);
  }
}

// ===============================
// 🔧 UTILITÁRIOS
// ===============================
function formatarNome(nome){
  return nome
    .replace(/_/g, " ")
    .replace("current", "")
    .replace("Reservatorio", "Reservatório")
    .replace("Agua", "Água")
    .trim();
}

function formatarNumero(n){
  return Number(n || 0).toLocaleString("pt-BR");
}

// ===============================
// 🔄 AUTO REFRESH (OPCIONAL)
// ===============================
setInterval(carregarHistorico, 60000); // atualiza a cada 1 min

// ===============================
// 🚀 START
// ===============================
carregarHistorico();
