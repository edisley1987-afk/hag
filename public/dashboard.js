// public/dashboard.js
// Dashboard frontend — compatível com /api/dashboard
// Versão final: suporte completo a bombas de circulação (alternadas, 15 min)

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; // ms
const WARNING_TIMEOUT = 10 * 60 * 1000; // 10 minutos

const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
const bombasContainer = document.getElementById("bombasContainer"); // container no HTML
const lastUpdateEl = document.getElementById("lastUpdate");

// Banner de aviso (global)
let avisoEl = document.getElementById("aviso-atraso");
if (!avisoEl) {
  avisoEl = document.createElement("div");
  avisoEl.id = "aviso-atraso";
  avisoEl.textContent = "⚠ Sem atualização há mais de 10 minutos";
  document.body.prepend(avisoEl);
}

// utilitário
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function formatNumber(n) {
  if (n == null || n === "--") return "--";
  return Number(n).toLocaleString("pt-BR");
}

function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// -----------------------------------------------------------------------------
// Configurações de comportamento das bombas
// -----------------------------------------------------------------------------
const BOMBA_ON_MS = 15 * 60 * 1000;   // 15 minutos em ms
const BOMBA_TOLERANCIA_MS = 3 * 60 * 1000; // 3 minutos tolerância
const NENHUMA_LIGADA_ALERT_MS = BOMBA_ON_MS + BOMBA_TOLERANCIA_MS; // 18 min

// Estado local para acompanhar transições/tempos
window._bombaState = window._bombaState || {
  bomba01: {
    lastBinary: 0,
    startTs: null,
    lastOnTs: null,
    lastCycle: null,
    lastRunMs: null
  },
  bomba02: {
    lastBinary: 0,
    startTs: null,
    lastOnTs: null,
    lastCycle: null,
    lastRunMs: null
  }
};

// Render inicial: cria cards vazios
function criarEstruturaInicial(reservatorios, pressoes) {
  reservatoriosContainer.innerHTML = "";
  pressoesContainer.innerHTML = "";
  bombasContainer && (bombasContainer.innerHTML = "");

  // ===============================
  // RESERVATÓRIOS (NÃO ALTERADO)
  // ===============================
  reservatorios.forEach(r => {
    const id = `res_${r.setor}`;
    const card = document.createElement("div");
    card.className = "card-reservatorio";
    card.id = id;

    card.innerHTML = `
      <h3 class="titulo-card">${r.nome}</h3>

      <div class="tanque-visu">
        <div class="nivel-agua" id="${id}_nivel" style="height:0%"></div>
        <div class="overlay-info">
          <div class="percent-text" id="${id}_percent">--%</div>
          <div class="liters-text" id="${id}_litros">-- L</div>
        </div>
      </div>

      <div class="alerta-msg" id="${id}_alerta" style="display:none;">⚠ Nível crítico (abaixo de 30%)</div>

      <div class="manutencao-container">
        <label>
          <input type="checkbox" class="manutencao-check" id="${id}_manut">
          Em manutenção
        </label>
        <div class="manutencao-tag" id="${id}_tag" style="display:none;">EM MANUTENÇÃO</div>
      </div>

      <div class="card-actions">
        <div class="capacidade" id="${id}_cap">Capacidade: ${formatNumber(r.capacidade ?? "--")} L</div>
        <button class="btn-hist" data-setor="${r.setor}">Ver histórico</button>
      </div>
    `;

    card.querySelector(".btn-hist").addEventListener("click", (e) => {
      const setor = e.currentTarget.dataset.setor;
      window.location.href = `/historico-view?reservatorio=${encodeURIComponent(setor)}`;
    });

    reservatoriosContainer.appendChild(card);
  });

  // pressões
  pressoes.forEach(p => {
    const id = `pres_${p.setor}`;
    const card = document.createElement("div");
    card.className = "card-pressao";
    card.id = id;

    card.innerHTML = `
      <h3 class="titulo-card">${p.nome}</h3>
      <div class="pressao-valor" id="${id}_valor">--</div>
      <div class="pressao-unidade">bar</div>
    `;

    pressoesContainer.appendChild(card);
  });

  // bombas
  if (bombasContainer) {
    bombasContainer.innerHTML = `
      <div class="card card-bomba" id="card-bomba-01">
        <h3>Bomba 01 (Circulação)</h3>
        <div><strong>Status:</strong> <span id="status-bomba-01">--</span></div>
        <div><strong>Ciclos:</strong> <span id="ciclos-bomba-01">--</span></div>
        <div><strong>Tempo ligada:</strong> <span id="tempo-bomba-01">--:--</span></div>
        <div><strong>Último ON:</strong> <span id="ultimoon-bomba-01">--</span></div>
        <div id="alerta-bomba-01" class="alerta" style="display:none;color:#b71c1c;font-weight:bold;">⚠</div>
      </div>

      <div class="card card-bomba" id="card-bomba-02">
        <h3>Bomba 02 (Circulação)</h3>
        <div><strong>Status:</strong> <span id="status-bomba-02">--</span></div>
        <div><strong>Ciclos:</strong> <span id="ciclos-bomba-02">--</span></div>
        <div><strong>Tempo ligada:</strong> <span id="tempo-bomba-02">--:--</span></div>
        <div><strong>Último ON:</strong> <span id="ultimoon-bomba-02">--</span></div>
        <div id="alerta-bomba-02" class="alerta" style="display:none;color:#b71c1c;font-weight:bold;">⚠</div>
      </div>
    `;
  }
}

