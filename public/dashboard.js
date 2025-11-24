// =============================
// dashboard.js — com onda SVG animada
// =============================
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos
let ultimaLeitura = 0;

const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current:   { nome: "Reservatório Osmose",   capacidade: 200 },
  Reservatorio_CME_current:      { nome: "Reservatório CME",      capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 }
};

const PRESSOES = {
  Pressao_Saida_Osmose_current:  "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current:"Pressão Retorno Osmose",
  Pressao_Saida_CME_current:     "Pressão Saída CME"
};

const LS_KEY = "dashboard_last";
const LS_TIMESTAMP = "dashboard_last_ts";

function salvarLocal(dados){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(dados));
    localStorage.setItem(LS_TIMESTAMP, Date.now().toString());
  }catch(e){ console.warn("Erro salvando localStorage", e); }
}
function carregarLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    const tsRaw = localStorage.getItem(LS_TIMESTAMP);
    const ts = tsRaw ? parseInt(tsRaw,10) : null;
    if(!raw) return { dados:null, ts };
    return { dados: JSON.parse(raw), ts };
  }catch(e){ return { dados:null, ts:null }; }
}

// cria cards com SVG de onda
function criarCards(){
  const rContainer = document.getElementById("reservatoriosContainer");
  const pContainer = document.getElementById("pressoesContainer");
  rContainer.innerHTML = "";
  pContainer.innerHTML = "";

  // template de SVG reduzido (reaproveitável)
  const svgTemplate = `
    <div class="nivel" aria-hidden="true">
      <svg class="wave-svg" viewBox="0 0 2400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <g class="wave-path wave-1" transform="translate(0,0)">
          <path d="M0 120 C 150 200 350 40 600 120 C 850 200 1050 40 1200 120 L1200 400 L0 400 Z" fill="#2fa7ff"></path>
          <path d="M1200 120 C 1350 200 1550 40 1800 120 C 2050 200 2250 40 2400 120 L2400 400 L1200 400 Z" fill="#2fa7ff"></path>
        </g>
        <g class="wave-path wave-2" transform="translate(0,0)">
          <path d="M0 140 C 150 60 350 240 600 140 C 850 40 1050 240 1200 140 L1200 400 L0 400 Z" fill="#0066c5"></path>
          <path d="M1200 140 C 1350 60 1550 240 1800 140 C 2050 40 2250 240 2400 140 L2400 400 L1200 400 Z" fill="#0066c5"></path>
        </g>
      </svg>
    </div>`;

  // reservatórios
  Object.keys(RESERVATORIOS).forEach(id=>{
    const cfg = RESERVATORIOS[id];
    const card = document.createElement("div");
    card.className = "card reservatorio sem-dados";
    card.id = id;
    card.setAttribute("style","--nivel:0%;");
    card.innerHTML = `
      <div class="aviso-inativo">⚠ Sem atualização há mais de 10 minutos</div>
      ${svgTemplate}
      <div class="conteudo">
        <h3>${cfg.nome}</h3>
        <div class="percent">--%</div>
        <div class="liters">-- L</div>
        <button class="btn-hist" onclick="abrirHistorico('${id.replace('_current','')}')">Ver Histórico</button>
      </div>
    `;
    rContainer.appendChild(card);
  });

  // pressões (cards simples, sem onda)
  Object.keys(PRESSOES).forEach(id=>{
    const nome = PRESSOES[id];
    const card = document.createElement("div");
    card.className = "card pressao sem-dados";
    card.id = id;
    card.innerHTML = `
      <div class="conteudo">
        <h3>${nome}</h3>
        <div class="percent">-- bar</div>
      </div>
    `;
    pContainer.appendChild(card);
  });
}

