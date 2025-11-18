const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
let ultimaLeituraMs = 0;
let alarmPlaying = false;

// CAPACIDADES
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 }
};

// cria cards
function criarCards() {
  const container = document.querySelector(".cards-container");
  container.innerHTML = "";

  Object.keys(RESERVATORIOS).forEach((id) => {
    const div = document.createElement("div");
    div.className = "card";
    div.id = id;

    div.innerHTML = `
      <div class="nivel-agua"></div>
      <h2>${RESERVATORIOS[id].nome}</h2>
      <div class="percentual">--%</div>
      <div class="litros">0 L</div>
      <div class="alerta-atraso" style="display:none;">Sem atualização há +10 min</div>
    `;

    container.appendChild(div);
  });
}

// tocar alarme
function tocarAlarme() {
  if (!alarmPlaying) {
    const audio = document.getElementById("alarmSound");
    audio.volume = 0.8;
    audio.play();
    alarmPlaying = true;
  }
}
function pararAlarme() {
  alarmPlaying = false;
  const audio = document.getElementById("alarmSound");
  audio.pause();
  audio.currentTime = 0;
}

// atualizar leitura
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();

    ultimaLeituraMs = Date.now();

    Object.entries(RESERVATORIOS).forEach(([id, config]) => {
      const card = document.getElementById(id);
      const nivel = card.querySelector(".nivel-agua");
      const percEl = card.querySelector(".percentual");
      const litrosEl = card.querySelector(".litros");
      const atraso = card.querySelector(".alerta-atraso");

      const valorLitros = dados[id];
      if (typeof valorLitros !== "number") return;

      const perc = Math.min(100, Math.max(0, (valorLitros / config.capacidade) * 100));

      // Atualiza barra
      card.style.setProperty("--nivel", perc + "%");

      // Cores
      let cor = "#2ecc71"; // verde
      if (perc < 30) cor = "#e74c3c"; // vermelho
      else if (perc < 60) cor = "#f1c40f"; // amarelo

      card.style.setProperty("--corNivel", cor);

      // textos
      percEl.textContent = perc.toFixed(0) + "%";
      litrosEl.textContent = valorLitros.toLocaleString() + " L";

      // alarme abaixo de 30%
      if (perc < 30) tocarAlarme();
      else pararAlarme();

      atraso.style.display = "none";
    });

    // Atualização no topo
    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString("pt-BR");

  } catch (e) {
    console.log("Erro ao atualizar:", e);
  }
}

// se ficar +10 min sem atualizar
setInterval(() => {
  const dif = Date.now() - ultimaLeituraMs;

  if (dif > 10 * 60 * 1000) {
    document.querySelectorAll(".card").forEach((card) => {
      card.querySelector(".alerta-atraso").style.display = "block";
      pararAlarme();
    });
  }
}, 3000);

window.addEventListener("DOMContentLoaded", () => {
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});