// Atualiza valores sem recriar DOM
function atualizarValores(data) {
  // ------------------------------
  // RESERVATÓRIOS (NÃO ALTERADO)
  // ------------------------------
  if (!data || !Array.isArray(data.reservatorios)) return;

  data.reservatorios.forEach(r => {
    const id = `res_${r.setor}`;
    const nivelEl = document.getElementById(`${id}_nivel`);
    const pctEl = document.getElementById(`${id}_percent`);
    const litrEl = document.getElementById(`${id}_litros`);
    const capEl = document.getElementById(`${id}_cap`);
    const alertaEl = document.getElementById(`${id}_alerta`);
    const manutCheck = document.getElementById(`${id}_manut`);
    const manutTag = document.getElementById(`${id}_tag`);
    const card = document.getElementById(id);

    const percent = r.percent ?? window._ultimaPercent?.[r.setor] ?? null;
    const liters = r.current_liters ?? window._ultimaLitros?.[r.setor] ?? null;
    const capacidade = r.capacidade ?? window._ultimaCapacidade?.[r.setor] ?? null;

    window._ultimaPercent = window._ultimaPercent || {};
    window._ultimaLitros = window._ultimaLitros || {};
    window._ultimaCapacidade = window._ultimaCapacidade || {};

    if (percent !== null) window._ultimaPercent[r.setor] = percent;
    if (liters !== null) window._ultimaLitros[r.setor] = liters;
    if (capacidade !== null) window._ultimaCapacidade[r.setor] = capacidade;

    if (nivelEl) nivelEl.style.height = percent !== null ? `${percent}%` : "0%";
    if (pctEl) pctEl.textContent = percent !== null ? `${Math.round(percent)}%` : "--%";
    if (litrEl) litrEl.textContent = liters !== null ? `${formatNumber(liters)} L` : "-- L";
    if (capEl) capEl.textContent = `Capacidade: ${formatNumber(capacidade)} L`;

    const mantKey = `manut_${r.setor}`;
    let inManut = false;
    try { inManut = JSON.parse(localStorage.getItem(mantKey)) === true; } catch(e){}

    if (manutCheck) {
      manutCheck.checked = inManut;
      if (!manutCheck._hasListener) {
        manutCheck.addEventListener("change", () => {
          const novo = manutCheck.checked;
          localStorage.setItem(mantKey, JSON.stringify(novo));
          manutTag.style.display = novo ? "block" : "none";
          if (!novo && percent <= 30) {
            alertaEl.style.display = "block";
            card.classList.add("alerta");
          } else {
            alertaEl.style.display = "none";
            card.classList.remove("alerta");
          }
        });
        manutCheck._hasListener = true;
      }
    }

    manutTag.style.display = inManut ? "block" : "none";

    if (!inManut && percent !== null && percent <= 30) {
      alertaEl.style.display = "block";
      card.classList.add("alerta");
    } else {
      alertaEl.style.display = "none";
      card.classList.remove("alerta");
    }
  });

  // ==========================
  // PRESSÕES (NÃO ALTERADO)
  // ==========================
  if (Array.isArray(data.pressoes)) {
    data.pressoes.forEach(p => {
      const id = `pres_${p.setor}`;
      const el = document.getElementById(`${id}_valor`);
      const card = document.getElementById(id);

      let bar = null;
      if (p.pressao != null) bar = Number(p.pressao);
      else if (p.value != null) {
        const v = Number(p.value);
        if (!isNaN(v) && v > 0 && v <= 0.1) {
          const mA = v * 1000;
          bar = ((mA - 4) / 16) * 10;
        }
      }

      if (el) el.textContent = bar == null ? "--" : bar.toFixed(2);

      if (card) {
        card.classList.remove("pressao-baixa", "pressao-ok", "pressao-alta", "sem-dado");
        if (bar == null) card.classList.add("sem-dado");
        else if (bar < 2) card.classList.add("pressao-baixa");
        else if (bar < 6) card.classList.add("pressao-ok");
        else card.classList.add("pressao-alta");
      }
    });
  }

  // ================================
  // BOMBAS — CORRIGIDO AQUI
  // ================================
  const b1 = Number(data.Bomba_01_binary ?? 0);
  const b2 = Number(data.Bomba_02_binary ?? 0);

  const c1 = Number(data.Ciclo_Bomba_01_counter ?? 0);
  const c2 = Number(data.Ciclos_Bomba_02_counter ?? 0);

  const now = Date.now();

  function processBomba(key, binary, ciclos) {
    const st = window._bombaState[key];
    const was = st.lastBinary;

    // ===============================
    // *** CORREÇÃO PRINCIPAL ***
    // ===============================
    const idx = key === "bomba01" ? "1" : "2";
    if (!document.getElementById(`status-bomba-${idx}`)) {
      return; // evita erro quando DOM ainda não existe (cache / atraso)
    }
    // ===============================

    if (was === 0 && binary === 1) {
      st.startTs = now;
      st.lastOnTs = now;
      st.lastCycle = ciclos;
    }

    if (was === 1 && binary === 0) {
      if (st.startTs) st.lastRunMs = now - st.startTs;
      st.startTs = null;
    }

    st.lastBinary = binary;

    const statusEl = document.getElementById(`status-bomba-${idx}`);
    const ciclosEl = document.getElementById(`ciclos-bomba-${idx}`);
    const tempoEl = document.getElementById(`tempo-bomba-${idx}`);
    const ultimoEl = document.getElementById(`ultimoon-bomba-${idx}`);
    const alertaEl = document.getElementById(`alerta-bomba-${idx}`);
    const card = document.getElementById(`card-bomba-${idx}`);

    if (statusEl) {
      statusEl.textContent = binary === 1 ? "Ligada" : "Desligada";
      statusEl.style.color = binary === 1 ? "green" : "#666";
    }

    if (ciclosEl) ciclosEl.textContent = ciclos;

    let tempoMs = null;
    if (binary === 1) tempoMs = now - (st.startTs || now);
    else if (st.lastRunMs) tempoMs = st.lastRunMs;

    if (tempoEl) tempoEl.textContent = tempoMs ? formatDuration(tempoMs) : "--:--";
    if (ultimoEl) ultimoEl.textContent = st.lastOnTs ? new Date(st.lastOnTs).toLocaleTimeString("pt-BR") : "--";

    let showAlert = false;
    let alertText = "";

    if (binary === 1 && (now - st.startTs) > BOMBA_ON_MS) {
      showAlert = true;
      alertText = `⚠ Ligada > ${BOMBA_ON_MS / 60000} min`;
    }

    if (showAlert) {
      alertaEl.style.display = "block";
      alertaEl.textContent = alertText;
      card.classList.add("alerta-bomba-card");
    } else {
      alertaEl.style.display = "none";
      card.classList.remove("alerta-bomba-card");
    }

    if (st.lastCycle != null && ciclos <= st.lastCycle && (now - st.lastOnTs) > BOMBA_ON_MS * 2) {
      alertaEl.style.display = "block";
      alertaEl.textContent = "⚠ Ciclos não aumentaram (verificar)";
      card.classList.add("alerta-bomba-card");
    }
  }

  processBomba("bomba01", b1, c1);
  processBomba("bomba02", b2, c2);

  // Globais
  if (b1 === 1 && b2 === 1) {
    ["1","2"].forEach(idx => {
      const alertaEl = document.getElementById(`alerta-bomba-${idx}`);
      const card = document.getElementById(`card-bomba-${idx}`);
      alertaEl.style.display = "block";
      alertaEl.textContent = "⚠ Ambas as bombas ligadas";
      card.classList.add("alerta-bomba-card");
    });
  }

  const anyRecentlyOn =
    (window._bombaState.bomba01.lastOnTs && now - window._bombaState.bomba01.lastOnTs < NENHUMA_LIGADA_ALERT_MS) ||
    (window._bombaState.bomba02.lastOnTs && now - window._bombaState.bomba02.lastOnTs < NENHUMA_LIGADA_ALERT_MS) ||
    b1 === 1 || b2 === 1;

  if (!anyRecentlyOn) {
    const alerta1 = document.getElementById("alerta-bomba-01");
    const alerta2 = document.getElementById("alerta-bomba-02");
    alerta1.textContent = `⚠ Nenhuma bomba acionou nos últimos 18 min`;
    alerta2.textContent = `⚠ Nenhuma bomba acionou nos últimos 18 min`;
    alerta1.style.display = "block";
    alerta2.style.display = "block";
  }
}

