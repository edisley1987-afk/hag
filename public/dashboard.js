// public/dashboard.js
// Dashboard frontend — compatível com seu server.js (/api/dashboard)

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; // ms
const WARNING_TIMEOUT = 10 * 60 * 1000; // 10 minutos

const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
const lastUpdateEl = document.getElementById("lastUpdate");

// Banner de aviso
let avisoEl = document.getElementById("aviso-atraso");
if (!avisoEl) {
  avisoEl = document.createElement("div");
  avisoEl.id = "aviso-atraso";
  avisoEl.style =
    "display:none; background:#b30000; color:white; padding:10px; text-align:center; font-weight:bold;";
  avisoEl.textContent = "⚠ Sem atualização há mais de 10 minutos";
  document.body.prepend(avisoEl);
}

// utilitário
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Converte 4–20 mA para BAR
function convertToBar(rawValue) {
  if (rawValue == null || isNaN(rawValue)) return null;

  const v = Number(rawValue);

  // caso venha em ampère (ex.: 0.005 → 5 mA)
  if (v > 0 && v <= 0.1) {
    const mA = v * 1000;
    const bar = ((mA - 4) / 16) * 10;
    return Number(clamp(bar, 0, 10).toFixed(2));
  }

  // caso venha em 0–20 já convertido
  if (v >= 0 && v <= 25) return Number((v / 2).toFixed(2));

  return null;
}

// Cria estrutura inicial uma única vez
function criarEstruturaInicial(reservatorios, pressoes) {
  reservatoriosContainer.innerHTML = "";
  pressoesContainer.innerHTML = "";

  reservatorios.forEach(r => {
    const id = `res_${r.setor}`;
    const card = document.createElement("div");
    card.className = "card-reservatorio";
    card.id = id;

    card.innerHTML = `
      <h3 class="titulo-card">${r.nome}</h3>

      <div class="tanque-visu">
        <div class="nivel-agua" id="${id}_nivel"></div>
        <div class="overlay-info">
          <div class="percent-text" id="${id}_percent"></div>
          <div class="liters-text" id="${id}_litros"></div>
        </div>
      </div>

      <!-- ALERTA -->
      <div class="alerta-msg" id="${id}_alerta" style="display:none;">
        ⚠ Nível crítico (abaixo de 30%)
      </div>

      <!-- MANUTENÇÃO -->
      <div class="manutencao-container">
        <label>
          <input type="checkbox" class="manutencao-check" id="${id}_manut">
          Em manutenção
        </label>
        <div class="manutencao-tag" id="${id}_tag" style="display:none;">
          EM MANUTENÇÃO
        </div>
      </div>

      <div class="card-actions">
        <div class="capacidade" id="${id}_cap"></div>
        <button class="btn-hist" data-setor="${r.setor}">Ver histórico</button>
      </div>
    `;

    // botão histórico
    card.querySelector(".btn-hist").addEventListener("click", (e) => {
      const setor = e.currentTarget.dataset.setor;
      window.location.href =
        `/historico-view?reservatorio=${encodeURIComponent(setor)}`;
    });

    reservatoriosContainer.appendChild(card);
  });

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
}

// Atualiza somente valores (mantém última leitura)
function atualizarValores(data) {
  data.reservatorios.forEach(r => {
    const id = `res_${r.setor}`;
    const nivel = document.getElementById(`${id}_nivel`);
    const pct = document.getElementById(`${id}_percent`);
    const lit = document.getElementById(`${id}_litros`);
    const cap = document.getElementById(`${id}_cap`);
    const alerta = document.getElementById(`${id}_alerta`);
    const manutCheck = document.getElementById(`${id}_manut`);
    const manutTag = document.getElementById(`${id}_tag`);
    const card = document.getElementById(id);

    nivel.style.height = `${r.percent}%`;
    pct.textContent = `${r.percent}%`;
    lit.textContent = `${r.current_liters} L`;
    cap.textContent = `Capacidade: ${r.capacidade.toLocaleString("pt-BR")} L`;

    // ALERTA DE 30%
    if (!manutCheck.checked && r.percent <= 30) {
      alerta.style.display = "block";
      card.classList.add("alerta");
    } else {
      alerta.style.display = "none";
      card.classList.remove("alerta");
    }

    // MANUTENÇÃO
    manutCheck.addEventListener("change", () => {
      if (manutCheck.checked) {
        manutTag.style.display = "block";
        alerta.style.display = "none";
        card.classList.remove("alerta");
      } else {
        manutTag.style.display = "none";
      }
    });

    // se a manutenção estiver ativa, sempre exibir a TAG
    if (manutCheck.checked) {
      manutTag.style.display = "block";
    }
  });

  data.pressoes.forEach(p => {
    const id = `pres_${p.setor}`;
    const bar = convertToBar(p.pressao);
    const el = document.getElementById(`${id}_valor`);
    const card = document.getElementById(id);

    el.textContent = bar == null ? "--" : bar.toFixed(2);

    card.classList.remove("pressao-baixa", "pressao-ok", "pressao-alta", "sem-dado");

    if (bar == null) card.classList.add("sem-dado");
    else if (bar < 2) card.classList.add("pressao-baixa");
    else if (bar < 6) card.classList.add("pressao-ok");
    else card.classList.add("pressao-alta");
  });
}

// Verifica atraso no recebimento de dados
function verificarAtraso(lastUpdate) {
  if (!lastUpdate) return;

  const diff = Date.now() - new Date(lastUpdate).getTime();

  avisoEl.style.display = diff > WARNING_TIMEOUT ? "block" : "none";
}

// Atualizador principal
async function atualizar() {
  try {
    const resp = await fetch(API_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (!window._estruturaCriada) {
      criarEstruturaInicial(data.reservatorios, data.pressoes);
      window._estruturaCriada = true;
    }

    atualizarValores(data);

    lastUpdateEl.textContent =
      "Última atualização: " +
      new Date(data.lastUpdate).toLocaleString("pt-BR");

    verificarAtraso(data.lastUpdate);

    window._ultimaDashboard = data;
  } catch (err) {
    console.warn("Sem dados novos, usando última leitura");

    if (window._ultimaDashboard) {
      atualizarValores(window._ultimaDashboard);
      verificarAtraso(window._ultimaDashboard.lastUpdate);

      lastUpdateEl.textContent =
        "Última atualização (cache): " +
        new Date(window._ultimaDashboard.lastUpdate).toLocaleString("pt-BR");
    }
  }
}

setInterval(atualizar, UPDATE_INTERVAL);
atualizar();
