// === CONFIGURAÇÕES ===

// Agora aponta para o JSON correto e não para o arquivo HTML
const API_URL = window.location.origin + "/historico_dados";

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

let meuGrafico = null;


// === CARREGAR HISTÓRICO ===
async function carregarHistorico() {
  try {
    const res = await fetch(API_URL);

    // agora sempre é JSON válido
    const historico = await res.json();

    atualizarReservatorioSelect(historico);

  } catch (err) {
    console.error(err);
    alert("Erro ao carregar histórico");
  }
}


// === MONTAR SELECT ===
function atualizarReservatorioSelect(historico) {
  const select = document.getElementById("reservatorioSelect");

  select.innerHTML = Object.entries(NOME_RESERVATORIOS)
    .map(([key, nome]) => `<option value="${key}">${nome}</option>`)
    .join("");

  const params = new URLSearchParams(window.location.search);
  const reservatorio = params.get("reservatorio") || Object.keys(NOME_RESERVATORIOS)[0];

  select.value = reservatorio;

  // exibir inicialmente
  exibirHistorico(historico, reservatorio);

  // alterar quando trocar o select
  select.addEventListener("change", () => {
    exibirHistorico(historico, select.value);
  });
}


// === FILTRAR ÚLTIMAS 24H ===
function filtrarUltimas24h(historico) {
  const agora = new Date();
  return historico.filter(h => (agora - new Date(h.timestamp)) / 3600000 <= 24);
}


// === EXIBIR GRÁFICO E TABELA ===
function exibirHistorico(historico, reservatorio) {
  const nome = NOME_RESERVATORIOS[reservatorio];
  document.getElementById("tituloHistorico").textContent = `Histórico — ${nome}`;

  const container = document.getElementById("historicoContainer");

  const ultimas24h = filtrarUltimas24h(historico);

  let registros = ultimas24h
    .filter(h => h[reservatorio] !== undefined)
    .map(h => ({
      data: new Date(h.timestamp),
      litros: h[reservatorio],
      ocupacao: ((h[reservatorio] / CAPACIDADES[reservatorio]) * 100).toFixed(1)
    }))
    .reverse();

  if (registros.length === 0) {
    container.innerHTML = `<p>Nenhum dado encontrado nas últimas 24 horas.</p>`;
    if (meuGrafico) meuGrafico.destroy();
    return;
  }

  // === GRÁFICO ===
  const ctx = document.getElementById("grafico").getContext("2d");

  if (meuGrafico) meuGrafico.destroy();

  const labels = registros.map(r =>
    r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  meuGrafico = new Chart(ctx, {
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
          fill: true,
          yAxisID: "litros"
        },
        {
          label: "Ocupação (%)",
          data: registros.map(r => r.ocupacao),
          borderColor: "#53B2A8",
          backgroundColor: "rgba(83,178,168,0.15)",
          tension: 0.4,
          fill: false,
          borderDash: [4, 4],
          yAxisID: "porcentagem"
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        litros: {
          type: "linear",
          position: "left",
          min: 0,
          max: CAPACIDADES[reservatorio],
          title: { display: true, text: "Litros" }
        },
        porcentagem: {
          type: "linear",
          position: "right",
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Ocupação (%)" }
        }
      }
    }
  });

  // === TABELA ===
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Litros</th>
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


// === INICIAR ===
window.addEventListener("DOMContentLoaded", carregarHistorico);
