// === dashboard.js (seguro + animação suave) ===
const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

const CONFIG = {
  Reservatorio_Elevador_current: { capacidade: 20000, leituraVazio: 0.004168, leituraCheio: 0.008056 },
  Reservatorio_Osmose_current:   { capacidade: 200,   leituraVazio: 0.00505,  leituraCheio: 0.006533 },
  Reservatorio_CME_current:      { capacidade: 1000,  leituraVazio: 0.004088, leituraCheio: 0.004408 },
  Agua_Abrandada_current:        { capacidade: 9000,  leituraVazio: 0.004008, leituraCheio: 0.004929 },
};

const campos = {
  Reservatorio_Elevador_current: ["cardElevador", "elevadorValor", "elevadorPercent"],
  Reservatorio_Osmose_current:   ["cardOsmose",   "osmoseValor",   "osmosePercent"],
  Reservatorio_CME_current:      ["cardCME",      "cmeValor",      "cmePercent"],
  Agua_Abrandada_current:        ["cardAbrandada","abrandadaValor","abrandadaPercent"],
};

// Guarda quais IDs já relatamos como ausentes para não spammar o console
const missingLogged = new Set();

function calcularNivel(ref, leitura) {
  const cfg = CONFIG[ref];
  if (!cfg) return { litros: 0, porcentagem: 0 };
  const perc = ((leitura - cfg.leituraVazio) / (cfg.leituraCheio - cfg.leituraVazio)) * 100;
  const porcentagem = Math.max(0, Math.min(100, perc));
  const litros = (cfg.capacidade * porcentagem) / 100;
  return { litros, porcentagem };
}

// anima valor CSS progress (usa var --progress de 0..1), suaviza usando requestAnimationFrame
function animateProgress(cardEl, targetValue) {
  if (!cardEl) return;
  const start = parseFloat(getComputedStyle(cardEl).getPropertyValue("--progress")) || 0;
  const end = targetValue;
  const duration = 600; // ms
  const startTime = performance.now();

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    // easeOutCubic
    const eased = 1 - Math.pow(1 - t, 3);
    const current = start + (end - start) * eased;
    cardEl.style.setProperty("--progress", current);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function atualizarDashboard(dados) {
  if (!dados) return;

  Object.keys(campos).forEach((ref) => {
    const leitura = dados[ref];
    if (leitura === undefined) return;

    const [cardID, valorID, percentID] = campos[ref];
    const card = document.getElementById(cardID);
    const valorEl = document.getElementById(valorID);
    const percentEl = document.getElementById(percentID);

    if (!card) {
      if (!missingLogged.has(cardID)) {
        console.warn(`Elemento ausente no DOM: #${cardID}`);
        missingLogged.add(cardID);
      }
      return;
    }
    if (!valorEl || !percentEl) {
      const missing = [];
      if (!valorEl && !missingLogged.has(valorID)) { missing.push(valorID); missingLogged.add(valorID); }
      if (!percentEl && !missingLogged.has(percentID)) { missing.push(percentID); missingLogged.add(percentID); }
      if (missing.length) console.warn("Elemento(s) ausente(s):", missing.join(", "));
      return;
    }

    const { litros, porcentagem } = calcularNivel(ref, leitura);

    valorEl.textContent = `${Math.round(litros)} L`;
    percentEl.textContent = `${porcentagem.toFixed(1)}%`;

    // cor: verde (>70), amarelo (40-70), vermelho (<40)
    const cor = porcentagem > 70 ? "#00c853" : porcentagem > 40 ? "#ffca28" : "#e53935";
    card.style.setProperty("--progress-color", cor);

    // anima de forma suave do valor atual para o novo (valor 0..1)
    animateProgress(card, porcentagem / 100);
  });

  const last = document.getElementById("lastUpdate");
  if (last) last.textContent = "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
}

async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    atualizarDashboard(dados);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
  }
}

function atualizarRelogio() {
  const clk = document.getElementById("clock");
  if (clk) clk.textContent = new Date().toLocaleTimeString("pt-BR");
}

setInterval(carregarDados, 5000);
setInterval(atualizarRelogio, 1000);
carregarDados();
atualizarRelogio();
