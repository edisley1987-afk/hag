const CAPACIDADE_ELEVADOR = 20000;
const CAPACIDADE_OSMOSE = 200;
let alertaEnviado = false;

// ============================
// Carregar histórico do servidor
// ============================
async function carregarConsumo() {
  try {
    const resp = await fetch("/historico");
    const historico = await resp.json();

    if (!historico || historico.length === 0) {
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

function mostrarAvisoSemDados() {
  document.getElementById("graficoConsumo").outerHTML =
    "<p style='text-align:center; color:gray; font-size:18px;'>Sem dados suficientes para gerar o gráfico.</p>";
}

// ============================
// Agrupar por dia e calcular consumo
// ============================
function calcularConsumoDiario(historico) {
  const diasMap = {};

  historico.forEach(p => {
    const date = new Date(p.timestamp);
    const diaStr = date.toISOString().split("T")[0]; // yyyy-mm-dd

    if (!diasMap[diaStr]) diasMap[diaStr] = { elevador: [], osmose: [] };

    if (p.reservatorio === "elevador") diasMap[diaStr].elevador.push(p.valor);
    if (p.reservatorio === "osmose") diasMap[diaStr].osmose.push(p.valor);
  });

  const resultado = Object.keys(diasMap)
    .sort()
    .slice(-5) // últimos 5 dias
    .map(dia => {
      const elev = diasMap[dia].elevador;
      const osm = diasMap[dia].osmose;

      const consumoElev = elev.length ? Math.max(...elev) - Math.min(...elev) : 0;
      const consumoOsm = osm.length ? Math.max(...osm) - Math.min(...osm) : 0;

      return { dia, elevador: consumoElev, osmose: consumoOsm };
    });

  return resultado;
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
    const pctElev = (dia.elevador / CAPACIDADE_ELEVADOR) * 100;
    const pctOsm = (dia.osmose / CAPACIDADE_OSMOSE) * 100;

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
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "Consumo Diário — Últimos 5 Dias", font: { size: 18 } },
        legend: { position: "top" }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Litros" } },
        x: { title: { display: true, text: "Dia" } }
      }
    }
  });
}

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