// verifica se a última atualização está vencida (> WARNING_TIMEOUT)
function verificarAtraso(lastUpdate) {
  if (!lastUpdate) return;
  const diff = Date.now() - new Date(lastUpdate).getTime();
  avisoEl.style.display = diff > WARNING_TIMEOUT ? "block" : "none";
}

// ciclo principal
async function atualizar() {
  try {
    const resp = await fetch(API_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();

    if (!window._estruturaCriada) {
      criarEstruturaInicial(data.reservatorios || [], data.pressoes || []);
      window._estruturaCriada = true;
    }

    atualizarValores(data);

    if (data.lastUpdate) {
      lastUpdateEl.textContent = "Última atualização: " + new Date(data.lastUpdate).toLocaleString("pt-BR");
      verificarAtraso(data.lastUpdate);
    } else {
      lastUpdateEl.textContent = "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
    }

    window._ultimaDashboard = data;

  } catch (err) {
    console.warn("Sem dados novos, usando última leitura", err);
    if (window._ultimaDashboard) {
      atualizarValores(window._ultimaDashboard);
      if (window._ultimaDashboard.lastUpdate) {
        lastUpdateEl.textContent = "Última atualização (cache): " + new Date(window._ultimaDashboard.lastUpdate).toLocaleString("pt-BR");
        verificarAtraso(window._ultimaDashboard.lastUpdate);
      }
    }
  }
}

setInterval(atualizar, UPDATE_INTERVAL);
atualizar();
