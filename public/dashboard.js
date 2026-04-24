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
    if (Date.now() - ultimoDado > 10000) {
      setStatus("🟡 Sem atualização");
    }
  }, 5000);

  // limpeza de cache de consumo interno
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

    const jitter = Math.random() * 1000;
    setTimeout(conectarWS, reconnectDelay + jitter);

    reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
  };

  ws.onerror = () => {
    console.log("Erro WS");
    ws.close();
  };
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
    setStatus("🔴 Sem conexão");
  }
}

// =======================
// PROCESSADOR ÚNICO
// =======================
function processarPayload(payload) {
  if (!payload) return;

  if (payload.dados) {
    const estrutura = montarEstrutura(payload.dados);
    scheduleRender(estrutura);
    return;
  }

  if (payload.reservatorios || payload.bombas) {
    scheduleRender(payload);
  }
}

// =======================
// MONTA ESTRUTURA
// =======================
function montarEstrutura(dados) {

  if (!dados || typeof dados !== "object") return null;

  return {
    reservatorios: [
  {
    nome: "Reservatório Elevador",
    percent: (dados["Reservatorio_Elevador_current"] / 20000) * 100,
    current_liters: dados["Reservatorio_Elevador_current"] || 0
  },
  {
    nome: "Reservatório Osmose",
    percent: Number(dados["Reservatorio_Osmose_current_percent"] || 0),
    current_liters: dados["Reservatorio_Osmose_current"] || 0
  },
  {
    nome: "Reservatório CME",
    percent: Number(dados["Reservatorio_CME_current_percent"] || 0),
    current_liters: dados["Reservatorio_CME_current"] || 0
  },
  {
    nome: "Água Abrandada",
    percent: Number(dados["Reservatorio_Agua_Abrandada_current_percent"] || 0),
    current_liters: dados["Reservatorio_Agua_Abrandada_current"] || 0
  },
  {
    nome: "Lavanderia",
    percent: Number(dados["Reservatorio_lavanderia_current_percent"] || 0),
    current_liters: dados["Reservatorio_lavanderia_current"] || 0
  }
],

    bombas: [
      {
        nome: "Bomba 01",
        estado: Number(dados["Bomba_01_binary"]) === 1 ? "ligada" : "desligada",
        ciclo: dados["Ciclos_Bomba_01_counter"] || 0
      },
      {
        nome: "Bomba 02",
        estado: Number(dados["Bomba_02_binary"]) === 1 ? "ligada" : "desligada",
        ciclo: dados["Ciclos_Bomba_02_counter"] || 0
      },
      {
        nome: "Bomba Osmose",
        estado: Number(dados["Bomba_Osmose_binary"]) === 1 ? "ligada" : "desligada",
        ciclo: dados["Ciclos_Bomba_Osmose_counter"] || 0
      }
    ],

    pressoes: [
      {
        nome: "Pressão Saída Osmose",
        pressao: dados["Pressao_Saida_Osmose_current"] || 0
      },
      {
        nome: "Pressão Retorno Osmose",
        pressao: dados["Pressao_Retorno_Osmose_current"] || 0
      },
      {
        nome: "Pressão CME",
        pressao: dados["Pressao_Saida_CME_current"] || 0
      }
    ]
  };
}

// =======================
// RENDER SCHEDULER (ANTI-FLICKER)
// =======================
function scheduleRender(data) {
  if (!data) return;
  if (renderPending) return;

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
  if (elHora) {
    elHora.innerText = new Date().toLocaleTimeString("pt-BR");
  }

  const reservatorios = data.reservatorios || [];
  const bombas = data.bombas || [];
  const pressoes = data.pressoes || [];

  renderReservatorios(reservatorios);
  renderBombas(bombas);
  renderPressoes(pressoes);

  atualizarBombasAtivas(bombas);
  atualizarKPIs(reservatorios, bombas);
}

// =======================
// STATUS
// =======================
function setStatus(txt) {
  const el = document.getElementById("statusSistema");
  if (el) el.innerText = txt;
}

// =======================
// BOMBAS ATIVAS
// =======================
function atualizarBombasAtivas(lista) {
  const el = document.getElementById("bombasAtivas");
  if (!el) return;

  const total = lista.filter(b => b.estado === "ligada").length;
  el.innerText = total;
}

// =======================
// CORES NIVEL
// =======================
function corNivel(percent) {
  if (percent >= 100) return ["#00e5ff", "#006eff"];
  if (percent >= 70) return ["#00ff88", "#00c853"];
  if (percent >= 40) return ["#ffd600", "#ff8f00"];
  return ["#ff1744", "#b71c1c"];
}

