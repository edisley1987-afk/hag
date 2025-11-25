// public/dashboard.js
// Dashboard frontend — compatível com seu server.js (/api/dashboard)

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; // ms

const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
const lastUpdateEl = document.getElementById("lastUpdate");

// utilitário
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Formata número com separador de milhares
function formatNumberWithSep(n) {
  if (n == null) return "--";
  return Number(n).toLocaleString('pt-BR');
}

// --- Cria / atualiza DOM ---
function criarCardsBase(reservatorios, pressoes) {

  // ============================
  // RESERVATÓRIOS
  // ============================

  reservatoriosContainer.innerHTML = "";
  reservatorios.forEach(r => {
    const id = `res_${r.setor}`;
    const card = document.createElement("div");
    card.className = "card-reservatorio";
    card.id = id;

    card.innerHTML = `
      <h3 class="titulo-card">${r.nome}</h3>

      <div class="tanque-visu">
        <div class="nivel-agua" id="${id}_nivel" style="height: ${r.percent}%"></div>
        <div class="overlay-info">
          <div class="percent-text" id="${id}_percent">${r.percent}%</div>
          <div class="liters-text" id="${id}_litros">${formatNumberWithSep(r.current_liters)} L</div>
        </div>
      </div>

      <div class="card-actions">
        <div class="capacidade">Capacidade: ${formatNumberWithSep(r.capacidade ?? "—")} L</div>
        <button class="btn-hist" data-setor="${r.setor}">Ver histórico</button>
      </div>
    `;

    // botão histórico
    card.querySelector(".btn-hist").addEventListener("click", (e) => {
      const setor = e.currentTarget.dataset.setor;
      window.location.href = `/historico-view?reservatorio=${encodeURIComponent(setor)}`;
    });

    reservatoriosContainer.appendChild(card);
  });

  // ============================
  // PRESSÕES — 3 SENSORES
  // ============================
  pressoesContainer.innerHTML = "";
  pressoes.forEach((p) => {
    const id = `pres_${p.setor}`;
    const card = document.createElement("div");
    card.className = "card-pressao";
    card.id = id;

    // valor já vem em bar pelo servidor
    const bar = (p.pressao == null || isNaN(p.pressao)) ? null : Number(p.pressao);

    card.innerHTML = `
      <h3 class="titulo-card">${p.nome}</h3>
      <div class="pressao-valor" id="${id}_valor">${bar == null ? "--" : bar.toFixed(2)}</div>
      <div class="pressao-unidade">bar</div>
    `;

    // cores
    if (bar == null) {
      card.classList.add("sem-dado");
    } else if (bar < 2.0) {
      card.classList.add("pressao-baixa");
    } else if (bar < 6.0) {
      card.classList.add("pressao-ok");
    } else {
      card.classList.add("pressao-alta");
    }

    pressoesContainer.appendChild(card);
  });
}


// ===============================
// ATUALIZAR (CHAMA API)
// ===============================
async function atualizar() {
  try {
    const resp = await fetch(API_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    // garante arrays
    const reserv = Array.isArray(data.reservatorios) ? data.reservatorios : [];
    let press = Array.isArray(data.pressoes) ? data.pressoes : [];

    // corrige capacidades faltando
    reserv.forEach(r => {
      if (!r.capacidade && r.setor) {
        const caps = {
          elevador: 20000,
          osmose: 200,
          cme: 1000,
          abrandada: 9000
        };
        r.capacidade = caps[r.setor] ?? null;
      }
    });

    // ============================
    // MANTER APENAS 3 SENSORES
    // ============================

    const mapaSetores = {
      "Pressao_Saida_Osmose_current": "saida_osmose",
      "Pressao_Retorno_Osmose_current": "retorno_osmose",
      "Pressao_Saida_CME_current": "saida_cme"
    };

    press = press
      .filter(p => mapaSetores[p.setor])       // mantém só os 3
      .map(p => ({
        ...p,
        setor: mapaSetores[p.setor]           // renomeia setor
      }));

    criarCardsBase(reserv, press);

    // relógio
    if (data.lastUpdate) {
      const dt = new Date(data.lastUpdate);
      lastUpdateEl.textContent = "Última atualização: " + dt.toLocaleString("pt-BR");
    } else {
      lastUpdateEl.textContent = "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
    }

    window._ultimaDashboard = data;

  } catch (err) {
    console.error("Erro ao atualizar dashboard:", err);

    if (window._ultimaDashboard) {
      criarCardsBase(
        window._ultimaDashboard.reservatorios || [],
        window._ultimaDashboard.pressoes || []
      );
      lastUpdateEl.textContent =
        "Última atualização: (cache) " + new Date().toLocaleTimeString("pt-BR");
    }
  }
}

setInterval(atualizar, UPDATE_INTERVAL);
atualizar();
