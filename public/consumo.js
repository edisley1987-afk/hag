const CAPACIDADE_ELEVADOR = 20000;
const CAPACIDADE_OSMOSE = 200;
const CAPACIDADE_LAVANDERIA = 10000;
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
  const canvas = document.getElementById("graficoConsumo");
  if (canvas) {
    canvas.outerHTML =
      "<p style='text-align:center; color:gray; font-size:18px;'>Sem dados suficientes para gerar o gráfico.</p>";
  } else {
    // fallback
    const cont = document.getElementById("grafico-wrapper");
    if (cont) cont.innerHTML = "<p style='text-align:center; color:gray; font-size:18px;'>Sem dados suficientes para gerar o gráfico.</p>";
  }
}

// ============================
// Agrupar por dia e calcular consumo
// ============================
function calcularConsumoDiario(historico) {
  const diasMap = {};

  historico.forEach(p => {
    const date = new Date(p.timestamp);
    // se timestamp já for number em ms, new Date ok; se for string, também ok
    const diaStr = date.toISOString().split("T")[0]; // yyyy-mm-dd

    if (!diasMap[diaStr]) diasMap[diaStr] = { elevador: [], osmose: [], lavanderia: [] };

    if (p.reservatorio === "elevador") diasMap[diaStr].elevador.push(p.valor);
    if (p.reservatorio === "osmose") diasMap[diaStr].osmose.push(p.valor);
    if (p.reservatorio === "lavanderia") diasMap[diaStr].lavanderia.push(p.valor);
  });

  const resultado = Object.keys(diasMap)
    .sort()
    .slice(-5) // últimos 5 dias
    .map(dia => {
      const elev = diasMap[dia].elevador;
      const osm = diasMap[dia].osmose;
      const lav = diasMap[dia].lavanderia;

      // consumo = somatório de quedas (ou máxima - mínima? aqui mantive max-min pra ser consistente com histórico anterior)
      const consumoElev = elev.length ? Math.max(...elev) - Math.min(...elev) : 0;
      const consumoOsm = osm.length ? Math.max(...osm) - Math.min(...osm) : 0;
      const consumoLav = lav.length ? Math.max(...lav) - Math.min(...lav) : 0;

      return { dia, elevador: Number(consumoElev.toFixed(2)), osmose: Number(consumoOsm.toFixed(2)), lavanderia: Number(consumoLav.toFixed(2)) };
    });

  return resultado;
}

// ============================
function calcularRegressao(valores) {
  const n = valores.length;
  if (n === 0) return [];

  const x = valores.map((_, i) => i + 1);
  const y = valores;

  const somaX = x.reduce((a, b) => a + b, 0);
  const somaY = y.reduce((a, b) => a + b, 0);
  const somaXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const somaX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const denom = (n * somaX2 - somaX * somaX);
  const slope = denom === 0 ? 0 : (n * somaXY - somaX * somaY) / denom;
  const intercept = (somaY - slope * somaX) / n;

  return x.map(v => slope * v + intercept);
}

// ============================
function exibirGrafico(consumo) {
  const ctxCanvas = document.getElementById("graficoConsumo");
  if (!ctxCanvas) {
    console.error("Elemento #graficoConsumo não encontrado.");
    return;
  }
  const ctx = ctxCanvas.getContext("2d");

  if (window.graficoConsumo instanceof Chart) {
    window.graficoConsumo.destroy();
  }

  const valoresElevador = consumo.map(d => d.elevador);
  const valoresOsmose = consumo.map(d => d.osmose);
  const valoresLavanderia = consumo.map(d => d.lavanderia);

  const regressaoElevador = calcularRegressao(valoresElevador);
  const regressaoOsmose = calcularRegressao(valoresOsmose);
  const regressaoLav = calcularRegressao(valoresLavanderia);

  // ALERTA 30%
  consumo.forEach(dia => {
    const pctElev = (dia.elevador / CAPACIDADE_ELEVADOR) * 100;
    const pctOsm = (dia.osmose / CAPACIDADE_OSMOSE) * 100;
    const pctLav = (dia.lavanderia / CAPACIDADE_LAVANDERIA) * 100;

    if (!alertaEnviado && (pctElev >= 30 || pctOsm >= 30 || pctLav >= 30)) {
      alertaEnviado = true;
      alert("⚠️ ALERTA: Consumo atingiu 30% da capacidade em algum reservatório!");
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
          label: "Reservatório Lavanderia (L)",
          data: valoresLavanderia,
          backgroundColor: valoresLavanderia.map(v =>
            (v / CAPACIDADE_LAVANDERIA) * 100 >= 30 ? "red" : "#6a9bd6"
          )
        },
        {
          type: "line",
          label: "Tendência Elevador",
          data: regressaoElevador,
          borderColor: "#145c4d",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          yAxisID: "y"
        },
        {
          type: "line",
          label: "Tendência Osmose",
          data: regressaoOsmose,
          borderColor: "#2fa88c",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          yAxisID: "y"
        },
        {
          type: "line",
          label: "Tendência Lavanderia",
          data: regressaoLav,
          borderColor: "#2a56a5",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          yAxisID: "y"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "Consumo Diário — Últimos 5 Dias", font: { size: 18 } },
        legend: { position: "top" },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
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
