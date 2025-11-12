// === historico.js ===
// Exibe histórico de leituras com tabela e gráfico moderno

const API_URL = window.location.origin + "/historico";

async function carregarHistorico() {
  const container = document.getElementById("historico");
  const ctx = document.getElementById("graficoHistorico");
  container.innerHTML = "⏳ Carregando histórico...";

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao buscar histórico");
    const historico = await res.json();

    if (!Object.keys(historico).length) {
      container.innerHTML = `<p style="text-align:center; color:#555;">📭 Nenhum dado de histórico encontrado.</p>`;
      return;
    }

    // === Montar tabela ===
    let html = `
      <table class="tabela-historico">
        <thead>
          <tr>
            <th>Data</th>
            <th>Sensor</th>
            <th>Leitura Mínima</th>
            <th>Leitura Máxima</th>
          </tr>
        </thead>
        <tbody>
    `;

    const labels = []; // datas
    const datasets = {}; // sensores e valores médios

    // Ordena as datas
    const datasOrdenadas = Object.keys(historico).sort();

    datasOrdenadas.forEach((data) => {
      const sensores = historico[data];
      labels.push(data);

      Object.entries(sensores).forEach(([nome, valores]) => {
        const media = (valores.max + valores.min) / 2;

        html += `
          <tr>
            <td>${data}</td>
            <td>${formatarNomeSensor(nome)}</td>
            <td>${valores.min}</td>
            <td>${valores.max}</td>
          </tr>
        `;

        if (!datasets[nome]) datasets[nome] = [];
        datasets[nome].push(media);
      });
    });

    html += "</tbody></table>";
    container.innerHTML = html;

    // === Montar gráfico ===
    const chartData = {
      labels,
      datasets: Object.entries(datasets).map(([nome, valores]) => ({
        label: formatarNomeSensor(nome),
        data: valores,
        borderColor: getCorSensor(nome),
        backgroundColor: getCorSensor(nome),
        fill: false,
        tension: 0.2,
        borderWidth: 2,
      })),
    };

    new Chart(ctx, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          title: { display: true, text: "Evolução das Leituras (Média Diária)" },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Valor" } },
          x: { title: { display: true, text: "Data" } },
        },
      },
    });
  } catch (err) {
    container.innerHTML = `<p style="color:red;">❌ Erro: ${err.message}</p>`;
    console.error(err);
  }
}

// === Funções auxiliares ===
function getCorSensor(nome) {
  const cores = {
    Reservatorio_Elevador_current: "#007bff",
    Reservatorio_Osmose_current: "#00bcd4",
    Reservatorio_CME_current: "#4caf50",
    Agua_Abrandada_current: "#9c27b0",
    Pressao_Saida_Osmose_current: "#ff9800",
    Pressao_Retorno_Osmose_current: "#f44336",
    Pressao_Saida_CME_current: "#3f51b5",
  };
  return cores[nome] || `hsl(${Math.random() * 360}, 70%, 50%)`;
}

function formatarNomeSensor(nome) {
  return nome
    .replace(/_/g, " ")
    .replace("current", "")
    .replace("Reservatorio", "Reservatório")
    .replace("Pressao", "Pressão")
    .replace("Agua", "Água")
    .trim();
}

// Inicia o carregamento ao abrir a página
carregarHistorico();

// (Opcional) Atualiza automaticamente a cada 60s
// setInterval(carregarHistorico, 60000);
