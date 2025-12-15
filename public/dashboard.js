// ========================= CONFIG =========================
const API = "/api/dashboard";
const MAX_ATRASO_BOMBA = 120000; // 2 minutos tolerância

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
  return isNaN(d.getTime()) ? new Date().toLocaleTimeString() : d.toLocaleTimeString();
}

// ========================= AUDIO =========================
let audioCtx = null;
let audioLiberado = false;

function liberarAudio() {
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  audioLiberado = true;
  document.removeEventListener("click", liberarAudio);
  document.removeEventListener("touchstart", liberarAudio);
}

document.addEventListener("click", liberarAudio);
document.addEventListener("touchstart", liberarAudio);

function bipCurto() {
  if (!audioLiberado) return;
  const o = audioCtx.createOscillator();
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
    atualizarCache(dados);
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

// ========================= CACHE =========================
function atualizarCache(d) {
  d?.reservatorios?.forEach(r => ultimasLeituras.reservatorios[r.setor] = r);
  d?.pressoes?.forEach(p => ultimasLeituras.pressoes[p.setor] = p);

  d?.bombas?.forEach(b => {
    ultimasLeituras.bombas[b.nome] = {
      ...b,
      _ts: Date.now() // timestamp local
    };
  });
}

// ========================= RENDER =========================
function renderTudo() {
  renderReservatorios(Object.values(ultimasLeituras.reservatorios));
  renderPressao(Object.values(ultimasLeituras.pressoes));
  renderBombas(ultimasLeituras.bombas);
}

// ========================= PRESSÕES =========================
function renderPressao(lista) {
  const mapa = {
    saida_osmose: "pSaidaOsmose",
    retorno_osmose: "pRetornoOsmose",
    saida_cme: "pSaidaCME"
  };

  lista.forEach(p => {
    const el = document.getElementById(mapa[p.setor]);
    if (el && p.pressao != null) el.textContent = Number(p.pressao).toFixed(2);
  });
}

// ========================= BOMBAS (ANTI-ATRASO) =========================
function renderBombas(bombas) {
  atualizar("Bomba 01", "bomba1", "b1Status", "b1Ciclos");
  atualizar("Bomba 02", "bomba2", "b2Status", "b2Ciclos");
  atualizar("Bomba Osmose", "bomba3", "b3Status", "b3Ciclos");

  function atualizar(nome, cardId, statusId, cicloId) {
    const b = bombas[nome];
    const card = document.getElementById(cardId);
    if (!card) return;

    if (!b) {
      card.className = "bomba bomba-desligada";
      document.getElementById(statusId).textContent = "--";
      document.getElementById(cicloId).textContent = "--";
      return;
    }

    const atrasada = Date.now() - b._ts > MAX_ATRASO_BOMBA;
    const ligada = !atrasada && (b.estado_num === 1 || b.estado === "ligada");

    card.classList.toggle("bomba-ligada", ligada);
    card.classList.toggle("bomba-desligada", !ligada);

    document.getElementById(statusId).textContent =
      atrasada ? "Sem leitura" : ligada ? "Ligada" : "Desligada";

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
        atualizarCache(msg.dados);
        renderTudo();
        document.getElementById("lastUpdate").textContent =
          "Tempo real " + formatarHora();
      }
    } catch {}
  };

  ws.onclose = () => setTimeout(connectWS, 3000);
  ws.onerror = () => ws.close();
}

connectWS();
