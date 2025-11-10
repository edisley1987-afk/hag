// === historico.js ===
// Local: /public/historico.js

const API_URL = "https://reservatorios-hag-dashboard.onrender.com"; // ajuste se necessário

// Configuração dos reservatórios
const CONFIG = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000, leituraVazio: 0.004168, leituraCheio: 0.008056 },
  Reservatorio_Osmose_current:   { nome: "Reservatório Osmose",   capacidade: 200,   leituraVazio: 0.00505,  leituraCheio: 0.006533 },
  Reservatorio_CME_current:      { nome: "Reservatório CME",      capacidade: 1000,  leituraVazio: 0.004088, leituraCheio: 0.004408 },
  Agua_Abrandada_current:        { nome: "Água Abrandada",        capacidade: 9000,  leituraVazio: 0.004008, leituraCheio: 0.004929 },
};

// Função para converter leitura bruta em litros e %
function calcularNivel(ref, leitura) {
  const cfg = CONFIG[ref];
  if (!cfg) return { litros: 0, porcentagem: 0 };

  const perc = ((leitura - cfg.leituraVazio) / (cfg.leituraCheio - cfg.leituraVazio)) * 100;
  const porcentagem = Math.max(0, Math.min(100, perc));
  const litros = (cfg.capacidade * porcentagem) / 100;

  return { litros, porcentagem };
}

// Captura o parâmetro da URL (ex: ?reservatorio=Reservatorio_Elevador_current)
const params = new URLSearchParams(window.location.search);
const reservatorio = params.get("reservatorio");

// === Função principal ===
async function carregarHistorico() {
  try {
    const res = await fetch(`${API_URL}/leituras`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();

    const historico = dados.filter(d => d.ref === reservatorio);
    if (historico.length === 0) {
      console.warn("Nenhum dado encontrado para", reservatorio);
      return;
    }

    const cfg = CONFIG[reservatorio];
    document.getElementById("tituloHistorico").textContent = `Histórico — ${cfg.nome}`;

    const labels = [];
    const niveis = [];

    const tbody = document.querySelector("#tabelaHistorico tbody");
    tbody.innerHTML = "";

    historico.slice(-50).forEach(item => {
      const nivel = calcularNivel(reservatorio, item.valor);
      const hora = new Date(item.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      labels.push(hora);
      niveis.push(nivel.porcentagem.toFixed(1));

      const linha = document.createElement("tr");
      linha.innerHTML = `
        <td>${hora}</td>
        <td>${nivel.porcentagem.toFixed(1)}%</td>
      `;
      tbody.appendChild(linha);
    });

    desenharGrafico(labels, niveis, cfg.nome);

  } catch (e) {
    console.error("Erro ao carregar histórico:", e);
  }
}

// === Gráfico Chart.js ===
function desenharGrafico(labels, dados, titulo) {
  const ctx = document.getElementById("graficoHistorico").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Nível (%)",
        data: dados,
        borderColor: "#5fa292",
        backgroundColor: "rgba(93, 162, 146, 0.2)",
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: { color: "#333", font: { size: 13 } }
        },
        title: {
          display: true,
          text: titulo,
          color: "#333",
          font: { size: 16, weight: "600" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#333" },
          grid: { color: "rgba(0,0,0,0.05)" }
        },
        y: {
          ticks: { color: "#333", callback: v => v + "%" },
          grid: { color: "rgba(0,0,0,0.05)" },
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

carregarHistorico();
