const API_URL = window.location.origin + "/historico";

async function carregarHistorico() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao buscar histórico");
    const historico = await res.json();

    const ctx = document.getElementById("grafico").getContext("2d");
    const labels = [];
    const datasets = [];
    const tabelaBody = document.querySelector("#tabela tbody");
    tabelaBody.innerHTML = "";

    const cores = [
      "#007bff", "#ff3d00", "#00c853", "#ff9800", "#9c27b0", "#009688", "#8bc34a"
    ];

    Object.entries(historico).forEach(([data, sensores]) => {
      Object.entries(sensores).forEach(([sensor, leituras], i) => {
        if (!Array.isArray(leituras)) return; // ignora formato antigo
        const valores = leituras.map(l => l.valor);
        const horas = leituras.map(l => l.hora);
        const cor = cores[i % cores.length];

        // Adiciona no gráfico
        datasets.push({
          label: sensor.replace(/_/g, " "),
          data: valores,
          borderColor: cor,
          backgroundColor: cor + "33",
          fill: false,
          tension: 0.2
        });

        if (horas.length > labels.length) labels.splice(0, labels.length, ...horas);

        // Tabela resumo (mínimo e máximo do dia)
        const min = Math.min(...valores);
        const max = Math.max(...valores);
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${data}</td>
          <td>${sensor.replace(/_/g, " ")}</td>
          <td>${min.toLocaleString()}</td>
          <td>${max.toLocaleString()}</td>
        `;
        tabelaBody.appendChild(row);
      });
    });

    // Renderiza o gráfico
    new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        stacked: false,
        plugins: {
          legend: { position: "bottom" },
          title: { display: true, text: "Evolução das Leituras Durante o Dia" }
        },
        scales: {
          y: { beginAtZero: true },
          x: { title: { display: true, text: "Horário" } }
        }
      }
    });
  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

window.addEventListener("DOMContentLoaded", carregarHistorico);
