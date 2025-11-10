async function carregarHistorico() {
  const container = document.getElementById("historico");
  const ctx = document.getElementById("graficoHistorico");
  container.innerHTML = "⏳ Carregando histórico...";

  // 👉 Pega o reservatório da URL
  const params = new URLSearchParams(window.location.search);
  const reservatorio = params.get("reservatorio");

  try {
    const res = await fetch("/historico");
    if (!res.ok) throw new Error("Erro ao buscar histórico");
    const historico = await res.json();

    // Se tiver parâmetro, filtra só esse reservatório
    let dadosFiltrados = historico;
    if (reservatorio && historico[reservatorio]) {
      dadosFiltrados = { [reservatorio]: historico[reservatorio] };
    }

    if (!Object.keys(dadosFiltrados).length) {
      container.innerHTML = "<p>Nenhum dado de histórico encontrado.</p>";
      return;
    }

    // === Montar tabela de histórico diário ===
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

    const labels = [];
    const datasets = {};

    Object.entries(dadosFiltrados).forEach(([nomeSensor, dias]) => {
      Object.entries(dias).forEach(([data, valores]) => {
        html += `
          <tr>
            <td>${data}</td>
            <td>${nomeSensor}</td>
            <td>${valores.min}</td>
            <td>${valores.max}</td>
          </tr>
        `;

        if (!datasets[nomeSensor]) datasets[nomeSensor] = { labels: [], values: [] };
        datasets[nomeSensor].labels.push(data);
        datasets[nomeSensor].values.push((valores.max + valores.min) / 2);
      });
    });

    html += "</tbody></table>";
    container.innerHTML = html;

    // === Gerar gráfico ===
    const chartData = {
      labels: Object.values(datasets)[0].labels,
      datasets: Object.entries(datasets).map(([nome, info]) => ({
        label: nome,
        data: info.values,
        borderColor: getRandomColor(),
        fill: false,
        tension: 0.2
      }))
    };

    new Chart(ctx, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });

  } catch (err) {
    container.innerHTML = `<p style="color:red;">Erro: ${err.message}</p>`;
    console.error(err);
  }
}

function getRandomColor() {
  const r = Math.floor(Math.random() * 200);
  const g = Math.floor(Math.random() * 200);
  const b = Math.floor(Math.random() * 200);
  return `rgb(${r}, ${g}, ${b})`;
}

carregarHistorico();
