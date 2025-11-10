document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Página carregada, inicializando dashboard...");
  atualizarDashboard();
  setInterval(atualizarDashboard, 15000);
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
});

const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

// === Atualiza os valores dos reservatórios ===
async function atualizarDashboard() {
  const res = await fetch(API_URL + "?t=" + Date.now());
  const dados = await res.json();

  if (!dados || Object.keys(dados).length === 0) {
    console.warn("⚠️ Nenhum dado recebido do servidor.");
    return;
  }

  const sensores = [
    { nome: "Elevador", ref: "Reservatorio_Elevador_current", capacidade: 20000 },
    { nome: "Osmose", ref: "Reservatorio_Osmose_current", capacidade: 200 },
    { nome: "CME", ref: "Reservatorio_CME_current", capacidade: 1000 },
    { nome: "Abrandada", ref: "Agua_Abrandada_current", capacidade: 9000 },
  ];

  sensores.forEach((s) => {
    const valor = dados[s.ref] || 0;
    const porcent = (valor / s.capacidade) * 100;

    const valorElem = document.getElementById(`${s.nome.toLowerCase()}Valor`);
    const percentElem = document.getElementById(`${s.nome.toLowerCase()}Percent`);

    if (valorElem && percentElem) {
      valorElem.textContent = `${valor.toFixed(0)} L`;
      percentElem.textContent = `${porcent.toFixed(1)}%`;

      // Mudar cor de alerta
      let cor = "#00c9a7";
      if (porcent < 30) cor = "#e53935";
      else if (porcent < 50) cor = "#fbc02d";
      percentElem.style.color = cor;
      valorElem.style.color = cor;
    }

    // Atualiza o "reloginho" tipo gauge
    const canvas = document.getElementById(`relogio${s.nome}`);
    if (canvas) desenharGauge(canvas, porcent, s.nome);
  });

  const last = document.getElementById("lastUpdate");
  if (last && dados.timestamp) {
    last.textContent = "Última atualização: " +
      new Date(dados.timestamp).toLocaleString("pt-BR");
  }
}

// === Relógio do rodapé ===
function atualizarRelogio() {
  const agora = new Date();
  const clock = document.getElementById("clock");
  if (clock) {
    clock.textContent = agora.toLocaleTimeString("pt-BR", { hour12: false });
  }
}

// === Gauge tipo relógio ===
function desenharGauge(canvas, porcentagem, nome) {
  const ctx = canvas.getContext("2d");
  const largura = canvas.width = 200;
  const altura = canvas.height = 200;
  const centro = { x: largura / 2, y: altura / 2 };
  const raio = 80;

  ctx.clearRect(0, 0, largura, altura);

  // Fundo
  ctx.beginPath();
  ctx.arc(centro.x, centro.y, raio, 0.75 * Math.PI, 0.25 * Math.PI);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 15;
  ctx.stroke();

  // Cor do nível
  let cor = "#00c9a7";
  if (porcentagem < 30) cor = "#e53935";
  else if (porcentagem < 50) cor = "#fbc02d";

  const angulo = (0.75 + (porcentagem / 100) * 1.5) * Math.PI;
  ctx.beginPath();
  ctx.arc(centro.x, centro.y, raio, 0.75 * Math.PI, angulo);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 15;
  ctx.lineCap = "round";
  ctx.stroke();

  // Texto central
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${porcentagem.toFixed(1)}%`, centro.x, centro.y + 10);

  ctx.font = "12px Poppins, sans-serif";
  ctx.fillText(nome, centro.x, centro.y + 30);
}
