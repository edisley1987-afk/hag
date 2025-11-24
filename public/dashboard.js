// =============================
// dashboard.js — Glassmorphism + waves
// =============================
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // 5s
let ultimaLeitura = 0;

// configuracao (nomes e capacidades)
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current:   { nome: "Reservatório Osmose",   capacidade: 200 },
  Reservatorio_CME_current:      { nome: "Reservatório CME",      capacidade: 1000 },
  Abrandada_current:             { nome: "Água Abrandada",        capacidade: 9000 }
};

const PRESSOES = {
  Pressao_Saida_Osmose_current:  "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current:"Pressão Retorno Osmose",
  Pressao_Saida_CME_current:     "Pressão Saída CME"
};


// cria cards
function criarCards(){
  const container = document.getElementById("cardsContainer");
  container.innerHTML = "";

  // Reservatorios
  Object.keys(RESERVATORIOS).forEach(id=>{
    const cfg = RESERVATORIOS[id];
    const card = document.createElement("article");
    card.className = "card reservatorio sem-dados";
    card.id = id;

    card.innerHTML = `
      <div class="tank" aria-hidden="true">
        <div class="water" style="height:0%">
          <div class="wave"></div>
          <div class="wave wave2"></div>
        </div>
      </div>

      <h3>${cfg.nome}</h3>
      <div class="percent">--%</div>
      <div class="liters">-- L</div>

      <button class="btn-hist" type="button" onclick="abrirHistorico('${id.replace('_current','')}')">Ver Histórico</button>
    `;
    container.appendChild(card);
  });

  // Pressoes
  Object.keys(PRESSOES).forEach(id=>{
    const nome = PRESSOES[id];
    const card = document.createElement("article");
    card.className = "card pressao";
    card.id = id;
    card.innerHTML = `
      <div>
        <h3>${nome}</h3>
        <div class="percent">-- bar</div>
      </div>
    `;
    container.appendChild(card);
  });
}


// busca leituras e atualiza UI
async function atualizarLeituras(){
  try{
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();
    if(!dados) return;
    ultimaLeitura = Date.now();

    // atualizar reservatorios
    Object.keys(RESERVATORIOS).forEach(key=>{
      const cfg = RESERVATORIOS[key];
      const card = document.getElementById(key);
      if(!card) return;

      // o servidor pode enviar com nome exato ou sem _current, tente ambas
      let valor = dados[key];
      if (typeof valor === "undefined") {
        const alt = key.replace('_current','');
        valor = dados[alt];
      }

      const percentEl = card.querySelector(".percent");
      const litersEl = card.querySelector(".liters");
      const water = card.querySelector(".water");

      if (typeof valor !== "number" || isNaN(valor)) {
        percentEl.textContent = "--%";
        litersEl.textContent = "-- L";
        water.style.height = "0%";
        card.classList.add("sem-dados");
        card.removeAttribute("data-status");
        return;
      }

      const perc = Math.round(Math.max(0, Math.min(100, (valor / cfg.capacidade) * 100)));
      percentEl.textContent = perc + "%";
      litersEl.textContent = valor.toLocaleString("pt-BR") + " L";
      water.style.height = perc + "%";

      // cores
      if (perc < 30) {
        water.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
      } else if (perc < 70) {
        water.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
      } else {
        water.style.background = "linear-gradient(to top, #2ecc71, #3498db)";
      }

      // status attribute (css may change shadow)
      if (perc < 30) card.dataset.status = "baixo";
      else if (perc < 70) card.dataset.status = "medio";
      else card.dataset.status = "alto";

      card.classList.remove("sem-dados");
    });

    // atualizar pressões
    Object.keys(PRESSOES).forEach(key=>{
      const card = document.getElementById(key);
      if(!card) return;

      let v = dados[key];
      if (typeof v === "undefined") {
        const alt = key.replace('_current','');
        v = dados[alt];
      }
      const el = card.querySelector(".percent");
      if (typeof v !== "number" || isNaN(v)) el.textContent = "-- bar";
      else el.textContent = v.toFixed(2) + " bar";
    });

    // ultima atualizacao
    const last = document.getElementById("lastUpdate");
    if(last){
      const dt = new Date(dados.timestamp || Date.now());
      last.textContent = "Última atualização: " + dt.toLocaleString("pt-BR");
    }
  }catch(err){
    console.error("Erro ao buscar leituras:", err);
  }
}

// fallback — quando sem atualização por X tempo
setInterval(()=>{
  const diff = Date.now() - ultimaLeitura;
  if(diff > 4 * 60 * 1000){ // 4min sem dados
    document.querySelectorAll(".card.reservatorio").forEach(c=>{
      c.querySelector(".percent").textContent = "--%";
      c.querySelector(".liters").textContent = "-- L";
      const w = c.querySelector(".water"); if(w) w.style.height = "0%";
      c.classList.add("sem-dados");
    });
  }
}, 10000);


// init
window.addEventListener("DOMContentLoaded", ()=>{
  criarCards();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

// abrir histórico
window.abrirHistorico = function(reservatorioId){
  // envia sem _current (compatível com historic)
  window.location.href = `historico.html?reservatorio=${encodeURIComponent(reservatorioId)}`;
};
