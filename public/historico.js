const API_URL = window.location.origin + "/historico";

async function carregarHistorico() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao carregar histórico");

    const historico = await res.json();
    exibirHistorico(historico);
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar histórico");
  }
}

function exibirHistorico(historico) {
  const params = new URLSearchParams(window.location.search);
  const reservatorio = params.get("reservatorio");

  const container = document.getElementById("historicoContainer");
  container.innerHTML = `<h2>Histórico — ${reservatorio}</h2>`;

  // estrutura do histórico no servidor: { timestamp, Reservatorio_Elevador_current: 12000, ... }
  const registros = historico
    .filter(h => h[reservatorio] !== undefined)
    .map(h => ({
      data: new Date(h.timestamp).toLocaleString("pt-BR"),
      valor: h[reservatorio]
    }));

  if (registros.length === 0) {
    container.innerHTML += `<p>Nenhum dado encontrado.</p>`;
    return;
  }

  const tabela = document.createElement("table");
  tabela.style.width = "100%";
  tabela.style.borderCollapse = "collapse";
  tabela.innerHTML = `
    <thead>
      <tr>
        <th style="border-bottom: 2px solid #ccc; text-align:left; padding:6px;">Data/Hora</th>
        <th style="border-bottom: 2px solid #ccc; text-align:right; padding:6px;">Leitura (L)</th>
      </tr>
    </thead>
    <tbody>
      ${registros
        .map(
          r => `
          <tr>
            <td style="border-bottom: 1px solid #eee; padding:6px;">${r.data}</td>
            <td style="border-bottom: 1px solid #eee; text-align:right; padding:6px;">${r.valor.toLocaleString()}</td>
          </tr>`
        )
        .join("")}
    </tbody>
  `;
  container.appendChild(tabela);
}

window.addEventListener("DOMContentLoaded", carregarHistorico);
