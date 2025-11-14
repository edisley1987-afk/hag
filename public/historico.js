// =========================
//  HISTÓRICO — HAG (VERSÃO CORRIGIDA)
// =========================

const API_URL = window.location.origin;

// Elementos do DOM
const select = document.getElementById("selectReservatorio");
const tabela = document.querySelector("#tabelaHistorico tbody");
const canvas = document.getElementById("graficoHistorico");

// 🔥 LIMITE DO TAMANHO DO GRÁFICO — impede ficar gigante
canvas.style.height = "350px";

let grafico = null;

// =========================
//  1) Carregar lista de reservatórios
// =========================
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

// =========================
//  2) Carregar histórico
// =========================
async function carregarHistorico(reservatorio) {
  if (!reservatorio) return;

  try {
    const resp = await fetch(`${API_URL}/historico/${reservatorio}`);
    const dados = await resp.json();

    atualizarTabela(dados);
    atualizarGrafico(dados, reservatorio);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

// =========================
//  3) Atualizar tabela
// =========================
function atualizarTabela(dados) {
  tabela.innerHTML = "";

  dados.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${new Date(item.horario).toLocaleString("pt-BR")}</td>
      <td>${item.valor}</td>
    `;

    tabela.appendChild(tr);
  });
}

// =========================
//  4) Atualizar gráfico
// =========================
function atualizarGrafico(dados, ref) {
  const labels = dados.map(i =>
    new Date(i.horario).toLocaleString("pt-BR")
  );

  const valores = dados.map(i => i.valor);

  const ctx = canvas.getContext("2d");

  // Destruir gráfico anterior
  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: ref.replace("_current", "").replace(/_/g, " "),
        data: valores,
        borderWidth: 3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false  // ESSENCIAL para respeitar a altura definida
    }
  });
}

// =========================
//  5) Evento de troca
// =========================
select.addEventListener("change", () => {
  carregarHistorico(select.value);
});

// =========================
//  6) Início
// =========================
carregarLista();
