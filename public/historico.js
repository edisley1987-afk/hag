// =====================
// HISTÓRICO — HAG
// =====================

// URLs automáticas baseadas no servidor
const API_URL = window.location.origin + "/historico";

// Seletores
const selectReservatorio = document.getElementById("selectReservatorio");
const botaoConsumo = document.getElementById("botaoConsumo");
const ctx = document.getElementById("graficoHistorico");

// =====================
// BOTÃO: Consumo Diário
// =====================
if (botaoConsumo) {
  botaoConsumo.addEventListener("click", () => {
    window.location.href = "consumo_diario.html";
  });
}

// =====================
// Carregar lista de reservatórios
// =====================
async function carregarReservatorios() {
  try {
    const resp = await fetch(API_URL + "/lista");
    const data = await resp.json();

    selectReservatorio.innerHTML = `<option value="">Selecione...</option>`;

    Object.keys(data).forEach(id => {
      selectReservatorio.innerHTML += `
        <option value="${id}">${data[id].nome}</option>
      `;
    });

  } catch (err) {
    console.error("Erro ao carregar lista:", err);
  }
}

// =====================
// Carregar histórico e gerar gráfico
// =====================
let grafico = null;

async function carregarHistorico() {
  const id = selectReservatorio.value;
  if (!id) return;

  try {
    const resp = await fetch(`${API_URL}/${id}`);
    const data = await resp.json();

    const labels = data.map(item => item.hora);
    const valores = data.map(item => item.litros);

    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Litros",
          data: valores,
          fill: true,
          tension: 0.2
        }]
      }
    });

  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);
  }
}

// =====================
// EVENTOS
// =====================
selectReservatorio.addEventListener("change", carregarHistorico);

// =====================
// INICIAR
// =====================
carregarReservatorios();
