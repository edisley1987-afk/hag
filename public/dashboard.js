// ===== dashboard.js (completo) =====
// Modelo A: card preenchendo TODO o card (tanque), persistência de última leitura,
// inatividade 10min, alarme <=30%, manutenção no servidor (se disponível) ou fallback localStorage.

const API_URL = window.location.origin + "/dados";
const API_MANUT = window.location.origin + "/api/manutencao"; // rota opcional no servidor
const UPDATE_INTERVAL = 5000;
const INATIVITY_MS = 10 * 60 * 1000;
const ALARM_INTERVAL_MS = 10000;

let ultimaLeitura = 0;
let ultimoDadosValidos = {}; // { key: numericValue }
let alarmando = false;
let alarmTimer = null;
let audioBip = null;
let manutencoes = {}; // { key: true }
let suportouApiManut = true; // tentaremos usar rota /api/manutencao, fallback para localStorage

// sensores
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current:  { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current:     { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 }
};
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current:"Pressão Retorno Osmose",
  Pressao_Saida_CME_current:     "Pressão Saída CME"
};
const ALL_KEYS = [...Object.keys(RESERVATORIOS), ...Object.keys(PRESSOES)];

// ------------------ Persistência manutenção (server or local) ------------------
async function carregarManutencoes() {
  try {
    const r = await fetch(API_MANUT);
    if (!r.ok) throw new Error("no-api");
    const arr = await r.json();
    manutencoes = {};
    (arr || []).forEach(i => { if (i.reservatorio) manutencoes[i.reservatorio] = !!i.status; });
    suportouApiManut = true;
    salvarManutencoesLocal();
    return;
  } catch (e) {
    suportouApiManut = false;
    const raw = localStorage.getItem("manutencoes_hag");
    try { manutencoes = raw ? JSON.parse(raw) : {}; } catch{ manutencoes = {}; }
  }
}
function salvarManutencoesLocal() {
  try { localStorage.setItem("manutencoes_hag", JSON.stringify(manutencoes)); } catch {}
}
async function setManutencaoServer(key, status) {
  try {
    const r = await fetch(API_MANUT, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ reservatorio: key, status })
    });
    if (!r.ok) throw new Error("no-save");
    manutencoes[key] = !!status;
    salvarManutencoesLocal();
    suportouApiManut = true;
    applyMaintenanceVisual(key);
    return true;
  } catch (e) {
    suportouApiManut = false;
    manutencoes[key] = !!status;
    salvarManutencoesLocal();
    applyMaintenanceVisual(key);
    return false;
  }
}

// ------------------ Audio / Alarm ------------------
function ensureAudio() {
  if (!audioBip) {
    audioBip = document.getElementById("alarmSound") || new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audioBip.preload = "auto";
  }
}
function pingOnce() {
  try {
    ensureAudio();
    audioBip.currentTime = 0;
    audioBip.play().catch(()=>{});
  } catch {}
}

function startAlarm() {
  if (alarmando) return;
  alarmando = true;

  // 🔴 alerta visual vermelho piscando
  const g = document.getElementById("globalAlert");
  g.style.display = "inline-block";
  g.classList.add("critico");

  pingOnce();
  alarmTimer = setInterval(()=>{ if (alarmando) pingOnce(); }, ALARM_INTERVAL_MS);
}

function stopAlarm() {
  alarmando = false;
  if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
  try { if (audioBip) { audioBip.pause(); audioBip.currentTime = 0; } } catch {}

  const g = document.getElementById("globalAlert");
  g.classList.remove("critico");
  g.style.display = "none";
}

