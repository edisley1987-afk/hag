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
  // tenta carregar do server
  try {
    const r = await fetch(API_MANUT);
    if (!r.ok) throw new Error("no-api");
    const arr = await r.json(); // espera lista [{ reservatorio: 'Reservatorio_Elevador_current', status:true }, ...]
    manutencoes = {};
    (arr || []).forEach(i => { if (i.reservatorio) manutencoes[i.reservatorio] = !!i.status; });
    suportouApiManut = true;
    salvarManutencoesLocal(); // atualizar local com fallback
    return;
  } catch (e) {
    suportouApiManut = false;
    // fallback para localStorage
    const raw = localStorage.getItem("manutencoes_hag");
    try { manutencoes = raw ? JSON.parse(raw) : {}; } catch{ manutencoes = {}; }
  }
}
function salvarManutencoesLocal() {
  try { localStorage.setItem("manutencoes_hag", JSON.stringify(manutencoes)); } catch {}
}
async function setManutencaoServer(key, status) {
  // tenta salvar no servidor; se falhar, salva local e marca suportouApiManut=false
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
    audioBip.play().catch(()=>{ /* blocked until user gesture */ });
  } catch {}
}
function startAlarm() {
  if (alarmando) return;
  alarmando = true;
  pingOnce();
  alarmTimer = setInterval(()=>{ if (alarmando) pingOnce(); }, ALARM_INTERVAL_MS);
  document.getElementById("globalAlert").style.display = "inline-block";
}
function stopAlarm() {
  alarmando = false;
  if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
  try { if (audioBip) { audioBip.pause(); audioBip.currentTime = 0; } } catch {}
  document.getElementById("globalAlert").style.display = "none";
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

    // toggle manutenção
    const toggle = card.querySelector(".maint-toggle");
    toggle.addEventListener("click", async (e) => {
      e.stopPropagation();
      const cur = !!manutencoes[key];
      await setManutencaoServer(key, !cur);
      // if marked maintenance, stop alarm
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
  if (manutencoes[key]) badge.style.display = "block";
  else badge.style.display = "none";
}

// ------------------ Update display using last known values ------------------
function atualizarDisplay(dados) {
  // timestamp
  const last = document.getElementById("lastUpdate");
  const ts = dados.timestamp ? new Date(dados.timestamp) : new Date();
  last.textContent = "Última atualização: " + ts.toLocaleString("pt-BR");
  ultimaLeitura = Date.now();

  let algumCritico = false;

  // reservatórios
  Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
    const card = document.getElementById(key);
    if (!card) return;
    const fill = card.querySelector(".fill");
    const pctEl = card.querySelector(".percent-large");
    const ltsEl = card.querySelector(".liters");
    const aviso = card.querySelector(".aviso-inatividade");

    const valor = (typeof dados[key] === "number") ? dados[key] : undefined;

    if (typeof valor === "number") {
      // save last valid
      ultimoDadosValidos[key] = valor;
    }

    // use last valid if current missing
    const usar = (typeof valor === "number") ? valor : ultimoDadosValidos[key];

    if (typeof usar !== "number") {
      // no data at all
      pctEl.textContent = "--%";
      ltsEl.textContent = "0 L";
      if (fill) { fill.style.height = "0%"; fill.style.background = "#cccccc"; }
      if (aviso) aviso.style.display = "none";
      card.classList.add("no-data");
      return;
    }

    // compute %
    const perc = Math.min(100, Math.max(0, (usar / cfg.capacidade) * 100));
    const roundPct = Math.round(perc);
    pctEl.textContent = roundPct + "%";
    ltsEl.textContent = usar.toLocaleString() + " L";

    // set fill full-card height
    if (fill) {
      fill.style.height = perc + "%";
      // color by threshold
      let cor = "#2ecc71";
      if (perc <= 30) cor = "#e74c3c";
      else if (perc < 70) cor = "#f1c40f";
      fill.style.background = cor;
    }

    card.classList.remove("no-data");
    if (aviso) aviso.style.display = "none";

    // maintenance badge application
    applyMaintenanceVisual(key);

    // decide critical
    if (perc <= 30 && !manutencoes[key]) {
      algumCritico = true;
    }
  });

  // pressões
  Object.entries(PRESSOES).forEach(([key, nome]) => {
    const card = document.getElementById(key);
    if (!card) return;
    const pctEl = card.querySelector(".percent-large");
    const aviso = card.querySelector(".aviso-inatividade");
    const valor = (typeof dados[key] === "number") ? dados[key] : ultimoDadosValidos[key];

    if (typeof valor !== "number") {
      pctEl.textContent = "-- bar";
      if (aviso) aviso.style.display = "none";
      card.classList.add("no-data");
      return;
    }
    pctEl.textContent = Number(valor).toFixed(2) + " bar";
    if (aviso) aviso.style.display = "none";
    card.classList.remove("no-data");
    ultimoDadosValidos[key] = valor;
  });

  // alarm logic
  if (algumCritico) startAlarm();
  else stopAlarm();
}