// atualizar leituras (fetch)
async function atualizarLeituras(){
  try{
    const r = await fetch(API_URL + "?t=" + Date.now(), {cache: "no-store"});
    const dados = await r.json();
    if(!dados){ usarLocalSeExistir(); return; }

    ultimaLeitura = Date.now();
    salvarLocal(dados);

    // reservatórios
    Object.keys(RESERVATORIOS).forEach(key=>{
      const cfg = RESERVATORIOS[key];
      const card = document.getElementById(key);
      if(!card) return;

      const percentEl = card.querySelector(".percent");
      const litersEl = card.querySelector(".liters");
      const aviso = card.querySelector(".aviso-inativo");

      const valor = dados[key];

      if(typeof valor !== "number" || isNaN(valor)){
        percentEl.textContent = "--%";
        litersEl.textContent = "-- L";
        card.style.setProperty('--nivel','0%');
        card.classList.add("sem-dados");
        if(aviso) aviso.style.display = "none";
        return;
      }

      const perc = Math.round(Math.max(0, Math.min(100, (valor / cfg.capacidade) * 100)));
      percentEl.textContent = perc + "%";
      litersEl.textContent = valor.toLocaleString("pt-BR") + " L";

      // atualiza variável CSS --nivel para mover o SVG verticalmente
      card.style.setProperty('--nivel', perc + '%');

      // ajustar cores das waves via style (opcional)
      const wave1 = card.querySelector('.wave-path.wave-1 path');
      const wave2 = card.querySelector('.wave-path.wave-2 path');
      if(wave1 && wave2){
        if(perc < 30){
          wave1.setAttribute('fill','#ff6b6b');
          wave2.setAttribute('fill','#ff8f66');
        } else if(perc < 70){
          wave1.setAttribute('fill','#f1c40f');
          wave2.setAttribute('fill','#f39c12');
        } else {
          wave1.setAttribute('fill','#2fa7ff');
          wave2.setAttribute('fill','#0066c5');
        }
      }

      // status
      if(perc < 30) card.dataset.status = "baixo";
      else if(perc < 70) card.dataset.status = "medio";
      else card.dataset.status = "alto";

      card.classList.remove("sem-dados");
      if(aviso) aviso.style.display = "none";
    });

    // pressões
    Object.keys(PRESSOES).forEach(key=>{
      const card = document.getElementById(key);
      if(!card) return;
      const el = card.querySelector(".percent");
      const v = dados[key];
      if(typeof v !== "number" || isNaN(v)) el.textContent = "-- bar";
      else el.textContent = v.toFixed(2) + " bar";
      card.classList.remove("sem-dados");
    });

    // última atualização
    const last = document.getElementById("lastUpdate");
    if(last){
      const dt = new Date(dados.timestamp || Date.now());
      last.textContent = "Última atualização: " + dt.toLocaleString("pt-BR");
      ultimaLeitura = Date.now();
    }

  }catch(err){
    console.error("Erro ao buscar leituras:",err);
    usarLocalSeExistir();
  }
}

function usarLocalSeExistir(){
  const { dados, ts } = carregarLocal();
  if(!dados) return;
  Object.keys(RESERVATORIOS).forEach(key=>{
    const card = document.getElementById(key);
    if(!card) return;
    const percentEl = card.querySelector(".percent");
    const litersEl = card.querySelector(".liters");
    const aviso = card.querySelector(".aviso-inativo");
    const valor = dados[key];
    if(typeof valor !== "number" || isNaN(valor)){
      percentEl.textContent = "--%"; litersEl.textContent="-- L";
      card.style.setProperty('--nivel','0%');
      card.classList.add("sem-dados");
      if(aviso) aviso.style.display="none";
      return;
    }
    const cfg = RESERVATORIOS[key];
    const perc = Math.round(Math.max(0, Math.min(100, (valor / cfg.capacidade) * 100)));
    percentEl.textContent = perc + "%";
    litersEl.textContent = valor.toLocaleString("pt-BR") + " L";
    card.style.setProperty('--nivel', perc + '%');

    // cores
    const wave1 = card.querySelector('.wave-path.wave-1 path');
    const wave2 = card.querySelector('.wave-path.wave-2 path');
    if(wave1 && wave2){
      if(perc < 30){ wave1.setAttribute('fill','#ff6b6b'); wave2.setAttribute('fill','#ff8f66'); }
      else if(perc < 70){ wave1.setAttribute('fill','#f1c40f'); wave2.setAttribute('fill','#f39c12'); }
      else { wave1.setAttribute('fill','#2fa7ff'); wave2.setAttribute('fill','#0066c5'); }
    }
    card.classList.remove("sem-dados");
    if(aviso) aviso.style.display="none";
  });

  Object.keys(PRESSOES).forEach(key=>{
    const card = document.getElementById(key);
    if(!card) return;
    const el = card.querySelector(".percent");
    const v = dados[key];
    el.textContent = (typeof v === 'number') ? v.toFixed(2)+" bar" : "-- bar";
    card.classList.remove("sem-dados");
  });

  const tsRaw = localStorage.getItem(LS_TIMESTAMP);
  if(tsRaw){
    const last = document.getElementById("lastUpdate");
    if(last){
      const dt = new Date(parseInt(tsRaw,10));
      last.textContent = "Última atualização: " + dt.toLocaleString("pt-BR");
      ultimaLeitura = parseInt(tsRaw,10);
    }
  }
}

// inatividade
setInterval(()=>{
  const diff = Date.now() - ultimaLeitura;
  document.querySelectorAll(".card.reservatorio").forEach(card=>{
    const aviso = card.querySelector(".aviso-inativo");
    if(diff > INACTIVITY_MS){
      if(aviso) aviso.style.display = "block";
      card.classList.add("sem-dados");
      // dessaturar waves
      const paths = card.querySelectorAll('.wave-path path');
      paths.forEach(p => p.setAttribute('fill','#cfcfcf'));
    } else {
      if(aviso) aviso.style.display = "none";
    }
  });
}, 5000);

// inicial
window.addEventListener("DOMContentLoaded", ()=>{
  criarCards();
  usarLocalSeExistir();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

window.abrirHistorico = function(reservatorioId){
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