// ------------------ Create cards ------------------
function criarCards() {
  const container = document.getElementById("cardsRow");
  container.innerHTML = "";

  // reservatórios
  Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
    const card = document.createElement("div");
    card.className = "card reservatorio";
    card.id = key;
    card.innerHTML = `
      <div class="fill" style="height:0%; background:#2ecc71;"></div>
      <div class="content">
        <div class="maint-toggle" title="Marcar / remover manutenção">🛠</div>
        <div class="maint-badge">EM MANUTENÇÃO</div>
        <div class="title">${cfg.nome}</div>
        <div class="percent-large">--%</div>
        <div class="liters">0 L</div>
        <div class="aviso-inatividade">⚠ Sem atualização há mais de 10 minutos!</div>
      </div>
    `;
    container.appendChild(card);

    const toggle = card.querySelector(".maint-toggle");
    toggle.addEventListener("click", async (e) => {
      e.stopPropagation();
      const cur = !!manutencoes[key];
      await setManutencaoServer(key, !cur);
      if (manutencoes[key]) stopAlarm();
    });
  });

  // pressões
  Object.entries(PRESSOES).forEach(([key, nome]) => {
    const card = document.createElement("div");
    card.className = "card pressao";
    card.id = key;
    card.innerHTML = `
      <div class="content">
        <div class="title">${nome}</div>
        <div class="percent-large">-- bar</div>
        <div class="liters">&nbsp;</div>
        <div class="aviso-inatividade">⚠ Sem atualização há mais de 10 minutos!</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ------------------ apply maintenance visual ------------------
function applyMaintenanceVisual(key) {
  const card = document.getElementById(key);
  if (!card) return;
  const badge = card.querySelector(".maint-badge");
  badge.style.display = manutencoes[key] ? "block" : "none";
}

// ------------------ Update display ------------------
function atualizarDisplay(dados) {
  const last = document.getElementById("lastUpdate");
  const ts = dados.timestamp ? new Date(dados.timestamp) : new Date();
  last.textContent = "Última atualização: " + ts.toLocaleString("pt-BR");
  ultimaLeitura = Date.now();

  let algumCritico = false;

  // reservatórios
  Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
    const card = document.getElementById(key);
    const fill = card.querySelector(".fill");
    const pctEl = card.querySelector(".percent-large");
    const ltsEl = card.querySelector(".liters");
    const aviso = card.querySelector(".aviso-inatividade");

    const valor = typeof dados[key] === "number" ? dados[key] : undefined;

    if (typeof valor === "number") {
      ultimoDadosValidos[key] = valor;
    }

    const usar = typeof valor === "number" ? valor : ultimoDadosValidos[key];

    if (typeof usar !== "number") {
      pctEl.textContent = "--%";
      ltsEl.textContent = "0 L";
      fill.style.height = "0%";
      fill.style.background = "#cccccc";
      aviso.style.display = "none";
      return;
    }

    const perc = Math.min(100, Math.max(0, (usar / cfg.capacidade) * 100));
    const roundPct = Math.round(perc);

    pctEl.textContent = roundPct + "%";
    ltsEl.textContent = usar.toLocaleString() + " L";
    fill.style.height = perc + "%";

    let cor = "#2ecc71";
    if (perc <= 30) cor = "#e74c3c";
    else if (perc < 70) cor = "#f1c40f";

    fill.style.background = cor;

    applyMaintenanceVisual(key);

    // 🔴 card crítico
    if (perc <= 30 && !manutencoes[key]) {
      algumCritico = true;
      card.classList.add("critico");
    } else {
      card.classList.remove("critico");
    }
  });

  // pressões
  Object.entries(PRESSOES).forEach(([key, nome]) => {
    const card = document.getElementById(key);
    const pctEl = card.querySelector(".percent-large");
    const aviso = card.querySelector(".aviso-inatividade");

    const valor = typeof dados[key] === "number" ? dados[key] : ultimoDadosValidos[key];

    if (typeof valor !== "number") {
      pctEl.textContent = "-- bar";
      aviso.style.display = "none";
      return;
    }

    pctEl.textContent = Number(valor).toFixed(2) + " bar";
    aviso.style.display = "none";
    ultimoDadosValidos[key] = valor;
  });

  // 🔴 lógica de alarme
  if (algumCritico) startAlarm();
  else stopAlarm();
}

// ------------------ cache fallback ------------------
function usarCacheSeNecessario() {
  const dados = { timestamp: new Date().toISOString() };
  Object.keys(ultimoDadosValidos).forEach(k => dados[k] = ultimoDadosValidos[k]);
  if (Object.keys(ultimoDadosValidos).length) atualizarDisplay(dados);
}

// ------------------ fetch ------------------
async function buscarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("fetch-fail");
    const dados = await res.json();

    if (!dados.timestamp) dados.timestamp = new Date().toISOString();

    Object.keys(dados).forEach(k => {
      if (ALL_KEYS.includes(k) && typeof dados[k] === "number") {
        ultimoDadosValidos[k] = dados[k];
      }
    });

    atualizarDisplay(dados);
  } catch (e) {
    usarCacheSeNecessario();
  }
}

// ------------------ inactivity ------------------
function verificarInatividade() {
  const now = Date.now();
  if (!ultimaLeitura || (now - ultimaLeitura) > INATIVITY_MS) {

    document.querySelectorAll(".card").forEach(card => {
      const aviso = card.querySelector(".aviso-inatividade");
      if (aviso) aviso.style.display = "block";

      const id = card.id;
      if (ultimoDadosValidos[id] === undefined) {
        card.classList.add("no-data");
        const pctEl = card.querySelector(".percent-large");
        if (pctEl) pctEl.textContent = "--%";
        const ltsEl = card.querySelector(".liters");
        if (ltsEl) ltsEl.textContent = "0 L";
        const fill = card.querySelector(".fill");
        if (fill) fill.style.height = "0%";
      }
    });

    stopAlarm();
  } else {
    document.querySelectorAll(".card .aviso-inatividade").forEach(el => el.style.display = "none");
  }
}

// ------------------ init ------------------
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const raw = localStorage.getItem("ultimoDadosValidos_hag");
    if (raw) ultimoDadosValidos = JSON.parse(raw);
  } catch {}

  await carregarManutencoes();
  criarCards();

  Object.keys(manutencoes).forEach(k => applyMaintenanceVisual(k));

  const back = document.getElementById("btnBack");
  const hist = document.getElementById("btnHistorico");
  if (back) back.addEventListener("click", () => window.history.back());
  if (hist) hist.addEventListener("click", () => window.location.href = "historico.html");

  buscarDados();

  setInterval(async () => {
    await buscarDados();
    localStorage.setItem("ultimoDadosValidos_hag", JSON.stringify(ultimoDadosValidos));
  }, UPDATE_INTERVAL);

  setInterval(verificarInatividade, 8000);
});
