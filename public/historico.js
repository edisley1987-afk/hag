const API_URL = "/dados-historico";  // CORRIGIDO

document.getElementById("btnCarregar").addEventListener("click", carregarHistorico);

async function carregarHistorico() {
  const reservatorio = document.getElementById("reservatorioSelect").value;
  const data = document.getElementById("dataSelect").value;

  if (!data) {
    alert("Selecione uma data.");
    return;
  }

  try {
    const url = `${API_URL}?reservatorio=${reservatorio}&data=${data}`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
      throw new Error(`Erro HTTP ${resposta.status}`);
    }

    const dados = await resposta.json();

    desenharGrafico(dados);
    gerarTabela(dados);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
    alert("Não foi possível carregar o histórico.");
  }
}

let graficoAtual = null;

function desenharGrafico(dados) {
  const ctx = document.getElementById("grafico").getContext("2d");

  if (graficoAtual) graficoAtual.destroy();

  graficoAtual = new Chart(ctx, {
    type: "line",
    data: {
      labels: dados.map(p => p.hora),
      datasets: [{
        label: "Nível (L)",
        data: dados.map(p => p.valor),
        borderWidth: 3,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function gerarTabela(dados) {
  if (dados.length === 0) {
    document.getElementById("tabelaContainer").innerHTML = "<p>Nenhum dado disponível.</p>";
    return;
  }

  let html = `
    <table>
      <tr>
        <th>Hora</th>
        <th>Nível (L)</th>
      </tr>
  `;

  dados.forEach(p => {
    html += `
      <tr>
        <td>${p.hora}</td>
        <td>${p.valor}</td>
      </tr>
    `;
  });

  html += "</table>";

  document.getElementById("tabelaContainer").innerHTML = html;
}
