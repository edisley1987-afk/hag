// ========================
// CONFIGURAÇÕES
// ========================
const API_URL = "/api/historico"; // ajuste se seu endpoint for diferente

// Capacidade total dos reservatórios
const CAPACIDADES = {
  Reservatorio_Elevador_current: 20000,
  Reservatorio_Osmose_current: 200
};

// Nome mostrado no gráfico e na página
const NOME_RESERVATORIOS = {
  Reservatorio_Elevador_current: "Reservatório Elevador",
  Reservatorio_Osmose_current: "Reservatório Osmose"
};

// ========================
// FUNÇÃO PRINCIPAL
// ========================
async function carregarConsumo() {
  try {
    const url = new URL(window.location.href);
    const reservatorio = url.searchParams.get("reservatorio");

    if (!reservatorio || !CAPACIDADES[reservatorio]) {
      alert("Reservatório inválido.");
      return;
    }

    const titulo = document.getElementById("tituloConsumo");
    if (titulo) titulo.innerHTML = `Consumo Diário — ${NOME_RESERVATORIOS[reservatorio]}`;

    const resposta = await fetch(API_URL);
    const dados = await resposta.json();

    exibirConsumo(dados, reservatorio);

  } catch (erro) {
    console.error("Erro ao carregar consumo diário:", erro);
  }
}

// ========================
// FILTRAR ÚLTIMOS 5 DIAS
// ========================
function filtrarUltimos5Dias(lista) {
  const agora = Date.now();
  const limite = 5 * 24 * 60 * 60 * 1000;
  return lista.filter(r => agora - new Date(r.timestamp).getTime() <= limite);
}

// ========================
// EXIBIR DADOS
// ========================
function exibirConsumo(historico, reservatorio) {
  const historicoDiv = document.getElementById("infoConsumo");
  const ctx = document.getElementById("graficoConsumo");

  if (!ctx) {
    console.error("Canvas do gráfico não encontrado.");
    return;
  }

  // Filtrar últimos 5 dias
  let registros = filtrarUltimos5Dias(historico)
    .filter(item => item[reservatorio] !== undefined)
    .map(item => ({
      data: new Date(item.timestamp),
      litros: item[reservatorio],
      ocupacao: ((item[reservatorio] / CAPACIDADES[reservatorio]) * 100).toFixed(1)
    }));

  if (registros.length === 0) {
    historicoDiv.innerHTML = "Nenhum registro nos últimos 5 dias.";
    return;
  }

  // =============================
  // ORDENAÇÃO PARA O GRÁFICO
  // Tempo: da esquerda → direita
  // antigo → novo
  // =============================
  const registrosGrafico = [...registros].sort((a, b) => a.data - b.data);

  // =============================
  // ORDENAÇÃO PARA A TABELA
  // Última atualização no topo
  // novo → antigo
  // =============================
  const registrosTabela = [...registros].sort((a, b) => b.data - a.data);

  // Atualiza texto de info
  historicoDiv.innerHTML = `
      Última atualização: <strong>${registrosTabela[0].data.toLocaleString("pt-BR")}</strong>
  `;

  // =============================
  // MONTAR GRÁFICO
  // =============================
  if (window.graficoConsumo) window.graficoConsumo.destroy();

  const labels = registrosGrafico.map(r =>
    r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  window.graficoConsumo = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Consumo (L)",
          data: registrosGrafico.map(r => r.litros),
          borderColor: "#2c8b7d",
          backgroundColor: "rgba(44,139,125,0.3)",
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // =============================
  // GERAR TABELA COM ÚLTIMO NO TOPO
  // =============================
  gerarTabela(registrosTabela);
}

// ========================
// GERAR TABELA NO HTML
// ========================
function gerarTabela(lista) {
  const tabelaDiv = document.getElementById("tabelaConsumo");

  if (!tabelaDiv) return;

  tabelaDiv.innerHTML = `
    <table class="tabela-historico">
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Leitura (L)</th>
          <th>Ocupação (%)</th>
        </tr>
      </thead>
      <tbody>
        ${lista
          .map(
            r => `
          <tr>
            <td>${r.data.toLocaleString("pt-BR")}</td>
            <td>${r.litros}</td>
            <td>${r.ocupacao}%</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// Iniciar
carregarConsumo();
