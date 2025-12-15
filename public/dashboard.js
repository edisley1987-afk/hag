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


// ========================= LOOP HTTP =========================
async function atualizar() {
  try {
    const r = await fetch(API, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);

    const dados = await r.json();
    atualizarCache(dados);
    renderTudo();

    document.getElementById("lastUpdate").textContent =
      "Atualizado " + new Date(dados.lastUpdate).toLocaleTimeString();

  } catch (e) {
    console.warn("Falha API, usando cache");
    renderTudo();
  }
}

setInterval(atualizar, 5000);
atualizar();


// ========================= CACHE =========================
function atualizarCache(d) {

  d.reservatorios?.forEach(r =>
    ultimasLeituras.reservatorios[r.setor] = r
  );

  d.pressoes?.forEach(p =>
    ultimasLeituras.pressoes[p.setor] = p
  );

  d.bombas?.forEach(b =>
    ultimasLeituras.bombas[b.nome] = b
  );
}


// ========================= RENDER GERAL =========================
function renderTudo() {
  renderReservatorios(Object.values(ultimasLeituras.reservatorios));
  renderPressao(Object.values(ultimasLeituras.pressoes));
  renderBombas(ultimasLeituras.bombas);
}


// ========================= SOM =========================
function bipCurto() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 600;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.12);
  } catch {}
}


// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
  const box = document.getElementById("reservatoriosContainer");
  if (!box) return;

  const frag = document.createDocumentFragment();
  let alertas40 = [];

  lista.forEach(r => {
    const percent = Math.round(r.percent || 0);
    const litros = r.current_liters ?? "--";

    const card = document.createElement("div");
    card.className = "card-reservatorio";

    if (percent <= 30) card.classList.add("nv-critico");
    else if (percent <= 60) card.classList.add("nv-alerta");
    else card.classList.add("nv-normal");

    if (percent < 31 && !manutencao[r.setor]) {
      card.classList.add("piscar-31");
      if (!alertaNivel31[r.setor]) {
        alertaNivel31[r.setor] = true;
        bipNivelIntervalo[r.setor] = setInterval(bipCurto, 3000);
      }
    } else {
      clearInterval(bipNivelIntervalo[r.setor]);
      delete alertaNivel31[r.setor];
    }

    if (percent <= 40 && !manutencao[r.setor]) {
      if (!alertaAtivo[r.setor]) bipCurto();
      alertaAtivo[r.setor] = true;
      alertas40.push(`${r.nome} (${percent}%)`);
    } else alertaAtivo[r.setor] = false;

    card.innerHTML = `
      <div class="top-bar">
        <h3>${r.nome}</h3>
        <button class="gear-btn"
          onclick="toggleManutencao('${r.setor}')">⚙</button>
      </div>

      <div class="tanque-visu">
        <div class="nivel-agua" style="height:${percent}%"></div>
        <div class="overlay-info">
          <div class="percent-text">${percent}%</div>
          <div class="liters-text">${litros} L</div>
        </div>
      </div>

      <button onclick="abrirHistorico('${r.setor}')">
        📊 Histórico
      </button>
    `;

    frag.appendChild(card);
  });

  box.innerHTML = "";
  box.appendChild(frag);
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
    if (el && p.pressao != null) {
      el.textContent = Number(p.pressao).toFixed(2);
    }
  });
}


// ========================= BOMBAS (FIX DEFINITIVO) =========================
function renderBombas(bombas) {

  atualizarBomba("Bomba 01", "bomba1", "b1Status", "b1Ciclos");
  atualizarBomba("Bomba 02", "bomba2", "b2Status", "b2Ciclos");
  atualizarBomba("Bomba Osmose", "bomba3", "b3Status", "b3Ciclos");

  function atualizarBomba(nome, cardId, statusId, cicloId) {
    const b = bombas[nome];
    if (!b) return;

    const ligada = b.estado_num === 1 || b.estado === "ligada";

    const card = document.getElementById(cardId);
    if (!card) return;

    card.classList.toggle("bomba-ligada", ligada);
    card.classList.toggle("bomba-desligada", !ligada);

    document.getElementById(statusId).textContent =
      ligada ? "Ligada" : "Desligada";

    document.getElementById(cicloId).textContent =
      b.ciclo ?? 0;
  }
}


// ========================= MANUTENÇÃO =========================
function toggleManutencao(setor) {
  manutencao[setor] = !manutencao[setor];
  localStorage.setItem("manutencao", JSON.stringify(manutencao));
}

function abrirHistorico(setor) {
  location.href = `/historico.html?setor=${setor}`;
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
          "Tempo real " + new Date().toLocaleTimeString();
      }
    } catch {}
  };

  ws.onclose = () => setTimeout(connectWS, 3000);
  ws.onerror = () => ws.close();
}

connectWS();
