const API = "/api/dashboard";
let ws;

// ============================
// INIT
// ============================
init();

function init() {
  conectarWS();
  setInterval(fallbackHTTP, 8000);
}

// ============================
// WEBSOCKET
// ============================
function conectarWS() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => {
    setStatus("🟢 Tempo real conectado");
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.dados) atualizarTela(data.dados);
  };

  ws.onerror = () => {
    setStatus("🟡 Fallback HTTP");
  };

  ws.onclose = () => {
    setStatus("🔴 Reconectando...");
    setTimeout(conectarWS, 3000);
  };
}

// ============================
// FALLBACK HTTP
// ============================
async function fallbackHTTP() {
  if (ws.readyState === 1) return;

  try {
    const res = await fetch(API + "?t=" + Date.now());
    const data = await res.json();
    atualizarTela(data);
  } catch (e) {
    setStatus("🔴 Sem conexão");
  }
}

// ============================
// RENDER
// ============================
function atualizarTela(data) {
  document.getElementById("lastUpdate").innerText =
    new Date().toLocaleTimeString("pt-BR");

  renderReservatorios(data.reservatorios);
  renderPressoes(data.pressoes);
  renderBombas(data.bombas);
}

// ============================
// RESERVATÓRIOS
// ============================
function renderReservatorios(lista) {
  const grid = document.getElementById("grid");

  lista.forEach(r => {
    let el = document.getElementById(r.setor);

    if (!el) {
      el = criarCard(r.setor);
      grid.appendChild(el);
    }

    el.innerHTML = `
      <div class="barra" style="height:${r.percent}%"></div>
      <h2>${r.nome}</h2>
      <div class="valor">${r.percent}%</div>
      <div>${formatar(r.current_liters)} L</div>
    `;

    el.className = "card " + getStatus(r.percent);
  });
}

// ============================
// PRESSÕES
// ============================
function renderPressoes(lista) {
  lista.forEach(p => {
    let el = document.getElementById(p.setor);

    if (!el) {
      el = criarCard(p.setor);
      document.getElementById("grid").appendChild(el);
    }

    el.innerHTML = `
      <h2>${p.nome}</h2>
      <div class="valor">${p.pressao ?? "--"} bar</div>
    `;
  });
}

// ============================
// BOMBAS
// ============================
function renderBombas(lista) {
  lista.forEach(b => {
    let id = b.nome.replace(/\s/g, "");
    let el = document.getElementById(id);

    if (!el) {
      el = criarCard(id);
      document.getElementById("grid").appendChild(el);
    }

    el.innerHTML = `
      <h2>${b.nome}</h2>
      <div class="valor">${b.estado}</div>
      <div>${b.ciclo} ciclos</div>
    `;

    el.className = "card " + (b.estado === "ligada" ? "ligada" : "desligada");
  });
}

// ============================
// HELPERS
// ============================
function criarCard(id) {
  const div = document.createElement("div");
  div.id = id;
  div.className = "card";
  return div;
}

function formatar(n) {
  return Number(n).toLocaleString("pt-BR");
}

function getStatus(p) {
  if (p < 30) return "critico";
  if (p < 70) return "alerta";
  return "normal";
}

function setStatus(txt) {
  document.getElementById("statusSistema").innerText = txt;
}
