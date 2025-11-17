// ======= consumo.js =======
// Consumo diário REAL baseado em MIN/MAX do dia

const CAPACIDADE_ELEVADOR = 10000;  // ajuste aqui se necessário
const CAPACIDADE_OSMOSE = 8000;     // ajuste aqui se necessário

let alertaEnviado = false;

// ============================
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

// ============================
function mostrarAvisoSemDados() {
  const canvas = document.getElementById("graficoConsumo");

  if (window.graficoConsumo instanceof Chart) {
    window.graficoConsumo.destroy();
  }

  canvas.parentElement.innerHTML =
    "<p style='text-align:center; color:gray; font-size:18px;'>Ainda não há dados suficientes para gerar o gráfico de consumo diário.</p>";
}

// ============================
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

    if (typeof entry.Reservatorio_Elevador_current === "number") {
      const v = entry.Reservatorio_Elevador_current;
      dias[data].elevadorMin = Math.min(dias[data].elevadorMin, v);
      dias[data].elevadorMax = Math.max(dias[data].elevadorMax, v);
    }

    if (typeof entry.Reservatorio_Osmose_current === "number") {
      const v = entry.Reservatorio_Osmose_current;
      dias[data].osmoseMin = Math.min(dias[data].osmoseMin, v);
      dias[data].osmoseMax = Math.max(dias[data].osmoseMax, v);
    }
  });

  const listaDias = Object.keys(dias).sort(
    (a, b) => new Date(a.split("/").reverse().join("-")) - new Date(b.split("/").reverse().join("-"))
  );

  const resultado = [];

  listaDias.forEach(dia => {
    const d = dias[dia];

    const elevador = d.elevadorMin === Infinity ? 0 : d.elevadorMax - d.elevadorMin;
    const osmose = d.osmoseMin === Infinity ? 0 : d.osmoseMax - d.osmoseMin;

    resultado.push({ dia, elevador, osmose, elevadorMax: d.elevadorMax, osmoseMax: d.osmoseMax });
  });

  return resultado.slice(-5);
}

// ============================
function calcularRegressao(valores) {
  const n = valores.length;
  const x = valores.map((_, i) => i + 1);
  const y = valores;

  const somaX = x.reduce((a, b) => a + b, 0);
  const somaY = y.reduce((a, b) => a + b, 0);
  const somaXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const somaX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const slope = (n * somaXY - somaX * somaY) / (n * somaX2 - somaX * somaX);
  const intercept = (somaY - slope * somaX) / n;

  return x.map(v => slope * v + intercept);
}

// ============================
function exibirGrafico(consumo) {
  const ctx = document.getElementById("graficoConsumo").getContext("2d");

  if (window.graficoConsumo instanceof Chart) {
    window.graficoConsumo.destroy();
  }

  const valoresElevador = consumo.map(d => d.elevador);
  const valoresOsmose = consumo.map(d => d.osmose);

  const regressaoElevador = calcularRegressao(valoresElevador);
  const regressaoOsmose = calcularRegressao(valoresOsmose);

  // ALERTA 30%
  consumo.forEach(dia => {
    const pctElevador = (dia.elevador / CAPACIDADE_ELEVADOR) * 100;
    const pctOsmose = (dia.osmose / CAPACIDADE_OSMOSE) * 100;

    if (!alertaEnviado && (pctElevador >= 30 || pctOsmose >= 30)) {
      alertaEnviado = true;
      alert("⚠️ ALERTA: Consumo atingiu 30% da capacidade de um dos reservatórios!");
    }
  });

  window.graficoConsumo = new Chart(ctx, {
    type: "bar",
    data: {
      labels: consumo.map(d => d.dia),
      datasets: [
        {
          label: "Reservatório Elevador (L)",
          data: valoresElevador,
          backgroundColor: valoresElevador.map(v =>
            (v / CAPACIDADE_ELEVADOR) * 100 >= 30 ? "red" : "#2c8b7d"
          )
        },
        {
          label: "Reservatório Osmose (L)",
          data: valoresOsmose,
          backgroundColor: valoresOsmose.map(v =>
            (v / CAPACIDADE_OSMOSE) * 100 >= 30 ? "red" : "#57b3a0"
          )
        },
        {
          type: "line",
          label: "Tendência Elevador",
          data: regressaoElevador,
          borderColor: "#145c4d",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          type: "line",
          label: "Tendência Osmose",
          data: regressaoOsmose,
          borderColor: "#2fa88c",
          borderWidth: 2,
          tension: 0.3,
          fill: false
        },
        {
          type: "line",
          label: "Máximo Elevador",
          data: consumo.map(d => d.elevadorMax),
          borderDash: [5, 5],
          borderColor: "#003322",
          borderWidth: 1,
          fill: false
        },
        {
          type: "line",
          label: "Máximo Osmose",
          data: consumo.map(d => d.osmoseMax),
          borderDash: [5, 5],
          borderColor: "#007755",
          borderWidth: 1,
          fill: false
        }
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
          title: { display: true, text: "Litros Consumidos" },
        },
        x: { title: { display: true, text: "Dia" } },
      },
    },
  });
}

// ============================
function atualizarMeiaNoite() {
  const agora = new Date();
  const prox = new Date();
  prox.setHours(24, 0, 0, 0);
  const ms = prox - agora;

  setTimeout(() => {
    alertaEnviado = false;
    carregarConsumo();
    atualizarMeiaNoite();
  }, ms);
}

// Inicializa
window.addEventListener("load", () => {
  carregarConsumo();
  atualizarMeiaNoite();
});
