const API_URL = "/dados_historico"; // ajuste se necessário

let grafico;
const ctx = document.getElementById("grafico").getContext("2d");
const selRes = document.getElementById("reservatorioSelect");
const resumoList = document.getElementById("resumoList");

window.onload = async () => {
  await carregarListaReservatorios();
  await carregarHistorico();
};

document.getElementById("btnAtualizar").onclick = carregarHistorico;
document.getElementById("btnExportar").onclick = exportarCSV;

/* ============================
   1) Carregar lista de opções
=============================== */
async function carregarListaReservatorios() {
  const lista = [
    "elevador",
    "osmose",
    "cme",
    "abrandada",
    "pressao_osmose"
  ];

  lista.forEach(r => {
    const op = document.createElement("option");
    op.value = r;
    op.textContent = r.charAt(0).toUpperCase() + r.slice(1);
    selRes.appendChild(op);
  });
}

/* ============================
   2) Carregar histórico
=============================== */
async function carregarHistorico() {
  const reservatorio = selRes.value;

  const resp = await fetch(`${API_URL}?reservatorio=${reservatorio}`);
  const dados = await resp.json();

  if (!Array.isArray(dados)) {
    console.error("ERRO: histórico inválido", dados);
    return;
  }

  atualizarResumo(dados);
  atualizarGrafico(dados, reservatorio);
}

/* ============================
   3) Gerar resumo
=============================== */
function atualizarResumo(dados) {
  resumoList.innerHTML = "";

  const valores = dados.map(d => d.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const media = (valores.reduce((a,b) => a+b, 0) / valores.length).toFixed(1);
  const ultimo = valores[valores.length - 1];
  const consumo24h = Math.max(0, ultimo - min);

  const linhas = [
    `Min: ${min} L`,
    `Máx: ${max} L`,
    `Média: ${media} L`,
    `Última: ${ultimo} L`,
    `Consumo (24h): ${consumo24h} L`
  ];

  linhas.forEach(txt => {
    const li = document.createElement("li");
    li.textContent = txt;
    resumoList.appendChild(li);
  });
}

/* ============================
   4) Atualizar gráfico
=============================== */
function atualizarGrafico(dados, nome) {
  const labels = dados.map(d => d.hora);
  const valores = dados.map(d => d.valor);

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Nível (L)",
          data: valores,
          borderWidth: 3,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" }
      },
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

/* ============================
   5) Exportar CSV
=============================== */
async function exportarCSV() {
  const reservatorio = selRes.value;
  window.location = `/exportar_csv?reservatorio=${reservatorio}`;
}
