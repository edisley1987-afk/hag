const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

const CONFIG = {
  Reservatorio_Elevador_current: { capacidade: 20000, leituraVazio: 0.004168, leituraCheio: 0.008056 },
  Reservatorio_Osmose_current: { capacidade: 200, leituraVazio: 0.00505, leituraCheio: 0.006533 },
  Reservatorio_CME_current: { capacidade: 1000, leituraVazio: 0.004088, leituraCheio: 0.004408 },
  Agua_Abrandada_current: { capacidade: 9000, leituraVazio: 0.004008, leituraCheio: 0.004929 },
};

function calcularNivel(ref, leitura) {
  const cfg = CONFIG[ref];
  if (!cfg) return { litros: 0, porcentagem: 0 };

  const perc = ((leitura - cfg.leituraVazio) / (cfg.leituraCheio - cfg.leituraVazio)) * 100;
  const porcentagem = Math.max(0, Math.min(100, perc));
  const litros = (cfg.capacidade * porcentagem) / 100;
  return { litros, porcentagem };
}

function atualizarDashboard(dados) {
  if (!dados) return;

  const campos = {
    Reservatorio_Elevador_current: ["cardElevador", "elevadorValor", "elevadorPercent"],
    Reservatorio_Osmose_current: ["cardOsmose", "osmoseValor", "osmosePercent"],
    Reservatorio_CME_current: ["cardCME", "cmeValor", "cmePercent"],
    Agua_Abrandada_current: ["cardAbrandada", "abrandadaValor", "abrandadaPercent"],
  };

  Object.keys(campos).forEach((ref) => {
    const leitura = dados[ref];
    if (typeof leitura !== "number") return;

    const { litros, porcentagem } = calcularNivel(ref, leitura);
    const [cardID, valorID, percentID] = campos[ref];

    document.getElementById(valorID).textContent = `${litros.toFixed(0)} L`;
    document.getElementById(percentID).textContent = `${porcentagem.toFixed(1)}%`;

    const card = document.getElementById(cardID);
    const cor = porcentagem > 70 ? "#00c853" : porcentagem > 40 ? "#ffca28" : "#e53935";
    card.style.setProperty("--progress", porcentagem / 100);
    card.style.setProperty("--progress-color", cor);
    card.dataset.progress = porcentagem.toFixed(1);
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
}

async function carregarDados() {
  try {
    const res = await fetch("https://reservatorios-hag-dashboard.onrender.com/dados");
    const dados = await res.json();
    atualizarDashboard(dados);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
  }
}

function atualizarRelogio() {
  document.getElementById("clock").textContent = new Date().toLocaleTimeString("pt-BR");
}

function abrirHistorico(ref) {
  window.location.href = `historico.html?res=${ref}`;
}

setInterval(carregarDados, 5000);
setInterval(atualizarRelogio, 1000);
carregarDados();
