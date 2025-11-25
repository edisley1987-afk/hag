// public/dashboard.js
// Dashboard frontend — compatível com /api/dashboard

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; // ms
const WARNING_TIMEOUT = 10 * 60 * 1000; // 10 minutos

const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
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

// Render inicial: cria cards vazios a partir do que o servidor devolver
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

// Atualiza só valores (não recria DOM)
function atualizarValores(data) {
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

    const percent = (r.percent == null) ? (window._ultimaPercent?.[r.setor] ?? null) : r.percent;
    const liters = (r.current_liters == null) ? (window._ultimaLitros?.[r.setor] ?? null) : r.current_liters;
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

          if (novo) {
            manutTag.classList.add("blink");

            alertaEl && (alertaEl.style.display = "none");
            card && card.classList.remove("alerta");
          } else {
            manutTag.classList.remove("blink");

            if (percent !== null && percent <= 30) {
              alertaEl && (alertaEl.style.display = "block");
              card && card.classList.add("alerta");
            }
          }
        });
        manutCheck._hasListener = true;
      }
    }

    // Estado visual da manutenção
    if (manutTag) {
      const ativo = manutCheck && manutCheck.checked;
      manutTag.style.display = ativo ? "block" : "none";

      if (ativo) manutTag.classList.add("blink");
      else manutTag.classList.remove("blink");
    }

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

// atraso de dados
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
