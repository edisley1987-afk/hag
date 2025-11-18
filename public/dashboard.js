// ===== dashboard.js =====
// Atualizações: mantém última leitura, exibe barra vertical, alarme em nível crítico,
// persistência de manutenção em localStorage, mensagem global no rodapé.
// Espera os valores já convertidos (litros para reservatórios, bar para pressões) no /dados.

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // 5s
const INATIVITY_MS = 10 * 60 * 1000; // 10 minutos
const ALARM_INTERVAL_MS = 10000; // bip a cada 10s

let ultimaLeitura = 0;
let ultimoDadosValidos = {};
let alarmando = false;
let alarmTimer = null;
let audioBip = null;
let manutencoes = {}; // { id:true } persisted

// === configuração dos sensores (nomes dos campos que o servidor retorna) ===
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 }
};

const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

const ALL_KEYS = [...Object.keys(RESERVATORIOS), ...Object.keys(PRESSOES)];

// === persistência das manutenções ===
function carregarManutencoes() {
  try {
    const raw = localStorage.getItem("manutencoes_hag");
    if (raw) manutencoes = JSON.parse(raw);
  } catch { manutencoes = {}; }
}
function salvarManutencoes() {
  localStorage.setItem("manutencoes_hag", JSON.stringify(manutencoes));
}

// === som de bip ===
function tocarBipOnce() {
  try {
    if (!audioBip) audioBip = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audioBip.currentTime = 0;
    audioBip.play().catch(()=>{ /* autoplay may be blocked */ });
  } catch {}
}

function startAlarm() {
  if (alarmando) return;
  alarmando = true;
  tocarBipOnce();
  alarmTimer = setInterval(() => {
    if (!alarmando) clearInterval(alarmTimer);
    else tocarBipOnce();
  }, ALARM_INTERVAL_MS);
  document.getElementById("globalAlert").style.display = "inline-block";
}

function stopAlarm() {
  alarmando = false;
  if (alarmTimer) clearInterval(alarmTimer);
  document.getElementById("globalAlert").style.display = "none";
}

// === criação dos cards ===
function criarCards() {
  const container = document.getElementById("cardsRow");
  container.innerHTML = "";

  // reservatórios
  Object.entries(RESERVATORIOS).forEach(([id, cfg]) => {
    const card = document.createElement("div");
    card.className = "card reservatorio no-data";
    card.id = id;

    card.innerHTML = `
      <div class="maint-toggle" title="Marcar / remover manutenção">🛠</div>
      <div class="maint-badge">EM MANUTENÇÃO</div>
      <div class="title">${cfg.nome}</div>
      <div class="fill-wrap">
        <div class="vertical-fill" style="height:0%; background:#2ecc71;"></div>
      </div>
      <div class="percent-large">--%</div>
      <div class="liters">0 L</div>
      <div class="aviso-inatividade">⚠ Sem atualização há mais de 10 minutos!</div>
    `;
    container.appendChild(card);

    // toggle manutenção clicável
    const toggle = card.querySelector(".maint-toggle");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const currently = !!manutencoes[id];
      if (currently) delete manutencoes[id];
      else manutencoes[id] = true;
      salvarManutencoes();
      aplicarManutencaoVisual(id);
      // ao marcar manutenção paramos alarme (se estava)
      if (manutencoes[id]) stopAlarm();
    });
  });

  // pressões
  Object.entries(PRESSOES).forEach(([id, nome]) => {
    const card = document.createElement("div");
    card.className = "card pressao no-data";
    card.id = id;
    card.innerHTML = `
      <div class="title">${nome}</div>
      <div class="fill-wrap"></div>
      <div class="percent-large">-- bar</div>
      <div class="liters">&nbsp;</div>
      <div class="aviso-inatividade">⚠ Sem atualização há mais de 10 minutos!</div>
    `;
    container.appendChild(card);
  });
}

// aplicar visual de manutenção
function aplicarManutencaoVisual(id) {
  const card = document.getElementById(id);
  if (!card) return;
  const badge = card.querySelector(".maint-badge");
  if (manutencoes[id]) {
    badge.style.display = "block";
    badge.textContent = "EM MANUTENÇÃO";
  } else {
    badge.style.display = "none";
  }
}

