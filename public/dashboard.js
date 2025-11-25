// public/dashboard.js
// Dashboard frontend — compatível com /api/dashboard
// Versão com suporte completo a bombas de circulação (alternadas, 15 min)

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
    lastCycle: null
  },
  bomba02: {
    lastBinary: 0,
    startTs: null,
    lastOnTs: null,
    lastCycle: null
  }
};

// Render inicial: cria cards vazios a partir do que o servidor devolver
function criarEstruturaInicial(reservatorios, pressoes) {
  // limpa
  reservatoriosContainer.innerHTML = "";
  pressoesContainer.innerHTML = "";
  bombasContainer && (bombasContainer.innerHTML = "");

  // reservatórios
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
    `;

    // histórico
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

    pressoesContainer.appendChild(card);
  });

  // bombas (dois cards ao lado das pressões)
  if (bombasContainer) {
    const bomba01 = document.createElement("div");
    bomba01.className = "card card-bomba";
    bomba01.id = "card-bomba-01";
    bomba01.innerHTML = `
      <h3>Bomba 01 (Circulação)</h3>
      <div><strong>Status:</strong> <span id="status-bomba-01">--</span></div>
      <div><strong>Ciclos:</strong> <span id="ciclos-bomba-01">--</span></div>
      <div><strong>Tempo ligada:</strong> <span id="tempo-bomba-01">--:--</span></div>
      <div><strong>Último ON:</strong> <span id="ultimoon-bomba-01">--</span></div>
      <div id="alerta-bomba-01" class="alerta" style="display:none;color:#b71c1c;font-weight:bold;">⚠ Alerta bomba 01</div>
    `;
    bombasContainer.appendChild(bomba01);

    const bomba02 = document.createElement("div");
    bomba02.className = "card card-bomba";
    bomba02.id = "card-bomba-02";
    bomba02.innerHTML = `
      <h3>Bomba 02 (Circulação)</h3>
      <div><strong>Status:</strong> <span id="status-bomba-02">--</span></div>
      <div><strong>Ciclos:</strong> <span id="ciclos-bomba-02">--</span></div>
      <div><strong>Tempo ligada:</strong> <span id="tempo-bomba-02">--:--</span></div>
      <div><strong>Último ON:</strong> <span id="ultimoon-bomba-02">--</span></div>
      <div id="alerta-bomba-02" class="alerta" style="display:none;color:#b71c1c;font-weight:bold;">⚠ Alerta bomba 02</div>
    `;
    bombasContainer.appendChild(bomba02);
  }
}

// Atualiza só valores (não recria DOM) — usa o último cache para manter valores
function atualizarValores(data) {
  // garantias de estrutura
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

    // fallback para evitar null/undefined
    const percent = (r.percent === undefined || r.percent === null) ? (window._ultimaPercent?.[r.setor] ?? null) : r.percent;
    const liters = (r.current_liters === undefined || r.current_liters === null) ? (window._ultimaLitros?.[r.setor] ?? null) : r.current_liters;
    const capacidade = r.capacidade ?? (window._ultimaCapacidade?.[r.setor] ?? null);

    // salvar último válido
    window._ultimaPercent = window._ultimaPercent || {};
    window._ultimaLitros = window._ultimaLitros || {};
    window._ultimaCapacidade = window._ultimaCapacidade || {};

    if (percent !== null) window._ultimaPercent[r.setor] = percent;
    if (liters !== null) window._ultimaLitros[r.setor] = liters;
    if (capacidade !== null) window._ultimaCapacidade[r.setor] = capacidade;

    // Atualiza UI (safe)
    if (nivelEl) nivelEl.style.height = (percent !== null ? `${percent}%` : `0%`);
    if (pctEl) pctEl.textContent = (percent !== null ? `${Math.round(percent)}%` : "--%");
    if (litrEl) litrEl.textContent = (liters !== null ? `${formatNumber(liters)} L` : "-- L");
    if (capEl) capEl.textContent = `Capacidade: ${formatNumber(capacidade)} L`;

    // tratamento manutenção (estado persistido no localStorage)
    const mantKey = `manut_${r.setor}`;
    let isManut = false;
    try { isManut = JSON.parse(localStorage.getItem(mantKey)) === true; } catch(e){ isManut = false; }

    if (manutCheck) {
      manutCheck.checked = isManut;
      // garantir escuta do evento (evita múltiplos listeners)
      if (!manutCheck._hasListener) {
        manutCheck.addEventListener("change", () => {
          const novo = manutCheck.checked;
          localStorage.setItem(mantKey, JSON.stringify(novo));
          // atualizar imediatamente a visibilidade da tag/alerta
          manutTag.style.display = novo ? "block" : "none";
          if (novo) {
            alertaEl && (alertaEl.style.display = "none");
            card && card.classList.remove("alerta");
          } else {
            // se saiu da manutenção, recalcula alerta conforme percent
            if (percent !== null && percent <= 30) {
              alertaEl && (alertaEl.style.display = "block");
              card && card.classList.add("alerta");
            }
          }
        });
        manutCheck._hasListener = true;
      }
    }

    // exibir/manter tag manutenção
    if (manutTag) manutTag.style.display = manutCheck && manutCheck.checked ? "block" : "none";

    // ALERTA: só se não estiver em manutenção
    const inManut = manutCheck && manutCheck.checked;
    if (alertaEl) {
      if (!inManut && percent !== null && percent <= 30) {
        alertaEl.style.display = "block";
        card && card.classList.add("alerta");
      } else {
        alertaEl.style.display = "none";
        card && card.classList.remove("alerta");
      }
    }
  });

  // pressões
  if (Array.isArray(data.pressoes)) {
    data.pressoes.forEach(p => {
      const id = `pres_${p.setor}`;
      const el = document.getElementById(`${id}_valor`);
      const card = document.getElementById(id);

      // Se o servidor já envia bar, usamos direto. Se enviar corrente mA (0.005) a conversão
      let bar = null;
      if (p.pressao !== undefined && p.pressao !== null) {
        bar = Number(p.pressao);
      } else if (p.value !== undefined && p.value !== null) {
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
    });
  }

  // ------------------------
  // BOMBAS: lógica de tempo e alertas (alternadas)
  // ------------------------

  // Ler campos do payload (suporta variações de nomes)
  const b1 = Number(data.Bomba_01_binary ?? data.Bomba_01 ?? 0);
  const b2 = Number(data.Bomba_02_binary ?? data.Bomba_02 ?? 0);

  // ciclos: suporta "Ciclo_Bomba_01_counter" ou "Ciclo_Bomba_01" etc.
  const c1 = Number(data.Ciclo_Bomba_01_counter ?? data.Ciclo_Bomba_01_counter ?? data.Ciclo_Bomba_01 ?? data.Ciclo_Bomba_01_counter ?? data.Ciclo_Bomba_01 ?? 0);
  const c2 = Number(data.Ciclos_Bomba_02_counter ?? data.Ciclo_Bomba_02_counter ?? data.Ciclo_Bomba_02 ?? data.Ciclos_Bomba_02 ?? 0);

  // Níveis para decidir se deveria ter acionamento (opcional, mas usamos para inferência)
  const nivelAbrandada = Number(data.Reservatorio_Agua_Abrandada_current ?? data.abrandada ?? NaN);
  const nivelLavanderia = Number(data.Reservatorio_lavanderia_current ?? data.lavanderia ?? NaN);

  const now = Date.now();

  // helper para atualizar estado de uma bomba
  function processBomba(key, binary, ciclos, nivelRef) {
    const st = window._bombaState[key];
    const was = st.lastBinary;

    // transição 0 -> 1 (ligou agora)
    if (was === 0 && binary === 1) {
      st.startTs = now;
      st.lastOnTs = now;
      // store lastCycle observed to detect increment
      st.lastCycle = ciclos;
    }

    // transição 1 -> 0 (desligou agora)
    if (was === 1 && binary === 0) {
      // compute last run duration if startTs present
      if (st.startTs) {
        const dur = now - st.startTs;
        st.lastRunMs = dur;
      }
      st.startTs = null;
      st.lastBinary = 0;
    }

    // atualização contínua (se está ligada)
    if (binary === 1) {
      st.lastBinary = 1;
      // if startTs missing (server restarted mid-run), set startTs as lastOnTs or now
      if (!st.startTs) st.startTs = st.lastOnTs || now;
    } else {
      st.lastBinary = 0;
    }

    // Update UI
    const idx = key === "bomba01" ? "1" : "2";
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
    if (ciclosEl) ciclosEl.textContent = ciclos ?? "--";

    // tempo ligado (se está ligada)
    let tempoMs = null;
    if (st.startTs && st.lastBinary === 1) {
      tempoMs = now - st.startTs;
    } else if (st.lastRunMs) {
      tempoMs = st.lastRunMs;
    }

    if (tempoEl) tempoEl.textContent = tempoMs ? formatDuration(tempoMs) : "--:--";
    if (ultimoEl) ultimoEl.textContent = st.lastOnTs ? new Date(st.lastOnTs).toLocaleTimeString("pt-BR") : "--";

    // ALERTAS:
    // 1) Tempo ligado maior que BOMBA_ON_MS -> alerta (ficou presa ligada)
    // 2) Ciclo não incrementou (observação): se st.lastCycle defined and cycles did not increase after expected cycle -> alert (we'll check elsewhere)
    let showAlert = false;
    let alertText = "";

    if (st.lastBinary === 1) {
      // tempo ligado excessivo
      if ((now - st.startTs) > BOMBA_ON_MS) {
        showAlert = true;
        alertText = `⚠ Ligada > ${BOMBA_ON_MS/60000} min`;
      }
    }

    // if level low and pump off -> maybe should have run: we decide that circulating pumps should alternate,
    // but if neither turned on in expected window higher layer handles that check.
    // we'll show additional alert if the other pump was on and this one did not start in expected time -> handled separately.

    if (showAlert) {
      alertaEl.style.display = "block";
      alertaEl.textContent = alertText;
      card && card.classList.add("alerta-bomba-card");
    } else {
      alertaEl.style.display = "none";
      card && card.classList.remove("alerta-bomba-card");
    }

    // check cycle increment: if previously recorded a lastCycle and it hasn't incremented after a full expected cycle window,
    // we mark a warning (this is heuristic).
    if (typeof st.lastCycle === "number" && typeof ciclos === "number") {
      // if pump is off and cycles haven't increased since lastOnTs + expected period*2 -> possible failure
      if (st.lastOnTs && (now - st.lastOnTs) > (BOMBA_ON_MS * 2) && ciclos <= st.lastCycle) {
        // show a mild warning on UI (reuse same alertaEl)
        alertaEl.style.display = "block";
        alertaEl.textContent = "⚠ Ciclos não aumentaram (verificar)";
        card && card.classList.add("alerta-bomba-card");
      }
    }
  }

  // processa ambas bombas
  processBomba("bomba01", b1, c1, nivelAbrandada);
  processBomba("bomba02", b2, c2, nivelLavanderia);

  // Regras globais / alternância:
  // - nunca as duas ligadas; se acontecer, alerta crítico
  if (b1 === 1 && b2 === 1) {
    // alerta visual em ambos
    ["1","2"].forEach(idx => {
      const alertaEl = document.getElementById(`alerta-bomba-${idx}`);
      const card = document.getElementById(`card-bomba-${idx}`);
      if (alertaEl) {
        alertaEl.style.display = "block";
        alertaEl.textContent = "⚠ Erro: ambas as bombas ligadas (não permitido)";
      }
      card && card.classList.add("alerta-bomba-card");
    });
  }

  // - verifica se nenhuma ligou dentro do intervalo esperado
  const anyRecentlyOn = (window._bombaState.bomba01.lastOnTs && (now - window._bombaState.bomba01.lastOnTs) < NENHUMA_LIGADA_ALERT_MS)
    || (window._bombaState.bomba02.lastOnTs && (now - window._bombaState.bomba02.lastOnTs) < NENHUMA_LIGADA_ALERT_MS)
    || (window._bombaState.bomba01.lastBinary === 1 || window._bombaState.bomba02.lastBinary === 1);

  if (!anyRecentlyOn) {
    // mostrar alerta global no topo das bombas (ou em cards)
    const alerta1 = document.getElementById("alerta-bomba-01");
    const alerta2 = document.getElementById("alerta-bomba-02");
    alerta1 && (alerta1.style.display = "block") && (alerta1.textContent = `⚠ Nenhuma bomba acionou nos últimos ${Math.round(NENHUMA_LIGADA_ALERT_MS/60000)} min`);
    alerta2 && (alerta2.style.display = "block") && (alerta2.textContent = `⚠ Nenhuma bomba acionou nos últimos ${Math.round(NENHUMA_LIGADA_ALERT_MS/60000)} min`);
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

    // se estrutura não criada, cria com base nos itens retornados
    if (!window._estruturaCriada) {
      criarEstruturaInicial(data.reservatorios || [], data.pressoes || []);
      window._estruturaCriada = true;
    }

    // atualiza valores (mantendo fallback)
    atualizarValores(data);

    // relógio/aviso
    if (data.lastUpdate) {
      lastUpdateEl.textContent = "Última atualização: " + new Date(data.lastUpdate).toLocaleString("pt-BR");
      verificarAtraso(data.lastUpdate);
    } else {
      lastUpdateEl.textContent = "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
    }

    // guarda cópia para fallback
    window._ultimaDashboard = data;

  } catch (err) {
    console.warn("Sem dados novos, usando última leitura", err);
    if (window._ultimaDashboard) {
      // atualiza com o cache
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
