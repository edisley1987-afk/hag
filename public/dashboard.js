const API_BASE = "https://reservatorios-hag-dashboard.onrender.com"; // ✅ ajuste conforme seu domínio
const API_DADOS = `${API_BASE}/dados`;
const API_HIST = `${API_BASE}/historico`;

async function carregarDados() {
  try {
    const [resDados, resHist] = await Promise.all([
      fetch(API_DADOS + "?t=" + Date.now()),
      fetch(API_HIST + "?t=" + Date.now())
    ]);

    const dados = await resDados.json();
    const historico = await resHist.json();

    atualizarDashboard(dados, historico);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

// === Atualiza os cards e os relógios ===
function atualizarDashboard(dados, historico) {
  const cardsContainer = document.querySelector(".cards-container");
  if (!cardsContainer) {
    console.error("⚠️ Elementos do dashboard não encontrados no DOM.");
    return;
  }

  const hoje = new Date().toISOString().split("T")[0];
  const histHoje = historico[hoje] || {};

  const config = {
    "Reservatorio_Elevador_current": { nome: "Reservatório Elevador", capacidade: 20000, gaugeId: "relogioElevador" },
    "Reservatorio_Osmose_current": { nome: "Reservatório Osmose", capacidade: 200, gaugeId: "relogioOsmose" },
    "Reservatorio_CME_current": { nome: "Reservatório CME", capacidade: 1000, gaugeId: "relogioCME" },
    "Agua_Abrandada_current": { nome: "Água Abrandada", capacidade: 9000, gaugeId: "relogioAbrandada" },
  };

  Object.entries(config).forEach(([ref, cfg]) => {
    const valor = dados[ref] ?? 0;
    const porcent = (valor / cfg.capacidade) * 100;

    const hist = histHoje[ref] || { min: valor, max: valor };
    const minP = ((hist.min ?? 0) / cfg.capacidade) * 100;
    const maxP = ((hist.max ?? 0) / cfg.capacidade) * 100;

    // Cores conforme nível
    let cor = "#00c9a7";
    if (porcent < 30) cor = "#e53935";
    else if (porcent < 50) cor = "#fbc02d";

    // Atualiza card
    const valorEl = document.getElementById(cfg.nome.toLowerCase().split(" ")[1] + "Valor");
    const percentEl = document.getElementById(cfg.nome.toLowerCase().split(" ")[1] + "Percent");
    if (valorEl && percentEl) {
      valorEl.textContent = `${valor.toFixed(0)} L`;
      percentEl.innerHTML = `
        <span style="color:${cor}; font-weight:bold">${porcent.toFixed(1)}%</span><br>
        <small style="color:#6cf">Mín: ${hist.min.toFixed(0)}L (${minP.toFixed(1)}%)</small><br>
        <small style="color:#f88">Máx: ${hist.max.toFixed(0)}L (${maxP.toFixed(1)}%)</small>
      `;
    }

    // Atualiza gauge
    desenharGauge(cfg.gaugeId, porcent, cor, cfg.nome);
  });

  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleString("pt-BR");
}

// === Gauge (tipo relógio) ===
function desenharGauge(canvasId, porcent, cor, titulo) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const size = 180;
  canvas.width = size;
  canvas.height = size;

  const center = size / 2;
  const radius = size * 0.4;
  ctx.clearRect(0, 0, size, size);

  // Fundo
  ctx.beginPath();
  ctx.arc(center, center, radius, Math.PI, 0);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 15;
  ctx.stroke();

  // Arco ativo
  const endAngle = Math.PI + (Math.PI * porcent) / 100;
  ctx.beginPath();
  ctx.arc(center, center, radius, Math.PI, endAngle);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 15;
  ctx.stroke();

  // Texto principal
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${porcent.toFixed(1)}%`, center, center + 10);

  // Nome do tanque
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#ccc";
  ctx.fillText(titulo, center, size - 10);
}

// === Relógio no rodapé ===
function atualizarRelogio() {
  const now = new Date();
  const clockEl = document.getElementById("clock");
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString("pt-BR", { hour12: false });
  }
}

// Atualizações automáticas
setInterval(carregarDados, 15000);
setInterval(atualizarRelogio, 1000);
carregarDados();
atualizarRelogio();
