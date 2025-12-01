// ========================================================
// CONFIGURAÇÕES
// ========================================================
const API_HIST = "/historico";

const CAPACIDADE = {
  elevador: 20000,
  osmose: 200,
  lavanderia: 5000,
};

let grafico = null;


// ========================================================
// CARREGAR HISTÓRICO DO SERVIDOR
// ========================================================
async function carregarHistorico() {
  try {
    const resp = await fetch(API_HIST);
    const historico = await resp.json();

    if (!historico || historico.length === 0) {
      console.warn("Sem dados no histórico");
      return;
    }

    const consumo = calcularConsumoDiario(historico);

    exibirGrafico(consumo);
    preencherTabela(consumo);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}


// ========================================================
// AGRUPAR POR DIA + CALCULAR CONSUMO (SOMENTE QUEDAS)
// ========================================================
function calcularConsumoDiario(historico) {
  const dias = {};

  historico.forEach(p => {
    const dia = new Date(p.timestamp).toISOString().split("T")[0];

    if (!dias[dia]) {
      dias[dia] = { elevador: [], osmose: [], lavanderia: [] };
    }

    if (p.reservatorio === "elevador") dias[dia].elevador.push(p.valor);
    if (p.reservatorio === "osmose") dias[dia].osmose.push(p.valor);
    if (p.reservatorio === "lavanderia") dias[dia].lavanderia.push(p.valor);
  });

  return Object.keys(dias)
    .sort()
    .slice(-5)
    .map(dia => ({
      dia,
      elevador: calcularQuedas(dias[dia].elevador),
      osmose: calcularQuedas(dias[dia].osmose),
      lavanderia: calcularQuedas(dias[dia].lavanderia)
    }));
}


// ========================================================
// SOMAR APENAS QUEDAS
// ========================================================
function calcularQuedas(valores) {
  if (!valores || valores.length < 2) return 0;

  let consumo = 0;

  for (let i = 1; i < valores.length; i++) {
    const queda = valores[i - 1] - valores[i];
    if (queda > 0) consumo += queda;
  }

  return consumo;
}


// ========================================================
// EXIBIR GRÁFICO
// ========================================================
function exibirGrafico(consumo) {
  const ctx = document.getElementById("graficoConsumo").getContext("2d");

  if (grafico instanceof Chart) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "bar",
    data: {
      labels: consumo.map(c => c.dia),
      datasets: [
        {
          label: "Elevador (L)",
          data: consumo.map(c => c.elevador),
          backgroundColor: "#2c8b7d"
        },
        {
          label: "Osmose (L)",
          data: consumo.map(c => c.osmose),
          backgroundColor: "#57b3a0"
        },
        {
          label: "Lavanderia (L)",
          data: consumo.map(c => c.lavanderia),
          backgroundColor: "#8c6cff"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: {
          display: true,
          text: "Consumo Diário – Últimos 5 Dias",
          font: { size: 18 }
        }
      },
      scales: {
        y: { beginAtZero: true },
      }
    }
  });
}


// ========================================================
// PREENCHER TABELA
// ========================================================
function preencherTabela(consumo) {
  const tabela = document.getElementById("tabelaConsumo");
  tabela.innerHTML = "";

  consumo.forEach(c => {
    tabela.innerHTML += `
      <tr>
        <td>${c.dia}</td>
        <td>${c.elevador}</td>
        <td>${c.osmose}</td>
        <td>${c.lavanderia}</td>
      </tr>
    `;
  });
}


// ========================================================
// EXPORTAR PARA EXCEL
// ========================================================
function exportarExcel() {
  const tabela = document.getElementById("tabelaConsumo");
  const linhas = [];
  const cabecalho = ["Dia", "Elevador", "Osmose", "Lavanderia"];

  linhas.push(cabecalho);

  [...tabela.rows].forEach(row => {
    const cols = [...row.cells].map(c => c.innerText);
    linhas.push(cols);
  });

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consumo");

  XLSX.writeFile(wb, "consumo_diario.xlsx");
}


// ========================================================
// EXPORTAR PARA PDF
// ========================================================
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(18);
  doc.text("Relatório de Consumo Diário", 14, 20);

  const tabela = document.getElementById("tabelaConsumo");
  const linhas = [];
  const cabecalho = ["Dia", "Elevador", "Osmose", "Lavanderia"];

  [...tabela.rows].forEach(row => {
    const cols = [...row.cells].map(c => c.innerText);
    linhas.push(cols);
  });

  doc.autoTable({
    head: [cabecalho],
    body: linhas,
    startY: 30,
    theme: "grid",
    headStyles: { fillColor: [0, 123, 131] }
  });

  doc.save("consumo_diario.pdf");
}


// ========================================================
// INICIAR AO CARREGAR A PÁGINA
// ========================================================
window.addEventListener("load", () => {
  carregarHistorico();
});
