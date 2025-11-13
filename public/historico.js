const API_URL = window.location.origin + "/historico";

const NOMES = {
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
    if (!res.ok) throw new Error("Erro ao carregar histórico");
    const historico = await res.json();
    exibirHistorico(historico);
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar histórico");
  }
}

function filtrarUltimas24h(historico) {
  const agora = new Date();
  return historico.filter(h => (agora - new Date(h.timestamp)) / 3600000 <= 24);
}

function exibirHistorico(historico) {
  const params = new URLSearchParams(window.location.search);
  const reservatorio = params.get("reservatorio");
  const nomeReservatorio = NOMES[reservatorio] || reservatorio;
  document.getElementById("tituloHistorico").textContent = `Histórico — ${nomeReservatorio}`;

  const container = document.getElementById("historicoContainer");
  const ultimas24h = filtrarUltimas24h(historico);

  const registros = ultimas24h
    .filter(h => h[reservatorio] !== undefined)
    .map(h => ({
      data: new Date(h.timestamp),
      litros: h[reservatorio],
      porcentagem: ((h[reservatorio] / CAPACIDADES[reservatorio]) * 100).toFixed(1)
    }));

  if (registros.length === 0) {
    container.innerHTML = `<p>Nenhum dado encontrado nas últimas 24 horas.</p>`;
    return;
  }

  const ctx = document.getElementById("grafico").getContext("2d");
  if (window.meuGrafico) window.meuGrafico.destroy();

  window.meuGrafico = new Chart(ctx, {
    type: "line",
    data: {
      labels: registros.map(r => r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })),
      datasets: [{
        label: "Leitura (L)",
        data: registros.map(r => r.litros),
        borderColor: "#004b8d",
        backgroundColor: "rgba(0,75,141,0.25)",
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Hora" } },
        y: {
          title: { display: true, text: "Litros" },
          beginAtZero: true
        }
      }
    }
  });

  container.innerHTML = `
    <table>
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
            <td>${r.litros.toLocaleString()}</td>
            <td>${r.porcentagem}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

window.addEventListener("DOMContentLoaded", carregarHistorico);
