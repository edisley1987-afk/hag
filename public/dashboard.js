const API = "/api/dashboard";

let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();

init();

// =======================
// INIT
// =======================
function init(){
  conectarWS();
  setInterval(fallbackHTTP, 8000);

  setInterval(() => {
    if (Date.now() - ultimoDado > 10000) {
      setStatus("🟡 Sem atualização");
    }
  }, 5000);
}

// =======================
// WEBSOCKET
// =======================
function conectarWS(){

  if (ws) {
    ws.close();
    ws = null;
  }

  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocolo}//${location.host}`);

  ws.onopen = () => {
    console.log("WS conectado");
    setStatus("🟢 Tempo real conectado");
  };

  ws.onmessage = (msg) => {

    let payload;

    try {
      payload = JSON.parse(msg.data);
    } catch (e) {
      console.log("JSON inválido WS");
      return;
    }

    ultimoDado = Date.now();

    if (!payload) return;

    if (
      payload.type === "init" ||
      payload.type === "update" ||
      payload.type === "heartbeat"
    ) {
      if (payload.dados) montarEstrutura(payload.dados);
      return;
    }

    if (payload.dados) {
      montarEstrutura(payload.dados);
      return;
    }

    if (payload.reservatorios) {
      atualizarTela(payload);
    }
  };

  ws.onclose = () => {
    console.log("WS desconectado");
    setStatus("🔴 Reconectando...");
    setTimeout(conectarWS, reconnectDelay);
  };

  ws.onerror = () => {
    console.log("Erro WS");
    ws.close();
  };
}

// =======================
// FALLBACK HTTP
// =======================
async function fallbackHTTP(){

  try {
    const res = await fetch(API + "?ts=" + Date.now());

    if (!res.ok) throw new Error("HTTP error");

    const data = await res.json();
    atualizarTela(data);

  } catch (e) {
    setStatus("🔴 Sem conexão");
  }
}

// =======================
// ESTRUTURA DADOS
// =======================
function montarEstrutura(dados){

  if (!dados || typeof dados !== "object") return;

  const estrutura = {
    reservatorios: [
      {
        nome: "Reservatório Elevador",
        percent: Number(dados["Reservatorio_Elevador_current_percent"] || 0),
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
]
  };

  atualizarTela(estrutura);
}

// =======================
// UPDATE UI
// =======================
function atualizarTela(data){

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
function atualizarBombasAtivas(lista){

  const el = document.getElementById("bombasAtivas");
  if (!el) return;

  let total = 0;

  lista.forEach(b => {
    if (b.estado === "ligada") total++;
  });

  el.innerText = total;
}
// =======================
// COR NEON
// =======================
function corNivel(percent){

  if (percent >= 100) return ["#00e5ff","#006eff"];
  if (percent >= 70)  return ["#00ff88","#00c853"];
  if (percent >= 40)  return ["#ffd600","#ff8f00"];
  return ["#ff1744","#b71c1c"];
}

// =======================
// RESERVATORIOS
// =======================
function renderReservatorios(lista){

  const area = document.getElementById("areaReservatorios");
  if (!area) return;

  area.innerHTML = "";

  lista.forEach(r => {

    const percent = Math.max(0, Math.min(100, Number(r.percent) || 0));
    const [cor1, cor2] = corNivel(percent);

    const el = document.createElement("div");
el.className = "card reservatorio";
el.setAttribute("data-nome", r.nome);

    el.innerHTML = `
      <h2>${r.nome}</h2>

      <div class="tanque">
        <div class="escala">
          <span></span><span></span><span></span><span></span><span></span>
        </div>

        <div class="agua"
          style="
            height:${percent}%;
            background:linear-gradient(180deg, ${cor1}, ${cor2});
            box-shadow:0 0 20px ${cor1};
          ">
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
function renderBombas(lista){

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
function renderPressoes(lista){

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
function formatar(n){
  return Number(n || 0).toLocaleString("pt-BR");
}

function formatarPressao(p){
  if (p === null || p === undefined) return "--";
  return Number(p).toFixed(2) + " bar";
}

// =======================
// STATUS
// =======================
function setStatus(txt){
  const el = document.getElementById("statusSistema");
  if (el) el.innerText = txt;
}
// =======================
// KPIs INDUSTRIAIS
// =======================

let historicoNivel = {};

function atualizarKPIs(reservatorios, bombas){

  // ------------------
  // BOMBAS ATIVAS
  // ------------------
  const bombasAtivas = bombas.filter(b => b.estado === "ligada").length;

  const elBombas = document.getElementById("kpiBombas");
  if(elBombas) elBombas.innerText = bombasAtivas;


  // ------------------
  // RESERVATORIOS CRITICOS
  // ------------------
  const criticos = reservatorios.filter(r => r.percent < 30).length;

  const elCritico = document.getElementById("kpiCritico");
  if(elCritico) elCritico.innerText = criticos;


  // ------------------
  // CONSUMO E PREVISÃO
  // ------------------

  reservatorios.forEach(r => {

    const agora = Date.now();

    if(!historicoNivel[r.nome]){
      historicoNivel[r.nome] = {
        nivel: r.current_liters,
        tempo: agora
      };
      return;
    }

    const anterior = historicoNivel[r.nome];

    const deltaNivel = anterior.nivel - r.current_liters;
    const deltaTempo = (agora - anterior.tempo) / 1000;

    if(deltaTempo <= 0) return;

    const consumoPorSegundo = Math.max(0, deltaNivel / deltaTempo);

    // tempo restante
    if(consumoPorSegundo > 0){

      const tempoRestanteSeg = r.current_liters / consumoPorSegundo;
      if(tempoRestanteSeg > 86400) return;
if(tempoRestanteSeg < 60) return;
if(tempoRestanteSeg > 86400) return; // ignora previsão maior que 24h
      const horas = Math.floor(tempoRestanteSeg / 3600);
      const minutos = Math.floor((tempoRestanteSeg % 3600) / 60);

      const card = document.querySelector(`.reservatorio[data-nome="${r.nome}"]`);

      if(card){

        let tempoEl = card.querySelector(".tempoRestante");

        if(!tempoEl){
          tempoEl = document.createElement("div");
          tempoEl.className = "tempoRestante";
          card.appendChild(tempoEl);
        }

        tempoEl.innerText = `⏳ ${horas}h ${minutos}m restantes`;
      }

    }

    historicoNivel[r.nome] = {
      nivel: r.current_liters,
      tempo: agora
    };

  });

}