// === atualizar dados na tela ===
function atualizarDisplay(dados) {
  // atualiza tempo
  const last = document.getElementById("lastUpdate");
  const ts = dados.timestamp ? new Date(dados.timestamp) : new Date();
  last.textContent = "Última atualização: " + ts.toLocaleString("pt-BR");
  ultimaLeitura = Date.now();

  // percorre reservatórios
  let algumCritico = false;

  Object.entries(RESERVATORIOS).forEach(([id, cfg]) => {
    const card = document.getElementById(id);
    const valor = dados[id];

    if (!card) return;
    const fillEl = card.querySelector(".vertical-fill");
    const percEl = card.querySelector(".percent-large");
    const litrosEl = card.querySelector(".liters");
    const aviso = card.querySelector(".aviso-inatividade");

    if (typeof valor !== "number" || isNaN(valor)) {
      card.classList.add("no-data");
      percEl.textContent = "--%";
      litrosEl.textContent = "0 L";
      if (fillEl) fillEl.style.height = "0%";
      return;
    }

    // guarda ultima leitura válida
    ultimoDadosValidos[id] = valor;

    // calcula percentual
    const perc = Math.min(100, Math.max(0, (valor / cfg.capacidade) * 100));
    const roundPerc = Math.round(perc);

    // cores: verde (>70), amarelo (30-70), vermelho (<=30)
    let cor;
    if (perc <= 30) cor = "#e74c3c";
    else if (perc < 70) cor = "#f1c40f";
    else cor = "#2ecc71";

    card.classList.remove("no-data");
    percEl.textContent = `${roundPerc}%`;
    litrosEl.textContent = `${valor.toLocaleString()} L`;

    // vertical fill: altura em %
    if (fillEl) {
      fillEl.style.height = perc + "%";
      fillEl.style.background = cor;
    }

    // manutenção visual
    aplicarManutencaoVisual(id);

    // aviso inatividade esconde quando dados chegam
    if (aviso) aviso.style.display = "none";

    // critico?
    if (perc <= 30 && !manutencoes[id]) {
      algumCritico = true;
    }
  });

  // pressões
  Object.keys(PRESSOES).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const valor = dados[id];
    const percEl = card.querySelector(".percent-large");
    const aviso = card.querySelector(".aviso-inatividade");

    if (typeof valor !== "number" || isNaN(valor)) {
      card.classList.add("no-data");
      percEl.textContent = "-- bar";
      if (aviso) aviso.style.display = "none";
      return;
    }

    ultimoDadosValidos[id] = valor;
    card.classList.remove("no-data");
    percEl.textContent = `${valor.toFixed(2)} bar`;
    if (aviso) aviso.style.display = "none";
  });

  // alarmes e footer alerta
  if (algumCritico) startAlarm();
  else stopAlarm();
}

// === usar cache local (mantém ultimoDadosValidos) ===
function usarCacheSeNecessario() {
  // se temos dados salvos em ultimoDadosValidos, aplica eles no display
  const dados = {...ultimoDadosValidos};
  if (!Object.keys(dados).length) return;
  dados.timestamp = new Date().toISOString();
  atualizarDisplay(dados);
}

// === busca de dados ===
async function buscarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("Falha ao buscar");
    const dados = await res.json();

    // se o endpoint devolve um objeto com timestamp e chaves, usamos direto
    if (dados && typeof dados === "object" && Object.keys(dados).length > 0) {
      // para a lógica de inatividade, atualizar ultimaLeitura aqui
      ultimaLeitura = Date.now();
      // atualizamos ultimoDadosValidos com qualquer leitura numérica
      Object.keys(dados).forEach(k=>{
        if (ALL_KEYS.includes(k) && typeof dados[k] === "number") {
          ultimoDadosValidos[k] = dados[k];
        }
      });
      // repassa o objeto original (para timestamp)
      atualizarDisplay(dados);
      return;
    }
    // fallback: manter o que já temos
    usarCacheSeNecessario();
  } catch (err) {
    // console.warn("Erro ao buscar dados", err);
    // exibir cache (se houver)
    usarCacheSeNecessario();
  }
}

// === verificação de inatividade (10 minutos) ===
function verificarInatividade() {
  const now = Date.now();
  if (!ultimaLeitura || (now - ultimaLeitura) > INATIVITY_MS) {
    // marcar cards como sem dados e exibir mensagem
    document.querySelectorAll(".card").forEach(card=>{
      card.classList.add("no-data");
      // exibe aviso inatividade
      const aviso = card.querySelector(".aviso-inatividade");
      if (aviso) aviso.style.display = "block";
      // não limpa os valores exibidos; mantemos a última leitura válida (se houver)
      const id = card.id;
      if (ultimoDadosValidos[id] !== undefined) {
        if (RESERVATORIOS[id]) {
          const perc = Math.round((ultimoDadosValidos[id] / RESERVATORIOS[id].capacidade)*100);
          card.querySelector(".percent-large").textContent = `${perc}%`;
          card.querySelector(".liters").textContent = `${ultimoDadosValidos[id].toLocaleString()} L`;
          const fillEl = card.querySelector(".vertical-fill");
          if (fillEl) {
            fillEl.style.height = Math.max(0, Math.min(100, (ultimoDadosValidos[id]/RESERVATORIOS[id].capacidade)*100)) + "%";
          }
        } else {
          // pressão
          card.querySelector(".percent-large").textContent = `${Number(ultimoDadosValidos[id]).toFixed(2)} bar`;
        }
      } else {
        // sem leitura válida
        if (card.querySelector(".percent-large")) card.querySelector(".percent-large").textContent = "--%";
        if (card.querySelector(".liters")) card.querySelector(".liters").textContent = "0 L";
      }
    });

    // ao inatividade, pausa alarme (não queremos alarmar enquanto offline)
    stopAlarm();
  } else {
    // remover aviso inatividade
    document.querySelectorAll(".card .aviso-inatividade").forEach(el => el.style.display = "none");
  }
}

// === inicialização ===
window.addEventListener("DOMContentLoaded", () => {
  carregarManutencoes();
  criarCards();

  // aplicar manutenção persistida
  Object.keys(manutencoes).forEach(id=>aplicarManutencaoVisual(id));

  // botões topo
  document.getElementById("btnBack").addEventListener("click", ()=> window.history.back());
  document.getElementById("btnHistorico").addEventListener("click", ()=> window.location.href = "historico.html");

  // primeira busca
  buscarDados();
  setInterval(buscarDados, UPDATE_INTERVAL);
  setInterval(verificarInatividade, 8000);
});

