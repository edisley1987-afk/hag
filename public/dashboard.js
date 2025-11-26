// public/dashboard.js
// Dashboard frontend — compatível com /api/dashboard
// Versão corrigida: mantém última leitura quando gateway some, alerta por atraso

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; // ms
const WARNING_TIMEOUT = 10 * 60 * 1000; // 10 minutos

const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
const bombasContainer = document.getElementById("bombasContainer");
const lastUpdateEl = document.getElementById("lastUpdate");

// Banner de aviso (global)
let avisoEl = document.getElementById("aviso-atraso");
if (!avisoEl) {
  avisoEl = document.createElement("div");
  avisoEl.id = "aviso-atraso";
  avisoEl.textContent = "⚠ Sem atualização há mais de 10 minutos";
  avisoEl.style.display = "none";
  document.body.prepend(avisoEl);
}

// utilitários
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

// Estado local para bombas
window._bombaState = window._bombaState || {
  bomba01: { lastBinary: 0, startTs: null, lastOnTs: null, lastCycle: null, lastRunMs: null },
  bomba02: { lastBinary: 0, startTs: null, lastOnTs: null, lastCycle: null, lastRunMs: null }
};

// criar estrutura inicial (reservatórios, pressões, bombas)
function criarEstruturaInicial(reservatorios, pressoes) {
  // limpa
  reservatoriosContainer.innerHTML = "";
  pressoesContainer.innerHTML = "";
  bombasContainer && (bombasContainer.innerHTML = "");

  // reservatórios (mantive a estrutura visual como você tinha)
  (reservatorios || []).forEach(r => {
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

      <!-- overlay visual para indicar atraso (controlado por JS) -->
      <div class="atraso-overlay" id="${id}_atraso" aria-hidden="true">Sem atualização há mais de 10 minutos</div>
    `;

    card.querySelector(".btn-hist").addEventListener("click", (e) => {
      const setor = e.currentTarget.dataset.setor;
      window.location.href = `/historico-view?reservatorio=${encodeURIComponent(setor)}`;
    });

    reservatoriosContainer.appendChild(card);
  });

  // pressões
  (pressoes || []).forEach(p => {
    const id = `pres_${p.setor}`;
    const card = document.createElement("div");
    card.className = "card-pressao";
    card.id = id;

    card.innerHTML = `
      <h3 class="titulo-card">${p.nome}</h3>
      <div class="pressao-valor" id="${id}_valor">--</div>
      <div class="pressao-unidade">bar</div>
    `;

    // overlay de atraso em pressões também (mesma lógica)
    const overlay = document.createElement("div");
    overlay.className = "atraso-overlay";
    overlay.id = `${id}_atraso`;
    overlay.textContent = "Sem atualização há mais de 10 minutos";
    overlay.style.pointerEvents = "none";
    card.appendChild(overlay);

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

// atualiza valores (usa cache para manter última leitura quando gateway some)
function atualizarValores(payload) {
  // payload deve ser o objeto retornado por /api/dashboard
  if (!payload) return;

  // determinar se estamos usando cache
  const fromCache = !!payload._fromCache;

  // última atualização (timestamp ISO) -- pode vir no payload.lastUpdate
  const lastUpdate = payload.lastUpdate || payload.last_update || payload.timestamp || null;
  const lastUpdateMs = lastUpdate ? new Date(lastUpdate).getTime() : null;

  // -----------------------
  // RESERVATÓRIOS
  // -----------------------
  if (Array.isArray(payload.reservatorios)) {
    payload.reservatorios.forEach(r => {
      const id = `res_${r.setor}`;
      const nivelEl = document.getElementById(`${id}_nivel`);
      const pctEl = document.getElementById(`${id}_percent`);
      const litrEl = document.getElementById(`${id}_litros`);
      const capEl = document.getElementById(`${id}_cap`);
      const alertaEl = document.getElementById(`${id}_alerta`);
      const manutCheck = document.getElementById(`${id}_manut`);
      const manutTag = document.getElementById(`${id}_tag`);
      const atrasoOverlay = document.getElementById(`${id}_atraso`);
      const card = document.getElementById(id);

      const percent = (r.percent === undefined || r.percent === null) ? (window._ultimaPercent?.[r.setor] ?? null) : r.percent;
      const liters = (r.current_liters === undefined || r.current_liters === null) ? (window._ultimaLitros?.[r.setor] ?? null) : r.current_liters;
      const capacidade = r.capacidade ?? (window._ultimaCapacidade?.[r.setor] ?? null);

      window._ultimaPercent = window._ultimaPercent || {};
      window._ultimaLitros = window._ultimaLitros || {};
      window._ultimaCapacidade = window._ultimaCapacidade || {};

      if (percent !== null) window._ultimaPercent[r.setor] = percent;
      if (liters !== null) window._ultimaLitros[r.setor] = liters;
      if (capacidade !== null) window._ultimaCapacidade[r.setor] = capacidade;

      if (nivelEl) nivelEl.style.height = (percent !== null ? `${percent}%` : `0%`);
      if (pctEl) pctEl.textContent = (percent !== null ? `${Math.round(percent)}%` : "--%");
      if (litrEl) litrEl.textContent = (liters !== null ? `${formatNumber(liters)} L` : "-- L");
      if (capEl) capEl.textContent = `Capacidade: ${formatNumber(capacidade)} L`;

      // manutenção
      const mantKey = `manut_${r.setor}`;
      let isManut = false;
      try { isManut = JSON.parse(localStorage.getItem(mantKey)) === true; } catch(e) { isManut = false; }

      if (manutCheck) {
        manutCheck.checked = isManut;
        if (!manutCheck._hasListener) {
          manutCheck.addEventListener("change", () => {
            const novo = manutCheck.checked;
            localStorage.setItem(mantKey, JSON.stringify(novo));
            manutTag && (manutTag.style.display = novo ? "block" : "none");
            if (!novo && percent <= 30) { alertaEl && (alertaEl.style.display = "block"); card && card.classList.add("alerta"); }
            else { alertaEl && (alertaEl.style.display = "none"); card && card.classList.remove("alerta"); }
          });
          manutCheck._hasListener = true;
        }
      }

      manutTag && (manutTag.style.display = isManut ? "block" : "none");

      if (!isManut && percent !== null && percent <= 30) {
        alertaEl && (alertaEl.style.display = "block");
        card && card.classList.add("alerta");
      } else {
        alertaEl && (alertaEl.style.display = "none");
        card && card.classList.remove("alerta");
      }

      // overlay de atraso: visível se lastUpdate estiver ultrapassado
      if (atrasoOverlay) {
        if (lastUpdateMs && (Date.now() - lastUpdateMs) > WARNING_TIMEOUT) {
          atrasoOverlay.classList.add("visivel");
        } else {
          atrasoOverlay.classList.remove("visivel");
        }
      }
    });
  }

  // -----------------------
  // PRESSÕES
  // -----------------------
  if (Array.isArray(payload.pressoes)) {
    payload.pressoes.forEach(p => {
      const id = `pres_${p.setor}`;
      const el = document.getElementById(`${id}_valor`);
      const atrasoOverlay = document.getElementById(`${id}_atraso`);
      const card = document.getElementById(id);

      let bar = null;
      if (p.pressao !== undefined && p.pressao !== null) bar = Number(p.pressao);
      else if (p.value !== undefined && p.value !== null) {
        const v = Number(p.value);
        if (!isNaN(v) && v > 0 && v <= 0.1) {
          const mA = v * 1000;
          bar = ((mA - 4) / 16) * 10;
        }
      }

      if (el) el.textContent = bar == null ? "--" : Number(bar).toFixed(2);
      if (card) {
        card.classList.remove("pressao-baixa", "pressao-ok", "pressao-alta", "sem-dado");
        if (bar == null) card.classList.add("sem-dado");
        else if (bar < 2) card.classList.add("pressao-baixa");
        else if (bar < 6) card.classList.add("pressao-ok");
        else card.classList.add("pressao-alta");
      }

      if (atrasoOverlay) {
        if (lastUpdateMs && (Date.now() - lastUpdateMs) > WARNING_TIMEOUT) atrasoOverlay.classList.add("visivel");
        else atrasoOverlay.classList.remove("visivel");
      }
    });
  }

  // -----------------------
  // BOMBAS (suporta payload.bombas ou campos avulsos)
  // -----------------------
  // extrair estados/ciclos de duas fontes possíveis
  let b1 = null, b2 = null, c1 = null, c2 = null;

  if (Array.isArray(payload.bombas) && payload.bombas.length >= 2) {
    try {
      b1 = Number(payload.bombas[0].estado_num ?? payload.bombas[0].estado_numero ?? payload.bombas[0].estado ?? 0);
      b2 = Number(payload.bombas[1].estado_num ?? payload.bombas[1].estado_numero ?? payload.bombas[1].estado ?? 0);
      c1 = Number(payload.bombas[0].ciclo ?? payload.bombas[0].ciclo_num ?? payload.bombas[0].ciclo_counter ?? payload.bombas[0].ciclos ?? 0);
      c2 = Number(payload.bombas[1].ciclo ?? payload.bombas[1].ciclo_num ?? payload.bombas[1].ciclo_counter ?? payload.bombas[1].ciclos ?? 0);
    } catch (e) { b1 = b1 || 0; b2 = b2 || 0; c1 = c1 || 0; c2 = c2 || 0; }
  } else {
    // fallback para campos "achatados" que venham do gateway
    b1 = Number(payload.Bomba_01_binary ?? payload.Bomba_01 ?? payload.Bomba01 ?? payload.bomba01 ?? 0);
    b2 = Number(payload.Bomba_02_binary ?? payload.Bomba_02 ?? payload.Bomba02 ?? payload.bomba02 ?? 0);
    c1 = Number(payload.Ciclos_Bomba_01_counter ?? payload.Ciclo_Bomba_01_counter ?? payload.Ciclos_Bomba_01 ?? 0);
    c2 = Number(payload.Ciclos_Bomba_02_counter ?? payload.Ciclo_Bomba_02_counter ?? payload.Ciclos_Bomba_02 ?? 0);
  }

  const now = Date.now();

  function processBomba(key, binary, ciclos) {
    const st = window._bombaState[key];
    const was = st.lastBinary;

    const idx = key === "bomba01" ? "1" : "2";
    // se DOM ainda não estiver pronto, sai (evita erro)
    if (!document.getElementById(`status-bomba-${idx}`)) return;

    // transição 0->1
    if (was === 0 && binary === 1) {
      st.startTs = now;
      st.lastOnTs = now;
      st.lastCycle = ciclos;
    }

    // transição 1->0
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

    if (statusEl) { statusEl.textContent = binary === 1 ? "Ligada" : "Desligada"; statusEl.style.color = binary === 1 ? "green" : "#666"; }
    if (ciclosEl) ciclosEl.textContent = isNaN(ciclos) ? "--" : ciclos;

    let tempoMs = null;
    if (binary === 1) tempoMs = now - (st.startTs || now);
    else if (st.lastRunMs) tempoMs = st.lastRunMs;

    if (tempoEl) tempoEl.textContent = tempoMs ? formatDuration(tempoMs) : "--:--";
    if (ultimoEl) ultimoEl.textContent = st.lastOnTs ? new Date(st.lastOnTs).toLocaleTimeString("pt-BR") : "--";

    // alertas locais
    let showAlert = false;
    let alertText = "";

    if (binary === 1 && st.startTs && (now - st.startTs) > BOMBA_ON_MS) {
      showAlert = true; alertText = `⚠ Ligada > ${BOMBA_ON_MS/60000} min`;
    }

    if (showAlert) {
      alertaEl && (alertaEl.style.display = "block") && (alertaEl.textContent = alertText);
      card && card.classList.add("alerta-bomba-card");
    } else {
      alertaEl && (alertaEl.style.display = "none");
      card && card.classList.remove("alerta-bomba-card");
    }

    // heurística ciclo
    if (typeof st.lastCycle === "number" && typeof ciclos === "number") {
      if (st.lastOnTs && (now - st.lastOnTs) > (BOMBA_ON_MS * 2) && ciclos <= st.lastCycle) {
        alertaEl && (alertaEl.style.display = "block");
        alertaEl && (alertaEl.textContent = "⚠ Ciclos não aumentaram (verificar)");
        card && card.classList.add("alerta-bomba-card");
      }
    }
  }

  processBomba("bomba01", b1 || 0, c1 || 0);
  processBomba("bomba02", b2 || 0, c2 || 0);

  // regras globais
  if (b1 === 1 && b2 === 1) {
    ["1","2"].forEach(idx => {
      const alertaEl = document.getElementById(`alerta-bomba-${idx}`);
      const card = document.getElementById(`card-bomba-${idx}`);
      alertaEl && (alertaEl.style.display = "block") && (alertaEl.textContent = "⚠ Ambas as bombas ligadas");
      card && card.classList.add("alerta-bomba-card");
    });
  }

  const anyRecentlyOn =
    (window._bombaState.bomba01.lastOnTs && now - window._bombaState.bomba01.lastOnTs < NENHUMA_LIGADA_ALERT_MS) ||
    (window._bombaState.bomba02.lastOnTs && now - window._bombaState.bomba02.lastOnTs < NENHUMA_LIGADA_ALERT_MS) ||
    b1 === 1 || b2 === 1;

  if (!anyRecentlyOn) {
    const alerta1 = document.getElementById("alerta-bomba-01");
    const alerta2 = document.getElementById("alerta-bomba-02");
    if (alerta1) { alerta1.textContent = `⚠ Nenhuma bomba acionou nos últimos ${Math.round(NENHUMA_LIGADA_ALERT_MS/60000)} min`; alerta1.style.display = "block"; }
    if (alerta2) { alerta2.textContent = `⚠ Nenhuma bomba acionou nos últimos ${Math.round(NENHUMA_LIGADA_ALERT_MS/60000)} min`; alerta2.style.display = "block"; }
  }

  // atualizar aviso global (visível se lastUpdate estourou)
  if (lastUpdateMs && (Date.now() - lastUpdateMs) > WARNING_TIMEOUT) {
    avisoEl.style.display = "block";
  } else {
    avisoEl.style.display = "none";
  }
}

// verifica atraso (helper externo para outras rotinas)
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

    // quando o servidor devolver objeto vazio (ou arrays vazias), usamos cache e marcamos _fromCache
    let usar = data;
    if ((!data || !Array.isArray(data.reservatorios) || data.reservatorios.length === 0) && window._ultimaDashboard) {
      usar = Object.assign({}, window._ultimaDashboard, { _fromCache: true });
      // mantém lastUpdate original para verificar atraso
    }

    // cria estrutura inicial se necessário
    if (!window._estruturaCriada) {
      criarEstruturaInicial(usar.reservatorios || [], usar.pressoes || []);
      window._estruturaCriada = true;
    }

    // atualiza valores
    atualizarValores(usar);

    // relógio/aviso
    if (data.lastUpdate) {
      lastUpdateEl.textContent = "Última atualização: " + new Date(data.lastUpdate).toLocaleString("pt-BR");
      verificarAtraso(data.lastUpdate);
    } else if (window._ultimaDashboard && window._ultimaDashboard.lastUpdate) {
      lastUpdateEl.textContent = "Última atualização (cache): " + new Date(window._ultimaDashboard.lastUpdate).toLocaleString("pt-BR");
      verificarAtraso(window._ultimaDashboard.lastUpdate);
    } else {
      lastUpdateEl.textContent = "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
    }

    // guarda cópia para fallback
    window._ultimaDashboard = data;

  } catch (err) {
    console.warn("Sem dados novos, usando última leitura (catch)", err);
    if (window._ultimaDashboard) {
      const cache = Object.assign({}, window._ultimaDashboard, { _fromCache: true });
      if (!window._estruturaCriada) {
        criarEstruturaInicial(cache.reservatorios || [], cache.pressoes || []);
        window._estruturaCriada = true;
      }
      atualizarValores(cache);
      if (window._ultimaDashboard.lastUpdate) {
        lastUpdateEl.textContent = "Última atualização (cache): " + new Date(window._ultimaDashboard.lastUpdate).toLocaleString("pt-BR");
        verificarAtraso(window._ultimaDashboard.lastUpdate);
      }
    } else {
      // nada a mostrar
      console.warn("Sem cache disponível para exibir dados");
    }
  }
}

setInterval(atualizar, UPDATE_INTERVAL);
atualizar();
