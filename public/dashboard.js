// ===== dashboard.js (completo e corrigido) =====

// --- CONFIG ---
const API_URL = window.location.origin + "/dados";
const API_MANUT = window.location.origin + "/api/manutencao";
const UPDATE_INTERVAL = 5000;
const INATIVITY_MS = 10 * 60 * 1000;
const ALARM_INTERVAL_MS = 10000;

let ultimaLeitura = 0;
let ultimoDadosValidos = {};
let manutencoes = {};
let suportouApiManut = true;
let alarmando = false;
let alarmTimer = null;
let audioBip = null;

// Tabela oficial dos sensores (corrigido)
const CURVAS = {
  Reservatorio_Elevador_current:      { vazio: 0.004168, cheio: 0.008742, capacidade: 20000 },
  Reservatorio_Osmose_current:        { vazio: 0.005050, cheio: 0.006492, capacidade: 200 },
  Reservatorio_CME_current:           { vazio: 0.004088, cheio: 0.004408, capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current:{ vazio: 0.004048, cheio: 0.006515, capacidade: 9000 }
};

const RESERVATORIOS = {
  Reservatorio_Elevador_current:      { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current:        { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current:           { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current:{ nome: "Água Abrandada", capacidade: 9000 }
};

const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current:"Pressão Retorno Osmose",
  Pressao_Saida_CME_current:     "Pressão Saída CME"
};

const ALL_KEYS = [...Object.keys(RESERVATORIOS), ...Object.keys(PRESSOES)];


// ------------------ Função de cálculo REAL ------------------
function calcularPercentual(key, valor) {
  const c = CURVAS[key];
  if (!c) return 0;
  
  let pct = ((valor - c.vazio) / (c.cheio - c.vazio)) * 100;

  // Limites obrigatórios
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  return pct;
}


// ------------------ Persistência de manutenção ------------------
async function carregarManutencoes() {
  try {
    const r = await fetch(API_MANUT);
    if (!r.ok) throw new Error("API falhou");
    const arr = await r.json();
    manutencoes = {};
    (arr || []).forEach(i => manutencoes[i.reservatorio] = !!i.status);
    suportouApiManut = true;
    localStorage.setItem("manutencoes_hag", JSON.stringify(manutencoes));
  } catch {
    suportouApiManut = false;
    try {
      manutencoes = JSON.parse(localStorage.getItem("manutencoes_hag")) || {};
    } catch { manutencoes = {}; }
  }
}


// ------------------ Áudio / Alarme ------------------
function ensureAudio() {
  if (!audioBip) {
    audioBip = document.getElementById("alarmSound") ||
               new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  }
}

function pingOnce() {
  ensureAudio();
  audioBip.currentTime = 0;
  audioBip.play().catch(()=>{});
}

function startAlarm() {
  if (alarmando) return;
  alarmando = true;

  document.getElementById("globalAlert").style.display = "inline-block";

  pingOnce();
  alarmTimer = setInterval(pingOnce, ALARM_INTERVAL_MS);
}

function stopAlarm() {
  alarmando = false;
  clearInterval(alarmTimer);
  alarmTimer = null;

  document.getElementById("globalAlert").style.display = "none";
  if (audioBip) audioBip.pause();
}


// ------------------ Criação dos Cards ------------------
function criarCards() {
  const container = document.getElementById("cardsRow");
  container.innerHTML = "";

  Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
    const card = document.createElement("div");
    card.className = "card reservatorio";
    card.id = key;

    card.innerHTML = `
      <div class="fill" style="height:0%; background:#2ecc71;"></div>
      <div class="content">
        <div class="title">${cfg.nome}</div>
        <div class="percent-large">--%</div>
        <div class="liters">0 L</div>
        <div class="aviso-inatividade">⚠ Sem atualização há mais de 10 minutos!</div>
      </div>
    `;

    container.appendChild(card);
  });

  Object.entries(PRESSOES).forEach(([key, nome]) => {
    const card = document.createElement("div");
    card.className = "card pressao";
    card.id = key;

    card.innerHTML = `
      <div class="content">
        <div class="title">${nome}</div>
        <div class="percent-large">-- bar</div>
        <div class="aviso-inatividade">⚠ Sem atualização há mais de 10 minutos!</div>
      </div>
    `;

    container.appendChild(card);
  });
}


// ------------------ Atualização do Display ------------------
function atualizarDisplay(dados) {
  ultimaLeitura = Date.now();
  let algumCritico = false;

  // Reservatórios
  Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
    const card = document.getElementById(key);
    const valor = dados[key];

    if (typeof valor === "number") ultimoDadosValidos[key] = valor;

    const usar = ultimoDadosValidos[key];
    if (usar === undefined) return;

    const pct = calcularPercentual(key, usar);
    const litros = Math.round((pct / 100) * CURVAS[key].capacidade);

    const fill = card.querySelector(".fill");
    const pctEl = card.querySelector(".percent-large");
    const ltsEl = card.querySelector(".liters");

    pctEl.textContent = Math.round(pct) + "%";
    ltsEl.textContent = litros.toLocaleString() + " L";
    fill.style.height = pct + "%";

    let cor = "#2ecc71";
    if (pct <= 30) cor = "#e74c3c";
    else if (pct < 70) cor = "#f1c40f";

    fill.style.background = cor;

    if (pct <= 30) algumCritico = true;
  });

  // Pressões
  Object.entries(PRESSOES).forEach(([key]) => {
    const card = document.getElementById(key);
    const valor = dados[key];

    if (typeof valor === "number") ultimoDadosValidos[key] = valor;

    const usar = ultimoDadosValidos[key];
    if (usar === undefined) return;

    card.querySelector(".percent-large").textContent =
      Number(usar).toFixed(2) + " bar";
  });

  // Alarme global
  if (algumCritico) startAlarm();
  else stopAlarm();
}


// ------------------ Fetch de dados ------------------
async function buscarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error();
    const dados = await res.json();
    atualizarDisplay(dados);
  } catch {
    atualizarDisplay(ultimoDadosValidos);
  }
}


// ------------------ Inatividade ------------------
function verificarInatividade() {
  if (Date.now() - ultimaLeitura > INATIVITY_MS) {
    document.querySelectorAll(".aviso-inatividade").forEach(e => e.style.display = "block");
  }
}


// ------------------ INIT ------------------
window.addEventListener("DOMContentLoaded", () => {
  try {
    ultimoDadosValidos = JSON.parse(localStorage.getItem("ultimoDadosValidos_hag")) || {};
  } catch {}

  criarCards();
  buscarDados();

  setInterval(() => {
    buscarDados();
    localStorage.setItem("ultimoDadosValidos_hag", JSON.stringify(ultimoDadosValidos));
  }, UPDATE_INTERVAL);

  setInterval(verificarInatividade, 8000);
});
