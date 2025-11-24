// =============================
// dashboard.js — final (reservatorios na 1ª linha, pressões na 2ª linha)
// =============================
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos
let ultimaLeitura = 0;

// Nomes esperados (o servidor envia com _current)
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

// localStorage keys (persistência)
const LS_KEY = "dashboard_last";
const LS_TIMESTAMP = "dashboard_last_ts";

function salvarLocal(dados) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(dados));
    localStorage.setItem(LS_TIMESTAMP, Date.now().toString());
  } catch(e){ console.warn("Erro salvando localStorage", e); }
}
function carregarLocal(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    const tsRaw = localStorage.getItem(LS_TIMESTAMP);
    const ts = tsRaw ? parseInt(tsRaw,10) : null;
    if(!raw) return { dados:null, ts };
    return { dados: JSON.parse(raw), ts };
  } catch(e){ return { dados:null, ts:null }; }
}

// cria cards separados: reservatorios (1ª linha) e pressões (2ª linha)
function criarCards(){
  const rContainer = document.getElementById("reservatoriosContainer");
  const pContainer = document.getElementById("pressoesContainer");
  rContainer.innerHTML = "";
  pContainer.innerHTML = "";

  // reservatorios
  Object.keys(RESERVATORIOS).forEach(id => {
    const cfg = RESERVATORIOS[id];
    const card = document.createElement("div");
    card.className = "card reservatorio sem-dados";
    card.id = id;
    card.innerHTML = `
      <div class="aviso-inativo">⚠ Sem atualização há mais de 10 minutos</div>
      <div class="nivel"><div class="wave" style="height:0%"></div></div>
      <h3>${cfg.nome}</h3>
      <div class="percent">--%</div>
      <div class="liters">-- L</div>
      <button class="btn-hist" onclick="abrirHistorico('${id.replace('_current','')}')">Ver Histórico</button>
    `;
    rContainer.appendChild(card);
  });

  // pressões
  Object.keys(PRESSOES).forEach(id => {
    const nome = PRESSOES[id];
    const card = document.createElement("div");
    card.className = "card pressao sem-dados";
    card.id = id;
    card.innerHTML = `
      <h3>${nome}</h3>
      <div class="percent">-- bar</div>
    `;
    pContainer.appendChild(card);
  });
}

// atualiza leituras (fetch)
async function atualizarLeituras(){
  try {
    const r = await fetch(API_URL + "?t=" + Date.now());
    const dados = await r.json();
    if(!dados) {
      usarLocalSeExistir();
      return;
    }

    ultimaLeitura = Date.now();
    salvarLocal(dados);

    // reservatorios
    Object.keys(RESERVATORIOS).forEach(key => {
      const cfg = RESERVATORIOS[key];
      const card = document.getElementById(key);
      if(!card) return;

      const percentEl = card.querySelector(".percent");
      const litersEl = card.querySelector(".liters");
      const wave = card.querySelector(".wave");
      const aviso = card.querySelector(".aviso-inativo");

      const valor = dados[key];

      if(typeof valor !== "number" || isNaN(valor)){
        percentEl.textContent = "--%";
        litersEl.textContent = "-- L";
        if(wave) wave.style.height = "0%";
        card.classList.add("sem-dados");
        if(aviso) aviso.style.display = "none";
        return;
      }

      const perc = Math.round(Math.max(0, Math.min(100, (valor / cfg.capacidade) * 100)));
      percentEl.textContent = perc + "%";
      litersEl.textContent = valor.toLocaleString("pt-BR") + " L";
      if(wave) wave.style.height = perc + "%";

      // cor
      if(wave){
        if(perc < 30) wave.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
        else if(perc < 70) wave.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
        else wave.style.background = "linear-gradient(to top, #3498db, #2ecc71)";
      }

      // status de borda
      if(perc < 30) card.dataset.status = "baixo";
      else if(perc < 70) card.dataset.status = "medio";
      else card.dataset.status = "alto";

      card.classList.remove("sem-dados");
      if(aviso) aviso.style.display = "none";
    });

    // pressões
    Object.keys(PRESSOES).forEach(key => {
      const card = document.getElementById(key);
      if(!card) return;
      const el = card.querySelector(".percent");
      const v = dados[key];
      if(typeof v !== "number" || isNaN(v)) el.textContent = "-- bar";
      else el.textContent = v.toFixed(2) + " bar";
      card.classList.remove("sem-dados");
    });

    // última atualização (usa timestamp do servidor se disponível)
    const last = document.getElementById("lastUpdate");
    if(last){
      const dt = new Date(dados.timestamp || Date.now());
      last.textContent = "Última atualização: " + dt.toLocaleString("pt-BR");
    }

  } catch(err){
    console.error("Erro ao buscar leituras:", err);
    usarLocalSeExistir();
  }
}

// usar cache local se houver (popula cards)
function usarLocalSeExistir(){
  const { dados, ts } = carregarLocal();
  if(!dados) return;

  Object.keys(RESERVATORIOS).forEach(key=>{
    const card = document.getElementById(key);
    if(!card) return;
    const percentEl = card.querySelector(".percent");
    const litersEl = card.querySelector(".liters");
    const wave = card.querySelector(".wave");
    const aviso = card.querySelector(".aviso-inativo");

    const valor = dados[key];
    if(typeof valor !== "number" || isNaN(valor)){
      percentEl.textContent = "--%"; litersEl.textContent = "-- L"; if(wave) wave.style.height='0%';
      card.classList.add("sem-dados");
      if(aviso) aviso.style.display = "none";
      return;
    }

    const cfg = RESERVATORIOS[key];
    const perc = Math.round(Math.max(0, Math.min(100, (valor / cfg.capacidade) * 100)));
    percentEl.textContent = perc + "%";
    litersEl.textContent = valor.toLocaleString("pt-BR") + " L";
    if(wave) wave.style.height = perc + "%";

    if(wave){
      if(perc < 30) wave.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
      else if(perc < 70) wave.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
      else wave.style.background = "linear-gradient(to top, #3498db, #2ecc71)";
    }

    card.classList.remove("sem-dados");
    if(aviso) aviso.style.display = "none";
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

// monitor de inatividade (mostra aviso e estiliza)
setInterval(()=>{
  const diff = Date.now() - ultimaLeitura;
  document.querySelectorAll(".card.reservatorio").forEach(card=>{
    const aviso = card.querySelector(".aviso-inativo");
    if(diff > INACTIVITY_MS){
      if(aviso) aviso.style.display = "block";
      card.classList.add("sem-dados");
      const wave = card.querySelector(".wave");
      if(wave) wave.style.background = "linear-gradient(to top, #cfcfcf, #e6e6e6)";
    } else {
      if(aviso) aviso.style.display = "none";
    }
  });
}, 5000);

// inicialização
window.addEventListener("DOMContentLoaded", ()=>{
  criarCards();
  usarLocalSeExistir();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

// abrir histórico (envia nome sem _current)
window.abrirHistorico = function(reservatorioId){
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
