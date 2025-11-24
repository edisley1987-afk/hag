// public/dashboard.js
// Dashboard frontend — compatível com seu server.js (/api/dashboard)

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; // ms

const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
const lastUpdateEl = document.getElementById("lastUpdate");

// função utilitária
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Converte valores que podem chegar de formas diferentes em 'bar'.
// - Se API enviar corrente em A (ex.: 0.005) -> converte 4-20 mA = 0-10 bar
// - Se API enviar valor já convertido na escala 0-20 -> divide por 2 -> 0-10 bar
function convertToBar(rawValue) {
  if (rawValue == null || isNaN(rawValue)) return null;

  const v = Number(rawValue);

  // Caso venha em Ampères (ex.: 0.005 => 5 mA)
  if (v > 0 && v <= 0.1) {
    const mA = v * 1000;
    const bar = ((mA - 4) / 16) * 10; // 4-20mA => 0-10bar
    return Number(clamp(bar, 0, 10).toFixed(2));
  }

  // Caso venha em escala 0-20 (conversão do servidor que resultaria 0..20)
  if (v >= 0 && v <= 25) {
    // interpretamos como 0..20 -> 0..10bar
    const bar = v / 2;
    return Number(clamp(bar, 0, 10).toFixed(2));
  }

  // fallback: se for um valor estranho, não converte
  return null;
}

// --- Cria/atualiza DOM dinamicamente ---
function criarCardsBase(reservatorios, pressoes) {
  // Reservatórios
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
          <div class="liters-text" id="${id}_litros">${r.current_liters} L</div>
        </div>
      </div>

      <div class="card-actions">
        <div class="capacidade">Capacidade: ${formatNumberWithSep(r.capacidade ?? "—")} L</div>
        <button class="btn-hist" data-setor="${r.setor}">Ver histórico</button>
      </div>
    `;

    // evento do botão histórico
    card.querySelector(".btn-hist").addEventListener("click", (e) => {
      const setor = e.currentTarget.dataset.setor;
      // navega para a view de histórico - seu server tem /historico-view
      // passamos o setor como query string (você pode adaptar)
      window.location.href = `/historico-view?reservatorio=${encodeURIComponent(setor)}`;
    });

    reservatoriosContainer.appendChild(card);
  });

  // Pressões (cards menores, metade da altura)
  pressoesContainer.innerHTML = "";
  pressoes.forEach((p) => {
    const id = `pres_${p.setor}`;
    const card = document.createElement("div");
    card.className = "card-pressao";
    card.id = id;

    // tenta converter o valor para bar (api pode entregar null)
    const bar = convertToBar(p.pressao);

    card.innerHTML = `
      <h3 class="titulo-card">${p.nome}</h3>
      <div class="pressao-valor" id="${id}_valor">${bar == null ? "--" : bar.toFixed(2)}</div>
      <div class="pressao-unidade">bar</div>
    `;

    // cor indicativa
    const valorEl = card.querySelector(`#${id}_valor`);
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

// Formata número com separador de milhares
function formatNumberWithSep(n) {
  if (n == null) return "--";
  return Number(n).toLocaleString('pt-BR');
}

// --- Pede dados da API e atualiza UI ---
async function atualizar() {
  try {
    const resp = await fetch(API_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    // Data pode ser o formato que seu server já fornece (/api/dashboard)
    // Esperamos: { lastUpdate, reservatorios: [{nome,setor,percent,current_liters,manutencao,capacidade}], pressoes: [{nome,setor,pressao}] }
    const reserv = (data.reservatorios && Array.isArray(data.reservatorios)) ? data.reservatorios : [];
    const press = (data.pressoes && Array.isArray(data.pressoes)) ? data.pressoes : [];

    // Garante campos de capacidade (se não vier, preencher com fallback)
    reserv.forEach(r => { if (!r.capacidade && r.setor) {
      // tentamos mapear capacidades conhecidas
      const caps = {
        elevador: 20000,
        osmose: 200,
        cme: 1000,
        abrandada: 9000
      };
      r.capacidade = r.capacidade || caps[r.setor] || null;
    }});

    criarCardsBase(reserv, press);

    // Atualiza o relógio com o lastUpdate do servidor (se existir)
    if (data.lastUpdate) {
      const dt = new Date(data.lastUpdate);
      lastUpdateEl.textContent = "Última atualização: " + dt.toLocaleString("pt-BR");
    } else {
      lastUpdateEl.textContent = "Última atualização: " + new Date().toLocaleTimeString("pt-BR");
    }

    // guarda fallback
    window._ultimaDashboard = data;
  } catch (err) {
    console.error("Erro ao atualizar dashboard:", err);

    // fallback: se tivermos dados anteriores, re-renderiza
    if (window._ultimaDashboard) {
      criarCardsBase(window._ultimaDashboard.reservatorios || [], window._ultimaDashboard.pressoes || []);
      lastUpdateEl.textContent = "Última atualização: (cache) " + new Date().toLocaleTimeString("pt-BR");
    }
  }
}

// Atualiza a cada X segundos
setInterval(atualizar, UPDATE_INTERVAL);
atualizar();
