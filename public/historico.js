const API_HIST = "/historico";
const select = document.getElementById("reservatorioSelect");
const tabela = document.getElementById("tabelaHistorico");

async function carregarHistorico() {
  try {
    const resposta = await fetch(API_HIST);
    const dados = await resposta.json();

    if (!Array.isArray(dados)) {
      console.error("Formato inválido:", dados);
      return;
    }

    const reservatorio = select.value;

    // Filtra apenas o reservatório selecionado
    const filtrado = dados.filter(d => d.reservatorio === reservatorio);

    // Ordena por timestamp
    filtrado.sort((a, b) => a.timestamp - b.timestamp);

    atualizarTabela(filtrado);

  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);
  }
}

function atualizarTabela(lista) {
  tabela.innerHTML = "";

  if (!lista.length) {
    tabela.innerHTML = "<tr><td colspan='3'>Nenhum dado encontrado.</td></tr>";
    return;
  }

  for (const item of lista) {
    const dataHora = new Date(item.timestamp).toLocaleString("pt-BR");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dataHora}</td>
      <td>${item.valor}</td>
      <td>${item.reservatorio}</td>
    `;
    tabela.appendChild(tr);
  }
}

select.addEventListener("change", carregarHistorico);

// Carregar ao abrir a página
carregarHistorico();
