// ===============================
// 📊 HISTÓRICO PROFISSIONAL HAG
// ===============================

const API_URL = window.location.origin + "/historico";

// ===============================
// ⚙️ CALIBRAÇÃO REAL DOS TANQUES
// ===============================
const CALIBRACAO = {
  Reservatorio_Elevador_current: { vazio: 0.005250, cheio: 0.009018, capacidade: 20000 },
  Reservatorio_Osmose_current: { vazio: 0.00505, cheio: 0.006853, capacidade: 200 },
  Reservatorio_CME_current: { vazio: 0.004088, cheio: 0.00537, capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { vazio: 0.004048, cheio: 0.004929, capacidade: 9000 },
  Reservatorio_lavanderia_current: { vazio: 0.006012, cheio: 0.011623, capacidade: 10000 }
};

// ===============================
// 🎨 CORES FIXAS PROFISSIONAIS
// ===============================
const CORES = {
  Reservatorio_Elevador_current: "#00e5ff",
  Reservatorio_Osmose_current: "#00bcd4",
  Reservatorio_CME_current: "#00ff88",
  Reservatorio_Agua_Abrandada_current: "#b388ff",
  Reservatorio_lavanderia_current: "#ffd600",

  Pressao_Saida_Osmose_current: "#ff9800",
  Pressao_Retorno_Osmose_current: "#ff5252",
  Pressao_Saida_CME_current: "#3f51b5"
};

// ===============================
// 🧮 CONVERSÃO INTELIGENTE
// ===============================
function calcularNivel(valor, conf) {
  if (!conf) return { percent: valor, litros: valor };

  let percent = ((valor - conf.vazio) / (conf.cheio - conf.vazio)) * 100;
  percent = Math.max(0, Math.min(100, percent));

  const litros = (percent / 100) * conf.capacidade;

  return {
    percent: Number(percent.toFixed(1)),
    litros: Math.round(litros)
  };
}

// ===============================
// 🚀 CARREGAR HISTÓRICO
// ===============================
async function carregarHistorico() {

  const container = document.getElementById("historico");
  const ctx = document.getElementById("graficoHistorico");

  container.innerHTML = "⏳ Carregando histórico...";

  try {

    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao buscar histórico");

    const historico = await res.json();

    if (!Object.keys(historico).length) {
      container.innerHTML = `<p style="text-align:center;">📭 Nenhum histórico encontrado</p>`;
      return;
    }

    // ===============================
    // 📋 TABELA PROFISSIONAL
    // ===============================
    let html = `
    <table class="tabela-historico">
      <thead>
        <tr>
          <th>Data</th>
          <th>Sensor</th>
          <th>Nível (%)</th>
          <th>Volume (L)</th>
        </tr>
      </thead>
      <tbody>
    `;

    const labels = [];
    const datasets = {};

    const datasOrdenadas = Object.keys(historico).sort();

    datasOrdenadas.forEach((data) => {

      labels.push(data);

      Object.entries(historico[data]).forEach(([nome, valores]) => {

        const media = (valores.max + valores.min) / 2;

        const conf = CALIBRACAO[nome];
        const nivel = calcularNivel(media, conf);

        html += `
          <tr>
            <td>${data}</td>
            <td>${formatarNomeSensor(nome)}</td>
            <td>${nivel.percent.toFixed(1)}%</td>
            <td>${formatarNumero(nivel.litros)} L</td>
          </tr>
        `;

        if (!datasets[nome]) datasets[nome] = [];
        datasets[nome].push(nivel.percent);
      });

    });

    html += "</tbody></table>";
    container.innerHTML = html;

    // ===============================
    // 📈 GRÁFICO PROFISSIONAL
    // ===============================
    const chartData = {
      labels,
      datasets: Object.entries(datasets).map(([nome, valores]) => ({
        label: formatarNomeSensor(nome),
        data: valores,
        borderColor: CORES[nome] || "#999",
        backgroundColor: CORES[nome] || "#999",
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 3
      }))
    };

    new Chart(ctx, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: { position: "bottom" },
          title: {
            display: true,
            text: "📊 Nível dos Reservatórios (%)"
          }
        },

        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: "Nível (%)"
            }
          },
          x: {
            title: {
              display: true,
              text: "Data"
            }
          }
        }
      }
    });

  } catch (err) {
    container.innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
    console.error(err);
  }
}

// ===============================
// 🔧 UTILITÁRIOS
// ===============================
function formatarNomeSensor(nome){
  return nome
    .replace(/_/g, " ")
    .replace("current", "")
    .replace("Reservatorio", "Reservatório")
    .replace("Pressao", "Pressão")
    .replace("Agua", "Água")
    .trim();
}

function formatarNumero(n){
  return Number(n || 0).toLocaleString("pt-BR");
}

// ===============================
// 🚀 START
// ===============================
carregarHistorico();
