// ======= consumo.js =======
// Página de gráfico de consumo diário (Elevador e Osmose)

async function carregarConsumo() {
  try {
    const resp = await fetch("/historico");
    const historico = await resp.json();

    // ---- Se não houver dados ----
    if (!historico.length) {
      const canvas = document.getElementById("graficoConsumo");

      if (window.graficoConsumo instanceof Chart) {
        window.graficoConsumo.destroy();
      }

      canvas.parentElement.innerHTML =
        "<p style='text-align:center; color:gray; font-size:18px;'>Ainda não há dados suficientes para gerar o gráfico de consumo diário.</p>";

      return;
    }

    const consumoPorDia = calcularConsumoDiario(historico);
    exibirGrafico(consumoPorDia);

  } catch (err) {
    console.error("Erro ao carregar consumo diário:", err);
  }
}

// ======= CALCULAR CONSUMO =======
function calcularConsumoDiario(historico) {
  const consumo = {};

  historico.forEach(entry => {
    const data = new Date(entry.timestamp).toLocaleDateString("pt-BR");

    if (!consumo[data]) consumo[data] = { elevador: 0, osmose: 0 };

    if (entry.Reservatorio_Elevador_current !== undefined)
      consumo[data].elevador = Math.max(consumo[data].elevador, entry.Reservatorio_Elevador_current);

    if (entry.Reservatorio_Osmose_current !== undefined)
      consumo[data].osmose = Math.max(consumo[data].osmose, entry.Reservatorio_Osmose_current);
  });

  const dias = Object.keys(consumo).sort(
    (a, b) =>
      new Date(a.split("/").reverse().join("-")) - new Date(b.split("/").reverse().join("-"))
  );

  const consumoFinal = [];
  for (let i = 1; i < dias.length; i++) {
    const dAnt = consumo[dias[i - 1]];
    const dAt = consumo[dias[i]];

    consumoFinal.push({
      dia: dias[i],
      elevador: Math.max(0, dAnt.elevador - dAt.elevador),
      osmose: Math.max(0, dAnt.osmose - dAt.osmose),
    });
  }

  return consumoFinal.slice(-5); // últimos 5 dias
}

// ======= EXIBIR GRÁFICO =======
function exibirGrafico(consumo) {
  const ctx = document.getElementById("graficoConsumo").getContext("2d");

  if (window.graficoConsumo instanceof Chart) {
    window.graficoConsumo.destroy();
  }

  // Ajuste automático da escala
  const valores = [
    ...consumo.map(d => d.elevador),
    ...consumo.map(d => d.osmose),
  ];

  const maxValor = Math.max(...valores, 1);
  const margem = maxValor * 0.30;
  const limiteY = Math.ceil(maxValor + margem);

  window.graficoConsumo = new Chart(ctx, {
    type: "bar",
    data: {
      labels: consumo.map(d => d.dia),
      datasets: [
        {
          label: "Reservatório Elevador (L)",
          data: consumo.map(d => d.elevador),
          backgroundColor: "#2c8b7d",
        },
        {
          label: "Reservatório Osmose (L)",
          data: consumo.map(d => d.osmose),
          backgroundColor: "#57b3a0",
        },
      ],
    },
    options: {
      responsive: true,
      animation: { duration: 800 },
      plugins: {
        title: {
          display: true,
          text: "Consumo Diário de Água — Últimos 5 Dias",
          font: { size: 18 },
        },
        legend: { position: "top" },
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: limiteY,
          title: { display: true, text: "Litros Consumidos" },
        },
        x: { title: { display: true, text: "Dia" } },
      },
    },
  });
}

// ======= Atualização automática à meia-noite =======
function atualizarMeiaNoite() {
  const agora = new Date();
  const prox = new Date();
  prox.setHours(24, 0, 0, 0);

  const ms = prox - agora;

  setTimeout(() => {
    carregarConsumo();
    atualizarMeiaNoite();
  }, ms);
}

// Inicializa
window.addEventListener("load", () => {
  carregarConsumo();
  atualizarMeiaNoite();
});