// ------------------ If fetch fails, reapply cached display ------------------
function usarCacheSeNecessario() {
  const dados = { timestamp: new Date().toISOString() };
  Object.keys(ultimoDadosValidos).forEach(k => dados[k] = ultimoDadosValidos[k]);
  if (Object.keys(ultimoDadosValidos).length) atualizarDisplay(dados);
}

// ------------------ fetch data ------------------
async function buscarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("fetch-fail");
    const dados = await res.json();

    // save timestamp from server if any
    if (!dados.timestamp) dados.timestamp = new Date().toISOString();

    // update last valid per keys
    Object.keys(dados).forEach(k => {
      if (ALL_KEYS.includes(k) && typeof dados[k] === "number") {
        ultimoDadosValidos[k] = dados[k];
      }
    });

    atualizarDisplay(dados);
  } catch (e) {
    // fallback: keep showing cached values
    usarCacheSeNecessario();
  }
}

// ------------------ inactivity check ------------------
function verificarInatividade() {
  const now = Date.now();
  if (!ultimaLeitura || (now - ultimaLeitura) > INATIVITY_MS) {
    // show inactivity message but keep last values displayed
    document.querySelectorAll(".card").forEach(card => {
      const aviso = card.querySelector(".aviso-inatividade");
      if (aviso) aviso.style.display = "block";

      // also mark no-data visually if no last value
      const id = card.id;
      if (ultimoDadosValidos[id] === undefined) {
        card.classList.add("no-data");
        const pctEl = card.querySelector(".percent-large");
        if (pctEl) pctEl.textContent = "--%";
        const ltsEl = card.querySelector(".liters");
        if (ltsEl) ltsEl.textContent = "0 L";
        const fill = card.querySelector(".fill");
        if (fill) { fill.style.height = "0%"; fill.style.background = "#cccccc"; }
      } else {
        // keep last shown values; ensure fill color correct (recompute)
        if (RESERVATORIOS[id]) {
          const perc = Math.min(100, Math.max(0, (ultimoDadosValidos[id] / RESERVATORIOS[id].capacidade)*100));
          const fill = card.querySelector(".fill");
          if (fill) {
            fill.style.height = perc + "%";
            let cor = "#2ecc71";
            if (perc <= 30) cor = "#e74c3c";
            else if (perc < 70) cor = "#f1c40f";
            fill.style.background = cor;
          }
        }
      }
    });
    stopAlarm();
  } else {
    document.querySelectorAll(".card .aviso-inatividade").forEach(el => el.style.display = "none");
  }
}

// ------------------ init ------------------
window.addEventListener("DOMContentLoaded", async () => {
  // load persisted last readings and manutenções
  try {
    const raw = localStorage.getItem("ultimoDadosValidos_hag");
    if (raw) { ultimoDadosValidos = JSON.parse(raw); }
  } catch { ultimoDadosValidos = {}; }

  await carregarManutencoes();
  criarCards();
  // apply maintenance visuals for any saved
  Object.keys(manutencoes).forEach(k => applyMaintenanceVisual(k));

  // top buttons
  const back = document.getElementById("btnBack");
  const hist = document.getElementById("btnHistorico");
  if (back) back.addEventListener("click", () => window.history.back());
  if (hist) hist.addEventListener("click", () => window.location.href = "historico.html");

  // first fetch
  buscarDados();

  // intervals
  setInterval(async () => {
    await buscarDados();
    // persist ultimoDadosValidos local
    try { localStorage.setItem("ultimoDadosValidos_hag", JSON.stringify(ultimoDadosValidos)); } catch {}
  }, UPDATE_INTERVAL);

  setInterval(verificarInatividade, 8000);
});