// =======================
// RESERVATORIOS
// =======================
function renderReservatorios(lista) {
  const area = document.getElementById("areaReservatorios");
  if (!area) return;

  area.innerHTML = "";

  lista.forEach(r => {

    const percent = Math.max(0, Math.min(100, Number(r.percent) || 0));
    const [cor1, cor2] = corNivel(percent);

    const safeName =
      window.CSS?.escape
        ? CSS.escape(r.nome)
        : r.nome.replace(/\s/g, "-");

    const el = document.createElement("div");
    el.className = "card reservatorio";
    el.setAttribute("data-nome", safeName);

    el.innerHTML = `
      <h2>${r.nome}</h2>

      <div class="tanque">
        <div class="escala">
          <span></span><span></span><span></span><span></span><span></span>
        </div>

        <div class="agua"
          style="height:${percent}%;
          background:linear-gradient(180deg, ${cor1}, ${cor2});
          box-shadow:0 0 20px ${cor1};">
        </div>
      </div>

      <div class="info">
        <div class="valor">${percent.toFixed(1)}%</div>
        <div class="litros">${formatar(r.current_liters)} L</div>
      </div>
    `;

    area.appendChild(el);
  });
}

// =======================
// BOMBAS
// =======================
function renderBombas(lista) {
  const area = document.getElementById("areaBombas");
  if (!area) return;

  area.innerHTML = "";

  lista.forEach(b => {

    const ligada = b.estado === "ligada";

    const el = document.createElement("div");
    el.className = "card " + (ligada ? "ligada" : "desligada");

    el.innerHTML = `
      <h2>${b.nome}</h2>
      <div class="valor">${ligada ? "🟢 LIGADA" : "🔴 DESLIGADA"}</div>
      <div>${b.ciclo || 0} ciclos</div>
    `;

    area.appendChild(el);
  });
}

// =======================
// PRESSÃO
// =======================
function renderPressoes(lista) {
  const area = document.getElementById("areaPressoes");
  if (!area) return;

  area.innerHTML = "";

  lista.forEach(p => {
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <h2>${p.nome}</h2>
      <div class="valor">${formatarPressao(p.pressao)}</div>
    `;

    area.appendChild(el);
  });
}

// =======================
// FORMATOS
// =======================
function formatar(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

function formatarPressao(p) {
  if (p === null || p === undefined) return "--";
  return Number(p).toFixed(2) + " bar";
}

// =======================
// KPIs + CONSUMO (FIXADO)
// =======================
function atualizarKPIs(reservatorios, bombas) {

  const bombasAtivas = bombas.filter(b => b.estado === "ligada").length;
  const elBombas = document.getElementById("kpiBombas");
  if (elBombas) elBombas.innerText = bombasAtivas;

  const criticos = reservatorios.filter(r => r.percent < 30).length;
  const elCritico = document.getElementById("kpiCritico");
  if (elCritico) elCritico.innerText = criticos;

  const agora = Date.now();

  reservatorios.forEach(r => {

    if (!historicoNivel[r.nome]) {
      historicoNivel[r.nome] = {
        nivel: r.current_liters,
        tempo: agora
      };
      return;
    }

    const anterior = historicoNivel[r.nome];

    const deltaNivel = anterior.nivel - r.current_liters;

if (deltaNivel <= 0) {
  historicoNivel[r.nome] = {
    nivel: r.current_liters,
    tempo: agora
  };
  return;
}
    const deltaTempo = (agora - anterior.tempo) / 1000;

    if (deltaTempo <= 0 || deltaNivel <= 0) return;

  const consumo = deltaTempo > 0 ? deltaNivel / deltaTempo : 0;
if (consumo <= 0) return;

    const tempoRestanteSeg = consumo > 0 ? r.current_liters / consumo : 0;

    if (tempoRestanteSeg < 60 || tempoRestanteSeg > 86400) return;

    const horas = Math.floor(tempoRestanteSeg / 3600);
    const minutos = Math.floor((tempoRestanteSeg % 3600) / 60);

    const safeName =
      window.CSS?.escape
        ? CSS.escape(r.nome)
        : r.nome.replace(/\s/g, "-");

    const card = document.querySelector(`.reservatorio[data-nome="${safeName}"]`);

    if (card) {
      let tempoEl = card.querySelector(".tempoRestante");

      if (!tempoEl) {
        tempoEl = document.createElement("div");
        tempoEl.className = "tempoRestante";
        card.appendChild(tempoEl);
      }

      tempoEl.innerText = `⏳ ${horas}h ${minutos}m restantes`;
    }

    historicoNivel[r.nome] = {
      nivel: r.current_liters,
      tempo: agora
    };
  });
}
