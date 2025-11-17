// ======= consumo.js =======
// Consumo diário REAL baseado em MIN/MAX do dia

async function carregarConsumo() {
  try {
    const resp = await fetch("/historico");
    const historico = await resp.json();

    if (!historico.length) {
      mostrarAvisoSemDados();
      return;
    }

    const consumoPorDia = calcularConsumoDiario(historico);

    if (!consumoPorDia.length) {
      mostrarAvisoSemDados();
      return;
    }

    exibirGrafico(consumoPorDia);

  } catch (err) {
    console.error("Erro ao carregar consumo diário:", err);
  }
}

// ======= MOSTRAR AVISO =======
function mostrarAvisoSemDados() {
  const canvas = document.getElementById("graficoConsumo");

  if (window.graficoConsumo instanceof Chart) {
    window.graficoConsumo.destroy();
  }

  canvas.parentElement.innerHTML =
    "<p style='text-align:center; color:gray; font-size:18px;'>Ainda não há dados suficientes para gerar o gráfico de consumo diário.</p>";
}

// ======= CALCULAR CONSUMO REAL =======
function calcularConsumoDiario(historico) {
  const dias = {};

  historico.forEach(entry => {
    const data = new Date(entry.timestamp).toLocaleDateString("pt-BR");

    if (!dias[data]) {
      dias[data] = {
        elevadorMin: Infinity,
        elevadorMax: 0,
        osmoseMin: Infinity,
        osmoseMax: 0
      };
    }

    // ----- Elevador -----
    if (typeof entry.Reservatorio_Elevador_current === "number") {
      const v = entry.Reservatorio_Elevador_current;
      dias[data].elevadorMin = Math.min(dias[data].elevadorMin, v);
      dias[data].elevadorMax = Math.max(dias[data].elevadorMax, v);
    }

    // ----- Osmose -----
    if (typeof entry.Reservatorio_Osmose_current === "number") {
      const v = entry.Reservatorio_Osmose_current;
      dias[data].osmoseMin = Math.min(dias[data].osmoseMin, v);
      dias[data].osmoseMax = Math.max(dias[data].osmoseMax, v);
    }
  });

  // ordenar dias corretamente
  const listaDias = Object.keys(dias).sort(
    (a, b) => new Date(a.split("/").reverse().join("-")) - new Date(b.split("/").reverse().join("-"))
  );

  const resultado = [];

  listaDias.forEach(dia => {
    const dado = dias[dia];

    // evita valores inválidos (ex: Infinity quando não houve leitura)
    const elevador =
      dado.elevadorMin === Infinity ? 0 : Math.max(0, dado.elevadorMax - dado.elevadorMin);

    const osmose =
      dado.osmoseMin === Infinity ? 0 : Math.max(0, dado.osmoseMax - dado.osmoseMin);

    resultado.push({ dia, elevador, osmose });
  });

  return resultado.slice(-5); // últimos 5 dias
}

// ======= EXIBIR GRÁFICO =======
function exibirGrafico(consumo) {
  const ctx = document.getElementById("graficoConsumo").getContext("2d");

  if (window.graficoConsumo instanceof Chart) {
    window.graficoConsumo.destroy();
  }

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
