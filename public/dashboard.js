// ============================================================================
//  DASHBOARD — MONITORAMENTO DE RESERVATÓRIOS / PRESSÕES / BOMBAS DE CIRCULAÇÃO
// ============================================================================
// Versão: 2025-11 — otimizada, totalmente revisada, atualização contínua

const API_URL = window.location.origin + "/api/dashboard";
const UPDATE_INTERVAL = 5000; 
const WARNING_TIMEOUT = 10 * 60 * 1000;

// Elementos
const reservatoriosContainer = document.getElementById("reservatoriosContainer");
const pressoesContainer = document.getElementById("pressoesContainer");
const bombasContainer = document.getElementById("bombasContainer");
const lastUpdateEl = document.getElementById("lastUpdate");

// Banner atraso
let avisoEl = document.getElementById("aviso-atraso");
if (!avisoEl) {
  avisoEl = document.createElement("div");
  avisoEl.id = "aviso-atraso";
  avisoEl.textContent = "⚠ Sem atualização há mais de 10 minutos";
  document.body.prepend(avisoEl);
}

// Utilidades
function formatNumber(n){ return n==null?"--":Number(n).toLocaleString("pt-BR") }
function formatDuration(ms){
  if(!ms) return "--:--";
  const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000);
  return `${m}:${s.toString().padStart(2,"0")}`
}

// ============================================================================
//  BOMBA — CONFIG & ESTADO LOCAL
// ============================================================================

const BOMBA_ON_MS = 15*60*1000;
const BOMBA_TOLERANCIA_MS = 3*60*1000;
const NENHUMA_LIGADA_ALERT_MS = BOMBA_ON_MS + BOMBA_TOLERANCIA_MS;

window._bombaState = window._bombaState || {
  bomba01:{ lastBinary:0,startTs:null,lastOnTs:null,lastCycle:0,lastRunMs:null },
  bomba02:{ lastBinary:0,startTs:null,lastOnTs:null,lastCycle:0,lastRunMs:null }
};

// ============================================================================
//  GERAR UI INICIAL
// ============================================================================

function criarEstruturaInicial(reservatorios,pressoes){
  reservatoriosContainer.innerHTML="";
  pressoesContainer.innerHTML="";
  bombasContainer.innerHTML="";

  reservatorios.forEach(r=>{
    const id=`res_${r.setor}`;
    reservatoriosContainer.innerHTML+=`
    <div class="card-reservatorio" id="${id}">
      <h3>${r.nome}</h3>
      <div class="tanque-visu"><div class="nivel-agua" id="${id}_nivel"></div>
      <div class="overlay-info"><div id="${id}_percent">--%</div><div id="${id}_litros">-- L</div></div></div>
      <div id="${id}_alerta" class="alerta-msg" style="display:none">⚠ Nível < 30%</div>
      <label><input id="${id}_manut" type="checkbox"> Em manutenção</label>
      <div id="${id}_tag" class="manutencao-tag" style="display:none">EM MANUTENÇÃO</div>
      <div>Capacidade: <span id="${id}_cap">${formatNumber(r.capacidade)} L</span></div>
    </div>`;
  });

  pressoes.forEach(p=>{
    const id=`pres_${p.setor}`;
    pressoesContainer.innerHTML+=`
    <div class="card-pressao" id="${id}">
      <h3>${p.nome}</h3>
      <div class="pressao-valor" id="${id}_valor">--</div><span>bar</span>
    </div>`;
  });

  bombasContainer.innerHTML=`
  <div class="card card-bomba" id="card-bomba-01">
    <h3>Bomba 01</h3>
    Status: <span id="status-bomba-01">--</span><br>
    Ciclos: <span id="ciclos-bomba-01">--</span><br>
    Tempo ligada: <span id="tempo-bomba-01">--:--</span><br>
    Último ON: <span id="ultimoon-bomba-01">--</span><br>
    <div id="alerta-bomba-01" class="alerta" style="display:none"></div>
  </div>

  <div class="card card-bomba" id="card-bomba-02">
    <h3>Bomba 02</h3>
    Status: <span id="status-bomba-02">--</span><br>
    Ciclos: <span id="ciclos-bomba-02">--</span><br>
    Tempo ligada: <span id="tempo-bomba-02">--:--</span><br>
    Último ON: <span id="ultimoon-bomba-02">--</span><br>
    <div id="alerta-bomba-02" class="alerta" style="display:none"></div>
  </div>`;
}

