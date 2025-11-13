const API_URL = window.location.origin + "/historico";

const NOME_RESERVATORIOS = {
  "Reservatorio_Elevador_current": "Reservatório Elevador",
  "Reservatorio_Osmose_current": "Reservatório Osmose",
  "Reservatorio_CME_current": "Reservatório CME",
  "Reservatorio_Agua_Abrandada_current": "Água Abrandada"
};

const CAPACIDADES = {
  "Reservatorio_Elevador_current": 20000,
  "Reservatorio_Osmose_current": 200,
  "Reservatorio_CME_current": 1000,
  "Reservatorio_Agua_Abrandada_current": 9000
};

async function carregarHistorico() {
  try {
    const res = await fetch(API_URL);
    const historico = await res.json();
    atualizarReservatorioSelect(historico);
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar histórico");
  }
}

function atualizarReservatorioSelect(historico) {
  const select = document.getElementById("reservatorioSelect");
  select.innerHTML = Object.entries(NOME_RESERVATORIOS)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");

  const params = new URLSearchParams(window.location.search);
  const reservatorio = params.get("reservatorio") || Object.keys(NOME_RESERVATORIOS)[0];
  select.value = reservatorio;
  exibirHistorico(historico, reservatorio);

  select.addEventListener("change", () => {
    exibirHistorico(historico, select.value);
  });
}

function filtrarUltimas24h(historico) {
  const agora = new Date();
  return historico.filter(h => (agora - new Date(h.timestamp)) / 3600000 <= 24);
}

function exibirHistorico(historico, reservatorio) {
  const nomeReservatorio = NOME_RESERVATORIOS[reservatorio];
  document.getElementById("tituloHistorico").textContent = `Histórico — ${nomeReservatorio}`;

  const container = document.getElementById("historicoContainer");
  const ultimas24h = filtrarUltimas24h(historico);

  const registros = ultimas24h
    .filter(h => h[reservatorio] !== undefined)
    .map(h => ({
      data: new Date(h.timestamp),
      litros: h[reservatorio],
      ocupacao: ((h[reservatorio] / CAPACIDADES[reservatorio]) * 100).toFixed(1)
    }));

  if (registros.length === 0) {
    container.innerHTML = `<p>Nenhum dado encontrado nas últimas 24 horas.</p>`;
    if (window.meuGrafico) window.meuGrafico.destroy();
    return;
  }

  // === Gráfico ===
  const ctx = document.getElementById("grafico").getContext("2d");
  if (window.meuGrafico) window.meuGrafico.destroy();

  const labels = registros.map(r =>
    r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  window.meuGrafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Volume (L)",
          data: registros.map(r => r.litros),
          borderColor: "#146C60",
          backgroundColor: "rgba(20,108,96,0.15)",
          tension: 0.4,
          yAxisID: "litros",
          fill: true
        },
        {
          label: "Ocupação (%)",
          data: registros.map(r => r.ocupacao),
          borderColor: "#53B2A8",
          backgroundColor: "rgba(83,178,168,0.15)",
          tension: 0.4,
          yAxisID: "porcentagem",
          fill: false,
          borderDash: [4, 4]
        },
        {
          label: "Nível Máximo",
          data: Array(registros.length).fill(CAPACIDADES[reservatorio]),
          borderColor: "rgba(255,99,132,0.7)",
          borderDash: [8, 6],
          pointRadius: 0,
          borderWidth: 2,
          yAxisID: "litros"
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        litros: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Litros", color: "#146C60" },
          min: 0,
          max: CAPACIDADES[reservatorio],
          ticks: { color: "#146C60" }
        },
        porcentagem: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Ocupação (%)", color: "#53B2A8" },
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: { color: "#53B2A8" }
        },
        x: {
          title: { display: true, text: "Horário", color: "#555" },
          ticks: { color: "#555" }
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#146C60", font: { size: 13 } }
        },
        title: {
          display: true,
          text: nomeReservatorio,
          color: "#146C60",
          font: { size: 20, weight: "bold" }
        }
      }
    }
  });

  // === Tabela ===
  container.innerHTML = `
    <table class="tabela-historico">
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Leitura (L)</th>
          <th>Ocupação (%)</th>
        </tr>
      </thead>
      <tbody>
        ${registros.map(r => `
          <tr>
            <td>${r.data.toLocaleString("pt-BR")}</td>
            <td>${r.litros.toLocaleString("pt-BR")}</td>
            <td>${r.ocupacao}%</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

window.addEventListener("DOMContentLoaded", carregarHistorico);
