// ======== CONFIGURAÇÃO ========
const API_URL = "/dados"; // endpoint do servidor

// Config dos reservatórios (igual no servidor)
const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": {
    nome: "Reservatório Elevador",
    leituraVazio: 4168,
    alturaRes: 1.45,
    capacidadeTotal: 20000,
  },
  "Reservatorio_Osmose_current": {
    nome: "Reservatório Osmose",
    leituraVazio: 505,
    alturaRes: 1.0,
    capacidadeTotal: 200,
  },
  "Reservatorio_CME_current": {
    nome: "Reservatório CME",
    leituraVazio: 4088,
    alturaRes: 0.45,
    capacidadeTotal: 1000,
  },
};

// ======== FUNÇÕES AUXILIARES ========
function calcularNivel(leitura, config) {
  const { leituraVazio, capacidadeTotal } = config;
  const perc = Math.max(
    0,
    Math.min(100, ((leituraVazio - leitura) / leituraVazio) * 100)
  );
  const litros = (capacidadeTotal * perc) / 100;
  return { perc, litros };
}

function corDoNivel(perc) {
  if (perc < 30) return "#ff4d4d"; // vermelho
  if (perc < 60) return "#ffcc00"; // amarelo
  return "#2ecc71"; // verde
}

// ======== GAUGE ========
function desenharGauge(canvas, perc, color, nome, litros, capacidade) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const center = size / 2;
  const radius = size * 0.4;
  ctx.clearRect(0, 0, size, size);

  // Fundo do gauge
  ctx.beginPath();
  ctx.arc(center, center, radius, Math.PI, 0);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 15;
  ctx.stroke();

  // Nível
  ctx.beginPath();
  ctx.arc(center, center, radius, Math.PI, Math.PI + (Math.PI * perc) / 100, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = 15;
  ctx.stroke();

  // Texto
  ctx.font = "bold 18px Poppins";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(`${nome}`, center, center + 50);
  ctx.font = "bold 24px Poppins";
  ctx.fillText(`${perc.toFixed(1)}%`, center, center + 15);
  ctx.font = "14px Poppins";
  ctx.fillText(`${litros.toFixed(0)} L / ${capacidade} L`, center, center + 75);
}

// ======== ATUALIZAÇÃO ========
async function atualizarDashboard() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    const lastUpdate = new Date().toLocaleString("pt-BR");
    document.getElementById("lastUpdate").textContent = `Última atualização: ${lastUpdate}`;

    const cardsContainer = document.getElementById("cards");
    cardsContainer.innerHTML = "";

    Object.keys(SENSOR_CONFIG).forEach((key) => {
      const config = SENSOR_CONFIG[key];
      const leitura = data[key];
      if (leitura === undefined) return;

      const { perc, litros } = calcularNivel(leitura, config);
      const color = corDoNivel(perc);

      // Card fixo
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${config.nome}</h3>
        <p><strong>${litros.toFixed(0)} L</strong> (${perc.toFixed(1)}%)</p>
      `;
      card.style.borderColor = color;
      card.style.boxShadow = `0 0 10px ${color}`;
      cardsContainer.appendChild(card);

      // Cria canvas para gauge
      let gauge = document.getElementById(`gauge-${key}`);
      if (!gauge) {
        gauge = document.createElement("canvas");
        gauge.id = `gauge-${key}`;
        gauge.width = 200;
        gauge.height = 120;
        document.querySelector(".grafico").appendChild(gauge);
      }
      desenharGauge(gauge, perc, color, config.nome, litros, config.capacidadeTotal);
    });
  } catch (err) {
    console.error("Erro ao atualizar dashboard:", err);
  }
}

// Atualiza a cada 5 segundos
setInterval(atualizarDashboard, 5000);
atualizarDashboard();
