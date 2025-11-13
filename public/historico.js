const API_URL = window.location.origin + "/historico";
const CAPACIDADES = {
  "Reservatorio_Elevador_current": 20000,
  "Reservatorio_Osmose_current": 200,
  "Reservatorio_CME_current": 1000,
  "Reservatorio_Agua_Abrandada_current": 9000,
};

const NOMES = {
  "Reservatorio_Elevador_current": "Reservatório Elevador",
  "Reservatorio_Osmose_current": "Reservatório Osmose",
  "Reservatorio_CME_current": "Reservatório CME",
  "Reservatorio_Agua_Abrandada_current": "Água Abrandada",
};

let chart;

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("reservatorioSelect");
  select.addEventListener("change", () => carregarHistorico(select.value));

  carregarHistorico(select.value);
});

async function carregarHistorico(reservatorio) {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao carregar histórico");
    const historico = await res.json();

    const ultimas24h = filtrarUltimas24h(historico);
    const registros = ultimas24h
      .filter(h => h[reservatorio] !== undefined)
      .map(h => ({
        data: new Date(h.timestamp),
        litros: h[reservatorio]
      }));

    exibirHistorico(reservatorio, registros);
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar histórico");
  }
}

function filtrarUltimas24h(dados) {
  const agora = Date.now();
  return dados.filter(d => agora - new Date(d.timestamp).getTime() <= 24 * 60 * 60 * 1000);
}

function exibirHistorico(reservatorio, registros) {
  const container = document.getElementById("historicoContainer");
  const nome = NOMES[reservatorio] || reservatorio;
  const capacidade = CAPACIDADES[reservatorio] || 1;

  document.getElementById("tituloHistorico").textContent = `Histórico — ${nome}`;

  if (registros.length === 0) {
    container.innerHTML = `<p>Nenhum dado encontrado nas últimas 24 horas.</p>`;
    return;
  }

  // === GRAFICO ===
  const ctx = document.getElementById("grafico").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: registros.map(r => r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })),
      datasets: [{
        label: `${nome} (L)`,
        data: registros.map(r => r.litros),
        borderColor: "#004b8d",
        backgroundColor: "rgba(0, 75, 141, 0.15)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: capacidade
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // === TABELA (apenas mudanças >5%) ===
  let linhas = [];
  let anterior = registros[0].litros;
  linhas.push(gerarLinha(registros[0], capacidade));

  for (let i = 1; i < registros.length; i++) {
    const diff = Math.abs(((registros[i].litros - anterior) / capacidade) * 100);
    if (diff >= 5) {
      linhas.push(gerarLinha(registros[i], capacidade));
      anterior = registros[i].litros;
    }
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Data/Hora</th><th>Leitura (L)</th><th>Ocupação (%)</th></tr>
      </thead>
      <tbody>${linhas.join("")}</tbody>
    </table>`;
}

function gerarLinha(registro, capacidade) {
  const ocupacao = ((registro.litros / capacidade) * 100).toFixed(1);
  return `<tr>
    <td>${registro.data.toLocaleString("pt-BR")}</td>
    <td>${registro.litros.toLocaleString("pt-BR")}</td>
    <td>${ocupacao}%</td>
  </tr>`;
}
