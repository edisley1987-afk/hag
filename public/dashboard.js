const API = "/api/dashboard";
let ws;
let reconnectDelay = 3000;

// ================= INIT =================
init();

function init() {
  conectarWS();
  setInterval(fallbackHTTP, 8000);
}

// ================= WEBSOCKET =================
function conectarWS() {
  try {
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);

    ws.onopen = () => {
      setStatus("🟢 Tempo real conectado");
      reconnectDelay = 3000; // reseta delay
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);

        // compatível com {type:"update", dados:{}}
        if (data.dados) atualizarTela(data.dados);
        if (data.type === "init" && data.dados) atualizarTela(data.dados);

      } catch (e) {
        console.error("Erro parse WS:", e);
      }
    };

    ws.onclose = () => {
      setStatus("🔴 Reconectando...");
      setTimeout(conectarWS, reconnectDelay);

      // backoff progressivo
      reconnectDelay = Math.min(reconnectDelay + 2000, 15000);
    };

    ws.onerror = () => {
      setStatus("🟡 Fallback HTTP");
    };

  } catch (err) {
    console.error("Erro WS:", err);
    setStatus("🔴 Erro conexão");
  }
}

// ================= FALLBACK HTTP =================
async function fallbackHTTP() {
  if (ws && ws.readyState === 1) return;

  try {
    const res = await fetch(API + "?t=" + Date.now());
    const data = await res.json();

    if (data) atualizarTela(data);

  } catch (e) {
    console.error("Erro HTTP:", e);
    setStatus("🔴 Sem conexão");
  }
}

// ================= ATUALIZAÇÃO =================
function atualizarTela(data) {
  document.getElementById("lastUpdate").innerText =
    "Atualizado: " + new Date().toLocaleTimeString("pt-BR");

  renderReservatorios(data.reservatorios || []);
  renderBombas(data.bombas || []);
  renderPressoes(data.pressoes || []);
}

// ================= RESERVATÓRIOS =================
function renderReservatorios(lista) {
  const area = document.getElementById("areaReservatorios");
  area.innerHTML = "";

  lista.forEach(r => {
    const el = document.createElement("div");

    el.className = "card " + getStatus(r.percent);

    el.innerHTML = `
      <div class="barra" style="height:${r.percent}%"></div>
      <h2>${r.nome}</h2>
      <div class="valor">${r.percent ?? 0}%</div>
      <div>${formatar(r.current_liters)} L</div>
    `;

    area.appendChild(el);
  });
}

// ================= BOMBAS =================
function renderBombas(lista) {
  const area = document.getElementById("areaBombas");
  area.innerHTML = "";

  lista.forEach(b => {
    const el = document.createElement("div");

    const ligada = b.estado === "ligada";

    el.className = "card " + (ligada ? "ligada" : "desligada");

    el.innerHTML = `
      <h2>${b.nome}</h2>
      <div class="valor">${ligada ? "🟢 LIGADA" : "🔴 DESLIGADA"}</div>
      <div>${b.ciclo ?? 0} ciclos</div>
    `;

    area.appendChild(el);
  });
}

// ================= PRESSÕES =================
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

// ================= HELPERS =================
function getStatus(p) {
  p = Number(p) || 0;

  if (p < 30) return "critico";
  if (p < 70) return "alerta";
  return "normal";
}

function formatar(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function setStatus(txt) {
  const el = document.getElementById("statusSistema");
  if (el) el.innerText = txt;
}
