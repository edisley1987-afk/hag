const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

// Aguarda o carregamento total do DOM antes de rodar
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Página carregada, inicializando dashboard...");
  iniciarDashboard();
});

function iniciarDashboard() {
  carregarDados();
  setInterval(carregarDados, 15000); // Atualiza a cada 15 segundos
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
}

async function carregarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();
    atualizarDashboard(dados);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

function atualizarDashboard(dados) {
  const cardsContainer = document.getElementById("cards");
  const gaugesContainer = document.getElementById("graficoContainer");

  if (!cardsContainer || !gaugesContainer) {
    console.error("❌ Elementos do dashboard não encontrados no DOM.");
    return;
  }

  cardsContainer.innerHTML = "";
  gaugesContainer.innerHTML = "";

  const reservatorios = [];
  const pressoes = [];

  Object.entries(dados).forEach(([key, valor]) => {
    if (key === "timestamp") return;

    if (key.toLowerCase().includes("pressao")) {
      pressoes.push({ nome: formatarNome(key), valor });
      return;
    }

    reservatorios.push({
      nome: formatarNome(key),
      valor,
      capacidade: obterCapacidade(key),
    });
  });

  // === Renderizar Cards ===
  reservatorios.forEach((res) => {
    const porcent = (res.valor / res.capacidade) * 100;
    let cor = "#00c9a7";
    if (porcent < 30) cor = "#e53935";
    else if (porcent < 50) cor = "#fbc02d";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${res.nome}</h2>
      <div class="progress">
        <div class="progress-fill" style="width:${porcent.toFixed(1)}%; background:${cor}"></div>
      </div>
      <div class="valor" style="color:${cor}">
        ${res.valor.toFixed(0)} L (${porcent.toFixed(1)}%)
      </div>
    `;
    cardsContainer.appendChild(card);

    // Criar Gauge correspondente
    const gauge = document.createElement("div");
    const percentGraus = (porcent / 100) * 360;
    let gaugeClass = "high";
    if (porcent < 30) gaugeClass = "low";
    else if (porcent < 50) gaugeClass = "medium";

    gauge.className = `gauge ${gaugeClass}`;
    gauge.style.setProperty("--percent", `${percentGraus}deg`);
    gauge.innerHTML = `
      <div class="label">
        <strong>${res.nome}</strong><br>
        ${porcent.toFixed(1)}%
      </div>
    `;
    gaugesContainer.appendChild(gauge);
  });

  // Atualizar data/hora
  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + new Date().toLocaleString("pt-BR");
}

function atualizarRelogio() {
  const relogio = document.getElementById("relogio");
  if (!relogio) return;
  const agora = new Date();
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  const segundos = String(agora.getSeconds()).padStart(2, "0");
  relogio.textContent = `🕒 ${horas}:${minutos}:${segundos}`;
}

function formatarNome(chave) {
  return chave
    .replace("Reservatorio_", "Reservatório ")
    .replace("Agua_", "Água ")
    .replace("Pressao_", "Pressão ")
    .replace("_current", "")
    .replace(/_/g, " ");
}

function obterCapacidade(nome) {
  if (nome.includes("Elevador")) return 20000;
  if (nome.includes("Osmose")) return 200;
  if (nome.includes("CME")) return 1000;
  if (nome.includes("Abrandada")) return 9000;
  return 1000;
}
