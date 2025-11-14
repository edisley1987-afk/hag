// ================================
// HISTÓRICO — HAG (COMPLETO)
// ================================

const API_URL = window.location.origin;

// Capacidades dos reservatórios
const CAPACIDADES = {
  "Reservatorio_Elevador_current": 20000,
  "Reservatorio_Osmose_current": 200,
  "Reservatorio_CME_current": 1000,
  "Reservatorio_Abrandada_current": 9000
};

// Elementos do DOM
const select = document.getElementById("selectReservatorio");
const tabela = document.querySelector("#tabelaHistorico tbody");
const canvas = document.getElementById("graficoHistorico");

let grafico = null;


// ================================
// 1) Carregar lista
// ================================
async function carregarLista() {
  try {
    const resp = await fetch(`${API_URL}/historico/lista`);
    const lista = await resp.json();

    select.innerHTML = `<option value="">Selecione...</option>`;

    lista.forEach(r => {
      const op = document.createElement("option");
      op.value = r;
      op.textContent = r.replace("_current", "").replace(/_/g, " ");
      select.appendChild(op);
    });

  } catch (err) {
    console.error("Erro ao carregar lista:", err);
  }
}


// ================================
// 2) Carregar histórico
// ================================
async function carregarHistorico(res) {
  if (!res) return;

  try {
    const resp = await fetch(`${API_URL}/historico/${res}`);
    const dados = await resp.json();

    atualizarTabela(dados, res);
    atualizarGrafico(dados, res);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}


// ================================
// 3) Atualizar tabela
// ================================
function atualizarTabela(dados, ref) {
  tabela.innerHTML = "";

  const capacidade = CAPACIDADES[ref] || 1;

  dados.forEach(item => {
    const pct = ((item.valor / capacidade) * 100).toFixed(1);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(item.horario).toLocaleString("pt-BR")}</td>
      <td>${item.valor} L</td>
      <td>${pct}%</td>
    `;

    tabela.appendChild(tr);
  });
}


// ================================
// 4) Atualizar gráfico
// ================================
function atualizarGrafico(dados, ref) {
  const capacidade = CAPACIDADES[ref] || 1;

  const labels = dados.map(i => new Date(i.horario).toLocaleString("pt-BR"));
  const litros = dados.map(i => i.valor);
  const porcentagem = dados.map(i => ((i.valor / capacidade) * 100).toFixed(1));

  const ctx = canvas.getContext("2d");

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Litros",
          data: litros,
          borderColor: "#2c8b7d",
          backgroundColor: "rgba(44,139,125,0.25)",
          borderWidth: 3,
          pointRadius: 3,
          yAxisID: "yLitros"
        },
        {
          label: "Porcentagem (%)",
          data: porcentagem,
          borderColor: "#256f64",
          backgroundColor: "rgba(37,111,100,0.25)",
          borderWidth: 3,
          pointRadius: 3,
          yAxisID: "yPct"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yLitros: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Litros" },
          suggestedMax: capacidade
        },
        yPct: {
          type: "linear",
          position: "right",
          min: 0,
          max: 100,
          title: { display: true, text: "Percentual (%)" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}


// ================================
// 5) Mudança de seleção
// ================================
select.addEventListener("change", () => {
  carregarHistorico(select.value);
});

// ================================
// 6) Inicialização
// ================================
carregarLista();
