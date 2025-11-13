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
    return;
  }

  // === GERA GRÁFICO ===
  const ctx = document.getElementById("grafico").getContext("2d");
  if (window.meuGrafico) window.meuGrafico.destroy();

  const labels = registros.map(r => r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

  window.meuGrafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Volume (L)",
          data: registros.map(r => r.litros),
          borderColor: "#004b8d",
          backgroundColor: "rgba(0,75,141,0.2)",
          yAxisID: "litros"
        },
        {
          label: "Ocupação (%)",
          data: registros.map(r => r.ocupacao),
          borderColor: "#00b894",
          backgroundColor: "rgba(0,184,148,0.2)",
          yAxisID: "porcentagem"
        }
      ]
    },
    options: {
      scales: {
        litros: { type: "linear", position: "left", title: { display: true, text: "Litros" } },
        porcentagem: { type: "linear", position: "right", title: { display: true, text: "%" }, min: 0, max: 100 }
      }
    }
  });

  // === TABELA ===
  container.innerHTML = `
    <table border="1" style="margin-top:20px; width:100%; border-collapse:collapse;">
      <thead>
        <tr><th>Data/Hora</th><th>Leitura (L)</th><th>Ocupação (%)</th></tr>
      </thead>
      <tbody>
        ${registros.map(r => `
          <tr>
            <td>${r.data.toLocaleString("pt-BR")}</td>
            <td>${r.litros.toLocaleString()}</td>
            <td>${r.ocupacao}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  `;
}

window.addEventListener("DOMContentLoaded", carregarHistorico);
