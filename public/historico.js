// ======= historico.js =======
// Página de histórico com porcentagem no gráfico e na tabela

const RESERVATORIOS_INFO = {
  "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000 },
  "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200 },
  "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000 },
  "Reservatorio_Agua_Abrandada_current": { nome: "Água Abrandada", capacidade: 9000 }
};

let graficoHistorico = null;

// =========================================
// CARREGAR LISTA DE RESERVATÓRIOS
// =========================================
async function carregarListaReservatorios() {
  const select = document.getElementById("selectReservatorio");

  try {
    const resp = await fetch("/lista");
    const lista = await resp.json();

    select.innerHTML = "";

    if (!lista.length) {
      select.innerHTML = `<option value="">Nenhum reservatório encontrado</option>`;
      return;
    }

    select.innerHTML = `<option value="">Selecione um reservatório...</option>`;

    // CORREÇÃO ⬇⬇⬇
    lista
      .filter(ref => RESERVATORIOS_INFO[ref])   // só reservatórios
      .forEach(ref => {
        const nome = RESERVATORIOS_INFO[ref].nome;
        select.innerHTML += `<option value="${ref}">${nome}</option>`;
      });

  } catch (err) {
    console.error("Erro ao carregar lista:", err);
    select.innerHTML = `<option value="">Erro ao carregar</option>`;
  }
}

// =========================================
// CARREGAR HISTÓRICO INDIVIDUAL
// =========================================
async function carregarHistoricoReservatorio(ref) {
  if (!ref) return;

  const capacidade = RESERVATORIOS_INFO[ref]?.capacidade || 100;

  try {
    const resp = await fetch(`/historico/${ref}`);
    const historico = await resp.json();

    if (!historico.length) {
      montarTabela([]);
      exibirGrafico([], capacidade);
      return;
    }

    const dadosGrafico = historico.map(reg => ({
      horario: new Date(reg.horario).toLocaleString("pt-BR"),
      litros: reg.valor,
      porcentagem: ((reg.valor / capacidade) * 100).toFixed(1)
    }));

    exibirGrafico(dadosGrafico, capacidade);
    montarTabela(dadosGrafico);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

// =========================================
// EXIBIR GRÁFICO
// =========================================
function exibirGrafico(dados, capacidade) {
  const ctx = document.getElementById("graficoHistorico").getContext("2d");

  if (graficoHistorico instanceof Chart) {
    graficoHistorico.destroy();
  }

  graficoHistorico = new Chart(ctx, {
    type: "line",
    data: {
      labels: dados.map(d => d.horario),
      datasets: [
        {
          label: "Litros",
          data: dados.map(d => d.litros),
          borderColor: "#2c8b7d",
          borderWidth: 3,
          tension: 0.3
        },
        {
          label: "% do Reservatório",
          data: dados.map(d => d.porcentagem),
          borderColor: "#57b3a0",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          yAxisID: "percentual"
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        litros: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          max: capacidade,
          title: { display: true, text: "Litros" }
        },
        percentual: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          max: 100,
          title: { display: true, text: "Porcentagem (%)" }
        }
      }
    }
  });
}

// =========================================
// MONTAR TABELA
// =========================================
function montarTabela(dados) {
  const tbody = document.querySelector("#tabelaHistorico tbody");
  tbody.innerHTML = "";

  if (!dados.length) {
    tbody.innerHTML = "<tr><td colspan='3'>Nenhum dado disponível</td></tr>";
    return;
  }

  dados.forEach(d => {
    tbody.innerHTML += `
      <tr>
        <td>${d.horario}</td>
        <td>${d.litros} L</td>
        <td>${d.porcentagem}%</td>
      </tr>
    `;
  });
}

// =========================================
// EVENTOS
// =========================================
document.getElementById("selectReservatorio").addEventListener("change", (e) => {
  carregarHistoricoReservatorio(e.target.value);
});

document.getElementById("botaoConsumo").addEventListener("click", () => {
  window.location.href = "consumo.html";
});

window.addEventListener("load", () => {
  carregarListaReservatorios();
});
