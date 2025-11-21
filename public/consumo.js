// ======= consumo.js (Corrigido e 100% funcional) =======

const CAPACIDADE_ELEVADOR = 20000;
const CAPACIDADE_OSMOSE   = 200;

let alertaEnviado = false;

// ============================
// Carregar histórico do servidor
// ============================
async function carregarConsumo() {
  try {
    const resp = await fetch("/historico");
    const historico = await resp.json();

    if (!historico || Object.keys(historico).length === 0) {
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
  document.getElementById("graficoConsumo").outerHTML =
    "<p style='text-align:center; color:gray; font-size:18px;'>Sem dados suficientes para gerar o gráfico.</p>";
}

// ==========================================
// Cálculo REAL usando min/max diário
// Agora com proteção caso dados não existam
// ==========================================
function calcularConsumoDiario(historico) {
  const dias = Object.keys(historico).sort();

  const resultado = [];

  dias.forEach(data => {
    const dia = historico[data] ?? {};

    const elev = dia.elevador ?? {};
    const osm  = dia.osmose   ?? {};

    const minElev = elev.min ?? elev.minimo ?? elev.low ?? 0;
    const maxElev = elev.max ?? elev.maximo ?? elev.high ?? 0;

    const minOsm  = osm.min ?? osm.minimo ?? osm.low ?? 0;
    const maxOsm  = osm.max ?? osm.maximo ?? osm.high ?? 0;

    const consumoElev = Math.max(0, maxElev - minElev);
    const consumoOsm  = Math.max(0, maxOsm  - minOsm);

    resultado.push({
      dia: data,
      elevador: consumoElev,
      osmose: consumoOsm
    });
  });

  return resultado.slice(-5); // últimos 5 dias
}

// ==========================================
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

// ==========================================
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
    const pctElev = (dia.elevador / CAPACIDADE_ELEVADOR) * 100;
    const pctOsm  = (dia.osmose  / CAPACIDADE_OSMOSE  ) * 100;

    if (!alertaEnviado && (pctElev >= 30 || pctOsm >= 30)) {
      alertaEnviado = true;
      alert("⚠️ ALERTA: Consumo atingiu 30% da capacidade!");
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
      ],
    },

    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Consumo Diário — Últimos 5 Dias",
          font: { size: 18 },
        },
        legend: { position: "top" },
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Litros" } },
        x: { title: { display: true, text: "Dia" } },
      },
    },
  });
}

// ==========================================
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

window.addEventListener("load", () => {
  carregarConsumo();
  atualizarMeiaNoite();
});
