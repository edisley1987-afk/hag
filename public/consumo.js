// ============================
// CONFIGURAÇÕES
// ============================
const API_HIST = "/historico";

let graficoHistorico;

// ============================
// FUNÇÃO PRINCIPAL
// ============================
window.addEventListener("load", () => {
  carregarHistorico();
});

// ============================
// BUSCAR HISTÓRICO NO SERVIDOR
// ============================
async function carregarHistorico() {
  try {
    const resp = await fetch(API_HIST);
    const historico = await resp.json();

    if (!historico || !historico.length) {
      mostrarAviso("Sem dados para exibir.");
      return;
    }

    const consumo = calcularConsumoDiario(historico);
    exibirGrafico(consumo);
    preencherTabela(consumo);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
    mostrarAviso("Erro ao carregar dados.");
  }
}

function mostrarAviso(msg) {
  document.getElementById("graficoHistorico").outerHTML =
    `<p style='text-align:center; font-size:18px; color:gray;'>${msg}</p>`;
}

// ============================
// CÁLCULO DE CONSUMO — SOMENTE QUEDAS
// ============================
function calcularQuedas(valores) {
  if (!valores || valores.length < 2) return 0;

  let consumo = 0;

  for (let i = 1; i < valores.length; i++) {
    const queda = valores[i - 1] - valores[i];
    if (queda > 0) consumo += queda; // soma somente quedas reais
  }

  return consumo;
}

// ============================
// AGRUPAR HISTÓRICO POR DIA
// ============================
function calcularConsumoDiario(historico) {
  const dias = {};

  historico.forEach(p => {
    const dia = new Date(p.timestamp).toISOString().split("T")[0];

    if (!dias[dia]) {
      dias[dia] = {
        elevador: [],
        osmose: [],
        lavanderia: [],
        cme: [],
        abrandada: []
      };
    }

    // Agrupamento por reservatório
    if (p.reservatorio === "elevador") dias[dia].elevador.push(p.valor);
    if (p.reservatorio === "osmose") dias[dia].osmose.push(p.valor);
    if (p.reservatorio === "lavanderia") dias[dia].lavanderia.push(p.valor);
    if (p.reservatorio === "cme") dias[dia].cme.push(p.valor);
    if (p.reservatorio === "abrandada") dias[dia].abrandada.push(p.valor);
  });

  // Montar consumo somando somente quedas
  return Object.keys(dias)
    .sort()
    .map(dia => ({
      dia,
      elevador: calcularQuedas(dias[dia].elevador),
      osmose: calcularQuedas(dias[dia].osmose),
      lavanderia: calcularQuedas(dias[dia].lavanderia),
      cme: calcularQuedas(dias[dia].cme),
      abrandada: calcularQuedas(dias[dia].abrandada)
    }));
}

// ============================
// EXIBIR GRÁFICO
// ============================
function exibirGrafico(consumo) {
  const ctx = document.getElementById("graficoHistorico").getContext("2d");

  if (graficoHistorico instanceof Chart) graficoHistorico.destroy();

  graficoHistorico = new Chart(ctx, {
    type: "bar",
    data: {
      labels: consumo.map(d => d.dia),
      datasets: [
        {
          label: "Elevador",
          data: consumo.map(d => d.elevador),
          backgroundColor: "#3498db"
        },
        {
          label: "Osmose",
          data: consumo.map(d => d.osmose),
          backgroundColor: "#2ecc71"
        },
        {
          label: "Lavanderia",
          data: consumo.map(d => d.lavanderia),
          backgroundColor: "#9b59b6"
        },
        {
          label: "CME",
          data: consumo.map(d => d.cme),
          backgroundColor: "#f1c40f"
        },
        {
          label: "Abrandada",
          data: consumo.map(d => d.abrandada),
          backgroundColor: "#e67e22"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Consumo Diário — Somente Quedas Reais",
          font: { size: 20 }
        },
        legend: { position: "top" }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Litros Consumidos" }
        },
        x: {
          title: { display: true, text: "Dia" }
        }
      }
    }
  });
}

// ============================
// TABELA DE CONSUMO
// ============================
function preencherTabela(consumo) {
  const tabela = document.getElementById("tabelaConsumo");
  tabela.innerHTML = "";

  consumo.forEach(d => {
    tabela.innerHTML += `
      <tr>
        <td>${d.dia}</td>
        <td>${d.elevador} L</td>
        <td>${d.osmose} L</td>
        <td>${d.lavanderia} L</td>
        <td>${d.cme} L</td>
        <td>${d.abrandada} L</td>
      </tr>
    `;
  });
}