// ============================================================================
//  ATUALIZAÇÃO — RESERVATÓRIOS / PRESSÕES
// ============================================================================

function atualizarValores(d){

// RESERVATÓRIOS
d.reservatorios?.forEach(r=>{
  const id=`res_${r.setor}`;
  const pct=r.percent;
  const lit=r.current_liters;

  document.getElementById(`${id}_nivel`).style.height=pct+"%";
  document.getElementById(`${id}_percent`).innerText=Math.round(pct)+"%";
  document.getElementById(`${id}_litros`).innerText=formatNumber(lit)+" L";

  const alerta=document.getElementById(`${id}_alerta`);
  alerta.style.display=pct<=30?"block":"none";
});

// PRESSÕES
d.pressoes?.forEach(p=>{
  const id=`pres_${p.setor}`;
  const v=Number(p.pressao??0);
  const el=document.getElementById(`${id}_valor`);
  if(el) el.innerText=isNaN(v)?"--":v.toFixed(2);
});

// ============================================================================
//  🔥 BOMBA — ATUALIZAÇÃO DE VALORES
// ============================================================================

const b1=Number(d.Bomba_01_binary??0);
const b2=Number(d.Bomba_02_binary??0);
const c1=Number(d.Ciclos_Bomba_01_counter??0);
const c2=Number(d.Ciclos_Bomba_02_counter??0);
const now=Date.now();

function proc(key,bin,cyc){
  const st=window._bombaState[key];
  const n=key==="bomba01"?"1":"2";

  if(st.lastBinary==0 && bin==1){ st.startTs=now; st.lastOnTs=now; st.lastCycle=cyc }
  if(st.lastBinary==1 && bin==0){ st.lastRunMs=now-st.startTs; st.startTs=null }
  st.lastBinary=bin;

  document.getElementById(`status-bomba-${n}`).innerText=bin?"Ligada":"Desligada";
  document.getElementById(`status-bomba-${n}`).style.color=bin?"green":"#777";
  document.getElementById(`ciclos-bomba-${n}`).innerText=cyc;

  const run=bin?now-(st.startTs||now):st.lastRunMs;
  document.getElementById(`tempo-bomba-${n}`).innerText=formatDuration(run);
  document.getElementById(`ultimoon-bomba-${n}`).innerText=st.lastOnTs?new Date(st.lastOnTs).toLocaleTimeString():"--";
}
proc("bomba01",b1,c1);
proc("bomba02",b2,c2);


// ============================================================================
// 🔥 REGRAS NOVAS — MANUTENÇÃO + CORES POR NÍVEL (30% / 31%)
// ============================================================================

d.reservatorios?.forEach(r => {
  const id = `res_${r.setor}`;
  const pct = r.percent;
  const card = document.getElementById(id);
  const manut = document.getElementById(`${id}_manut`);
  const alerta = document.getElementById(`${id}_alerta`);
  const nivelDiv = document.getElementById(`${id}_nivel`);
  const tag = document.getElementById(`${id}_tag`);

  // 🔥 Se marcar manutenção → alerta some
  if (manut.checked) {
      alerta.style.display = "none";
      tag.style.display = "block";
      card.style.opacity = "0.55";
      nivelDiv.style.background = "#9e9e9e"; // cinza
  } else {
      tag.style.display = "none";
      card.style.opacity = "1";

      // 🎨 Se não estiver em manutenção, aplica cores por nível
      if (pct < 30) nivelDiv.style.background = "#d9534f"; // vermelho
      else if (pct <= 70) nivelDiv.style.background = "#f0ad4e"; // amarelo
      else nivelDiv.style.background = "#4CAF50"; // verde
  }

  // 🔄 AUTO-DESMARCA MANUTENÇÃO QUANDO CHEGAR EM 31%
  if (manut.checked && pct >= 31) manut.checked = false;
});


} // fim atualizarValores


// ============================================================================
//  ATUALIZAÇÃO LOOP
// ============================================================================
async function atualizar(){
  try{
    const r=await fetch(API_URL,{cache:"no-store"});
    const d=await r.json();

    if(!window._ui){ criarEstruturaInicial(d.reservatorios,d.pressoes); window._ui=1 }
    atualizarValores(d);

    lastUpdateEl.innerText="Última atualização: "+new Date().toLocaleTimeString();
    avisoEl.style.display="none";

    window._cache=d;
  }catch{
    if(window._cache){ atualizarValores(window._cache) }
    avisoEl.style.display="block";
  }
}

atualizar();
setInterval(atualizar,UPDATE_INTERVAL);
