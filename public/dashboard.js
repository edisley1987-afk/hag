/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão Sincronizada com Server.js
 */

const API = "/api/dashboard";

let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();

let historicoNivel = {};
let renderPending = false;

// =======================
// INIT
// =======================
init();

function init() {
  conectarWS();

  setInterval(fallbackHTTP, 8000);

  setInterval(() => {
    if (Date.now() - ultimoDado > 15000) {
      setStatus("🟡 Aguardando Gateway...");
    }
  }, 5000);

  // Limpeza de cache para cálculo de consumo
  setInterval(() => {
    historicoNivel = {};
  }, 10 * 60 * 1000);
}

// =======================
// WEBSOCKET
// =======================
function conectarWS() {
  if (ws) {
    ws.close();
    ws = null;
  }

  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocolo}//${location.host}`);

  ws.onopen = () => {
    console.log("WS conectado");
    setStatus("🟢 Tempo real conectado");
    reconnectDelay = 3000;
  };

  ws.onmessage = (msg) => {
    try {
      const payload = JSON.parse(msg.data);
      ultimoDado = Date.now();
      processarPayload(payload);
    } catch (e) {
      console.log("JSON inválido WS");
    }
  };

  ws.onclose = () => {
    console.log("WS desconectado");
    setStatus("🔴 Reconectando...");
    setTimeout(conectarWS, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
  };

  ws.onerror = () => ws.close();
}

// =======================
// FALLBACK HTTP
// =======================
async function fallbackHTTP() {
  if (ws && ws.readyState === 1) return;

  try {
    const res = await fetch(API + "?ts=" + Date.now());
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();
    processarPayload(data);
  } catch (e) {
    setStatus("🔴 Sem conexão com servidor");
  }
}

// =======================
// PROCESSADOR ÚNICO
// =======================
function processarPayload(payload) {
  if (!payload) return;

  // Se o dado vier do WebSocket (em formato 'dados') ou direto da API
  if (payload.type === "update" || payload.reservatorios) {
    const estrutura = montarEstrutura(payload.dados || payload);
    scheduleRender(estrutura);
  }
}

// =======================
// MONTA ESTRUTURA (CORRIGIDO)
// =======================
function montarEstrutura(dados) {
  if (!dados) return null;

  // Sincroniza os nomes e campos com o que o server.js envia no /api/dashboard
  return {
    reservatorios: dados.reservatorios || [],
    bombas: dados.bombas || [],
    pressoes: dados.pressoes || [],
    lastUpdate: dados.lastUpdate || new Date().toLocaleString()
  };
}

// =======================
// RENDER SCHEDULER
// =======================
function scheduleRender(data) {
  if (!data || renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    atualizarTela(data);
    renderPending = false;
  });
}

// =======================
// UPDATE UI
// =======================
function atualizarTela(data) {
  const elHora = document.getElementById("hora");
  if (elHora && data.lastUpdate) {
    elHora.innerText = data.lastUpdate;
  }

  renderReservatorios(data.reservatorios);
  renderBombas(data.bombas);
  renderPressoes(data.pressoes);

  atualizarBombasAtivas(data.bombas);
  atualizarKPIs(data.reservatorios, data.bombas);
}

function setStatus(txt) {
  const el = document.getElementById("statusSistema");
  if (el) el.innerText = txt;
}

function atualizarBombasAtivas(lista) {
  const el = document.getElementById("bombasAtivas");
  if (el) el.innerText = lista.filter(b => b.estado === "ligada").length;
}

function corNivel(percent) {
  if (percent >= 70) return ["#00ff88", "#00c853"];
  if (percent >= 40) return ["#ffd600", "#ff8f00"];
  return ["#ff1744", "#b71c1c"];
}

// =======================
// RENDERERS
// =======================
function renderReservatorios(lista) {
  const area = document.getElementById("areaReservatorios");
  if (!area) return;
  area.innerHTML = "";

  lista.forEach(r => {
    const percent = Math.max(0, Math.min(100, r.percent || 0));
    const [cor1, cor2] = corNivel(percent);

    const el = document.createElement("div");
    el.className = "card reservatorio";
    el.innerHTML = `
      <h2>${r.nome}</h2>
      <div class="tanque">
        <div class="escala">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="agua" style="height:${percent}%; background:linear-gradient(180deg, ${cor1}, ${cor2}); box-shadow:0 0 15px ${cor1}88;"></div>
      </div>
      <div class="info">
        <div class="valor">${percent}%</div>
        <div class="litros">${formatar(r.current_liters)} L</div>
      </div>
    `;
    area.appendChild(el);
  });
}

function renderBombas(lista) {
  const area = document.getElementById("areaBombas");
  if (!area) return;
  area.innerHTML = "";

  lista.forEach(b => {
    const ligada = b.estado === "ligada";
    const el = document.createElement("div");
    el.className = `card bomba ${ligada ? "ligada" : "desligada"}`;
    el.innerHTML = `
      <h2>${b.nome}</h2>
      <div class="status-icon">${ligada ? "🟢" : "🔴"}</div>
      <div class="valor">${ligada ? "LIGADA" : "DESLIGADA"}</div>
      <div class="ciclos">${b.ciclo || 0} ciclos</div>
    `;
    area.appendChild(el);
  });
}

function renderPressoes(lista) {
  const area = document.getElementById("areaPressoes");
  if (!area) return;
  area.innerHTML = "";

  lista.forEach(p => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <h2>${p.nome}</h2>
      <div class="valor-pressao">${p.pressao ? p.pressao.toFixed(2) + " bar" : "--"}</div>
    `;
    area.appendChild(el);
  });
}

function formatar(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function atualizarKPIs(reservatorios, bombas) {
  const elCritico = document.getElementById("kpiCritico");
  if (elCritico) {
    elCritico.innerText = reservatorios.filter(r => r.percent < 30).length;
  }
}
