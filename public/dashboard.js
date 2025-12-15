// ========================= CONFIG =========================
const API = "/api/dashboard";

// ========================= ESTADOS =========================
let manutencao = JSON.parse(localStorage.getItem("manutencao")) || {};
let ultimasLeituras = {
  reservatorios: {},
  pressoes: {},
  bombas: {}
};

// ========================= ALERTAS =========================
let alertaAtivo = {};
let alertaNivel31 = {};
let bipNivelIntervalo = {};

// ========================= DATA SEGURA =========================
function formatarHora(ts) {
  const d = ts ? new Date(ts) : new Date();
  return isNaN(d.getTime())
    ? new Date().toLocaleTimeString()
    : d.toLocaleTimeString();
}

// ========================= AUDIO =========================
let audioCtx = null;
let audioLiberado = false;

function liberarAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  audioLiberado = true;
  document.removeEventListener("click", liberarAudio);
  document.removeEventListener("touchstart", liberarAudio);
}

document.addEventListener("click", liberarAudio);
document.addEventListener("touchstart", liberarAudio);

function bipCurto() {
  if (!audioLiberado || !audioCtx) return;
  const o = audioCtx.createOscillator();
  o.type = "square";
  o.frequency.value = 600;
  o.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.12);
}

// ========================= LOOP HTTP =========================
async function atualizar() {
  try {
    const r = await fetch(API, { cache: "no-store" });
    if (!r.ok) throw new Error();

    const dados = await r.json();
    atualizarCacheHTTP(dados);
    renderTudo();

    document.getElementById("lastUpdate").textContent =
      "Atualizado " + formatarHora(dados.lastUpdate);
  } catch {
    renderTudo();
    document.getElementById("lastUpdate").textContent =
      "Sem comunicação " + formatarHora();
  }
}

setInterval(atualizar, 5000);
atualizar();

// ========================= CACHE HTTP =========================
function atualizarCacheHTTP(d) {
  d?.reservatorios?.forEach(r =>
    ultimasLeituras.reservatorios[r.setor] = r
  );

  d?.pressoes?.forEach(p =>
    ultimasLeituras.pressoes[p.setor] = p
  );

  // ✅ HTTP INICIALIZA BOMBAS
  d?.bombas?.forEach(b => {
    if (!ultimasLeituras.bombas[b.nome]) {
      ultimasLeituras.bombas[b.nome] = b;
    }
  });
}

// ========================= RENDER =========================
function renderTudo() {
  renderReservatorios(Object.values(ultimasLeituras.reservatorios));
  renderPressao(Object.values(ultimasLeituras.pressoes));
  renderBombas(ultimasLeituras.bombas);
}

// ========================= BOMBAS =========================
function renderBombas(bombas) {
  atualizar("Bomba 01", "bomba1", "b1Status", "b1Ciclos");
  atualizar("Bomba 02", "bomba2", "b2Status", "b2Ciclos");
  atualizar("Bomba Osmose", "bomba3", "b3Status", "b3Ciclos");

  function atualizar(nome, cardId, statusId, cicloId) {
    const b = bombas[nome];
    if (!b) return;

    const ligada = b.estado_num === 1 || b.estado === "ligada";
    const card = document.getElementById(cardId);
    if (!card) return;

    card.classList.toggle("bomba-ligada", ligada);
    card.classList.toggle("bomba-desligada", !ligada);
    document.getElementById(statusId).textContent = ligada ? "Ligada" : "Desligada";
    document.getElementById(cicloId).textContent = b.ciclo ?? 0;
  }
}

// ========================= WEBSOCKET =========================
let ws;
function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);

      if (msg.type === "update") {
        atualizarCacheHTTP(msg.dados);
        renderTudo();
      }

      // 🚀 quando backend estiver pronto
      if (msg.type === "bomba") {
        ultimasLeituras.bombas[msg.nome] = msg;
        renderBombas(ultimasLeituras.bombas);
      }

      document.getElementById("lastUpdate").textContent =
        "Tempo real " + formatarHora();
    } catch {}
  };

  ws.onclose = () => setTimeout(connectWS, 3000);
  ws.onerror = () => ws.close();
}

connectWS();
