// === Função principal ===
async function carregarHistorico() {
  const container = document.getElementById("historico");
  const ctx = document.getElementById("graficoHistorico");
  container.innerHTML = "⏳ Carregando histórico...";

  try {
    const res = await fetch("/leituras");
    if (!res.ok) throw new Error("Erro ao carregar dados");
    const dados = await res.json();

    // Filtrar últimas 24h
    const agora = Date.now();
    const ultimas24h = dados.filter(item => {
      const tempo = new Date(item.timestamp).getTime();
      return agora - tempo <= 24 * 60 * 60 * 1000;
    });

    if (ultimas24h.length === 0) {
      container.innerHTML = "<p>Nenhum dado registrado nas últimas 24 horas.</p>";
      return;
    }

    // Criar tabela
    let html = `
      <table class="tabela-historico">
        <thead>
          <tr>
            <th>Reservatório</th>
            <th>Canal</th>
            <th>Setor</th>
            <th>Leitura Atual</th>
            <th>Capacidade (%)</th>
            <th>Data/Hora</th>
          </tr>
        </thead>
        <tbody>
    `;

    ultimas24h.forEach(item => {
      html += `
        <tr>
          <td>${item.reservatorio || "-"}</td>
          <td>${item.canal || "-"}</td>
          <td>${item.setor || "-"}</td>
          <td>${item.leituraAtual || "-"}</td>
          <td>${item.capacidade || "-"}</td>
          <td>${new Date(item.timestamp).toLocaleString("pt-BR")}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;

    // === Criar gráfico com Chart.js ===
    const labels = ultimas24h.map(d => new Date(d.timestamp).toLocaleTimeString("pt-BR"));
    const valores = ultimas24h.map(d => Number(d.capacidade || 0));

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nível (%)",
            data: valores,
            borderColor: "blue",
            backgroundColor: "rgba(0, 123, 255, 0.2)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 100 },
        },
      },
    });

  } catch (err) {
    container.innerHTML = `<p style="color:red;">Erro: ${err.message}</p>`;
    console.error(err);
  }
}

carregarHistorico();
