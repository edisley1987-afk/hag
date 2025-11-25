// public/dashboard.js
// Dashboard frontend — compatível com /api/dashboard

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; // ms
const WARNING_TIMEOUT = 10 * 60 * 1000; // 10 minutos (para overlay por card)

const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
const lastUpdateEl = document.getElementById("lastUpdate");

// Banner global (mantém igual)
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

// Render inicial: cria os cards
function criarEstruturaInicial(reservatorios, pressoes) {
  reservatoriosContainer.innerHTML = "";
  pressoesContainer.innerHTML = "";

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

      <!-- Overlay de atraso (Opção C) -->
      <div class="atraso-overlay" id="${id}_atr_overlay">
        <span>⚠ Sem atualização recente</span>
      </div>

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
}

// Atualiza valores nos cards
function atualizarValores(data) {
  if (!data || !Array.isArray(data.reservatorios)) return;

  const momentoAgora = Date.now();

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
    const atrasoOverlay = document.getElementById(`${id}_atr_overlay`);

    const percent = r.percent ?? (window._ultimaPercent?.[r.setor] ?? null);
    const liters = r.current_liters ?? (window._ultimaLitros?.[r.setor] ?? null);
    const capacidade = r.capacidade ?? (window._ultimaCapacidade?.[r.setor] ?? null);

    // salva valores em cache
    window._ultimaPercent = window._ultimaPercent || {};
    window._ultimaLitros = window._ultimaLitros || {};
    window._ultimaCapacidade = window._ultimaCapacidade || {};

    if (percent !== null) window._ultimaPercent[r.setor] = percent;
    if (liters !== null) window._ultimaLitros[r.setor] = liters;
    if (capacidade !== null) window._ultimaCapacidade[r.setor] = capacidade;

    // nivel visual
    if (nivelEl) nivelEl.style.height = percent !== null ? `${percent}%` : "0%";
    if (pctEl) pctEl.textContent = percent !== null ? `${Math.round(percent)}%` : "--%";
    if (litrEl) litrEl.textContent = liters !== null ? `${formatNumber(liters)} L` : "-- L";
    if (capEl) capEl.textContent = `Capacidade: ${formatNumber(capacidade)} L`;

    /* ================================================================
       🔥 OPÇÃO C – DETECÇÃO DE ATRASO INDIVIDUAL (overlay piscando)
       ================================================================ */

    const ultimo = r.lastUpdate ? new Date(r.lastUpdate).getTime() : null;

    if (ultimo && momentoAgora - ultimo > WARNING_TIMEOUT) {
      atrasoOverlay.classList.add("visivel");
    } else {
      atrasoOverlay.classList.remove("visivel");
    }

    /* ================================================================ */

    // manutenção
    const mantKey = `manut_${r.setor}`;
    let isManut = false;
    try { isManut = JSON.parse(localStorage.getItem(mantKey)) === true; } catch(e){}

    if (manutCheck) {
      manutCheck.checked = isManut;

      if (!manutCheck._hasListener) {
        manutCheck.addEventListener("change", () => {
          const novo = manutCheck.checked;
          localStorage.setItem(mantKey, JSON.stringify(novo));

          manutTag.style.display = novo ? "block" : "none";

          if (novo) manutTag.classList.add("blink");
          else manutTag.classList.remove("blink");
        });
        manutCheck._hasListener = true;
      }
    }

    // estado visual da manutenção
    manutTag.style.display = isManut ? "block" : "none";
    if (isManut) manutTag.classList.add("blink");
    else manutTag.classList.remove("blink");

    // alerta de nível
    if (alertaEl) {
      if (!isManut && percent !== null && percent <= 30) {
        alertaEl.style.display = "block";
        card.classList.add("alerta");
      } else {
        alertaEl.style.display = "none";
        card.classList.remove("alerta");
      }
    }
  });

  // pressões (mantém igual)
  if (Array.isArray(data.pressoes)) {
    data.pressoes.forEach(p => {
      const id = `pres_${p.setor}`;
      const el = document.getElementById(`${id}_valor`);
      const card = document.getElementById(id);

      let bar = p.pressao ?? null;

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
}

// aviso global
function verificarAtraso(lastUpdate) {
  if (!lastUpdate) return;
  const diff = Date.now() - new Date(lastUpdate).getTime();
  avisoEl.style.display = diff > WARNING_TIMEOUT ? "block" : "none";
}

// ciclo
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
      lastUpdateEl.textContent =
        "Última atualização: " + new Date(data.lastUpdate).toLocaleString("pt-BR");
      verificarAtraso(data.lastUpdate);
    }

    window._ultimaDashboard = data;

  } catch (err) {
    console.warn("Sem dados novos, usando cache", err);
  }
}

setInterval(atualizar, UPDATE_INTERVAL);
atualizar();
