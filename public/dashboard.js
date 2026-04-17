const API = "/api/dashboard";
let ws;

// INIT
init();

function init() {
  conectarWS();
  setInterval(fallbackHTTP, 8000);
}

// WEBSOCKET
function conectarWS() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => setStatus("🟢 Tempo real conectado");

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.dados) atualizarTela(data.dados);
  };

  ws.onclose = () => {
    setStatus("🔴 Reconectando...");
    setTimeout(conectarWS, 3000);
  };

  ws.onerror = () => setStatus("🟡 Fallback HTTP");
}

// FALLBACK
async function fallbackHTTP() {
  if (ws.readyState === 1) return;

  try {
    const res = await fetch(API + "?t=" + Date.now());
    const data = await res.json();
    atualizarTela(data);
  } catch {
    setStatus("🔴 Sem conexão");
  }
}

// ATUALIZA
function atualizarTela(data) {
  document.getElementById("lastUpdate").innerText =
    "Atualizado: " + new Date().toLocaleTimeString("pt-BR");

  renderReservatorios(data.reservatorios || []);
  renderBombas(data.bombas || []);
  renderPressoes(data.pressoes || []);
}

// RESERVATÓRIOS
function renderReservatorios(lista) {
  const area = document.getElementById("areaReservatorios");
  area.innerHTML = "";

  lista.forEach(r => {
    const el = document.createElement("div");

    el.className = "card " + getStatus(r.percent);

    el.innerHTML = `
      <div class="barra" style="height:${r.percent}%"></div>
      <h2>${r.nome}</h2>
      <div class="valor">${r.percent}%</div>
      <div>${formatar(r.current_liters)} L</div>
    `;

    area.appendChild(el);
  });
}

// BOMBAS
function renderBombas(lista) {
  const area = document.getElementById("areaBombas");
  area.innerHTML = "";

  lista.forEach(b => {
    const el = document.createElement("div");

    el.className = "card " + (b.estado === "ligada" ? "ligada" : "desligada");

    el.innerHTML = `
      <h2>${b.nome}</h2>
      <div class="valor">${b.estado.toUpperCase()}</div>
      <div>${b.ciclo} ciclos</div>
    `;

    area.appendChild(el);
  });
}

// PRESSÕES
function renderPressoes(lista) {
  const area = document.getElementById("areaPressoes");
  area.innerHTML = "";

  lista.forEach(p => {
    const el = document.createElement("div");

    el.className = "card";

    el.innerHTML = `
      <h2>${p.nome}</h2>
      <div class="valor">${p.pressao ?? "--"} bar</div>
    `;

    area.appendChild(el);
  });
}

// HELPERS
function getStatus(p) {
  if (p < 30) return "critico";
  if (p < 70) return "alerta";
  return "normal";
}

function formatar(n) {
  return Number(n).toLocaleString("pt-BR");
}

function setStatus(txt) {
  document.getElementById("statusSistema").innerText = txt;
}
