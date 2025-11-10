async function carregarHistorico() {
  const container = document.getElementById("historico");
  const ctx = document.getElementById("graficoHistorico");
  container.innerHTML = "⏳ Carregando histórico...";

  try {
    const res = await fetch("/historico");
    if (!res.ok) throw new Error("Erro ao buscar histórico");
    const historico = await res.json();

    if (!Object.keys(historico).length) {
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

    Object.entries(historico).forEach(([data, sensores]) => {
      labels.push(data);

      Object.entries(sensores).forEach(([nome, valores]) => {
        html += `
          <tr>
            <td>${data}</td>
            <td>${nome}</td>
            <td>${valores.min}</td>
            <td>${valores.max}</td>
          </tr>
        `;

        // Prepara dados para o gráfico
        if (!datasets[nome]) datasets[nome] = [];
        datasets[nome].push((valores.max + valores.min) / 2); // média do dia
      });
    });

    html += "</tbody></table>";
    container.innerHTML = html;

    // === Gerar gráfico ===
    const chartData = {
      labels,
      datasets: Object.entries(datasets).map(([nome, valores]) => ({
        label: nome,
        data: valores,
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
