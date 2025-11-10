// === historico.js ===
// Local: /public/historico.js

const API_URL = "https://reservatorios-hag-dashboard.onrender.com"; // ajuste conforme o domínio

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

// Obtém o parâmetro da URL (ex: ?res=Reservatorio_Elevador_current)
const params = new URLSearchParams(window.location.search);
const reservatorio = params.get("res");

async function carregarHistorico() {
  try {
    const res = await fetch(`${API_URL}/historico`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const historico = await res.json();

    exibirHistorico(historico);
  } catch (e) {
    console.error("Erro ao buscar histórico:", e);
  }
}

function exibirHistorico(historico) {
  const container = document.getElementById("historicoContainer");
  container.innerHTML = "";

  const cfg = CONFIG[reservatorio];
  if (!cfg) {
    container.textContent = "Reservatório não encontrado.";
    return;
  }

  document.getElementById("tituloHistorico").textContent = cfg.nome;

  Object.entries(historico).forEach(([data, dados]) => {
    if (!dados[reservatorio]) return;

    const { min, max } = dados[reservatorio];

    const nivelMin = calcularNivel(reservatorio, min);
    const nivelMax = calcularNivel(reservatorio, max);

    const card = document.createElement("div");
    card.className = "historico-card";
    card.innerHTML = `
      <h3>${data}</h3>
      <p><strong>Mínimo:</strong> ${nivelMin.litros.toFixed(0)} L (${nivelMin.porcentagem.toFixed(1)}%)</p>
      <p><strong>Máximo:</strong> ${nivelMax.litros.toFixed(0)} L (${nivelMax.porcentagem.toFixed(1)}%)</p>
    `;
    container.appendChild(card);
  });
}

// Botão de voltar
function voltar() {
  window.location.href = "dashboard.html";
}

carregarHistorico();
