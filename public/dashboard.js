const API = "/api/dashboard"; // <<< URL ACERTADA
let cache = JSON.parse(localStorage.getItem("DATA_CACHE")) || {};
let tempoLigada = JSON.parse(localStorage.getItem("TEMPO_BOMBAS")) || {};
let tempoDesligada = JSON.parse(localStorage.getItem("TEMPO_DESLIGADAS")) || {};
let ultimaMudanca = JSON.parse(localStorage.getItem("ULTIMA_MUDANCA")) || {};
let ultimoEstado = JSON.parse(localStorage.getItem("ULTIMO_ESTADO")) || {};
let ultimoCiclo = JSON.parse(localStorage.getItem("ULTIMO_CICLO")) || {};

async function atualizar() {
  try {
    const r = await fetch(API, { cache: "no-store" });
    if (!r.ok) throw 0;
    const dados = await r.json();
    cache = dados;
    localStorage.setItem("DATA_CACHE", JSON.stringify(dados));
    processarBombas(dados.bombas);
    render(dados);
    document.getElementById("lastUpdate").textContent = "Atualizado " + new Date().toLocaleTimeString();
  } catch {
    console.warn("Sem atualização, usando valores armazenados.");
    processarBombas(cache.bombas || []);
    render(cache);
    document.getElementById("lastUpdate").textContent = "SEM SINAL — exibindo última leitura";
  }
}

setInterval(atualizar, 5000);
atualizar();

/* =================== RENDER =================== */
function render(d) {
  if (!d) return;
  renderReservatorios(d.reservatorios);
  renderPressao(d.pressoes);
  renderBombas(d.bombas);
}

/* RESERVATÓRIOS */
function renderReservatorios(lista) {
  const box = document.getElementById("reservatoriosContainer");
  box.innerHTML = "";
  lista.forEach(r => {
    const card = document.createElement("div");
    card.className = "card-reservatorio";
    if (r.percent <= 30) card.classList.add("nv-critico");
    else if (r.percent <= 60) card.classList.add("nv-alerta");
    else if (r.percent <= 90) card.classList.add("nv-normal");
    else card.classList.add("nv-cheio");

    card.innerHTML = `
      <h3>${r.nome}</h3>
      <div class="tanque-visu">
        <div class="nivel-agua" style="height:${r.percent}%"></div>
        <div class="overlay-info">
          <div class="percent-text">${r.percent}%</div>
          <div class="liters-text">${r.current_liters} L</div>
        </div>
      </div>
      <button onclick="abrirHistorico('${r.setor}')" style="width:100%;padding:9px;border:none;border-radius:8px; background:#0f7a5b;color:white;font-weight:bold;margin-top:10px;"> 📊 Histórico </button>
      <p style="margin-top:8px;font-size:13px;color:#ccc"> Capacidade: ${r.capacidade} L </p>
    `;
    box.appendChild(card);
  });
}

function abrirHistorico(x) {
  location.href = `/historico.html?setor=${x}`;
}

/* ====================== PRESSÕES — Atualizar valores nos cards existentes ====================== */
function renderPressao(lista) {
  console.log("Dados de pressão recebidos:", lista);

  const pressaoMap = {
    "Presao_Saida_current": "pSaidaOsmose",
    "Presao_Retorno_current": "pRetornoOsmose",
    "Presao_Saida_CME_current": "pSaidaCME"
  };

  lista.forEach(p => {
    const idElement = pressaoMap[p.ref];
    if (idElement) {
      const element = document.getElementById(idElement);
      if (element) {
        // Supondo que o valor vem em p.valor_raw para pressão
        const valor = p.valor_raw;
        element.innerHTML = valor !== undefined ? parseFloat(valor).toFixed(2) : "--";
      } else {
        console.error(`Elemento #${idElement} não encontrado para ${p.ref}`);
      }
    } else {
      console.warn(`Referência ${p.ref} não mapeada para pressão`);
    }
  });
}

/* ===================== BOMBAS ===================== */
function normalizarEstado(estado) {
  if (!estado) return "";
  return estado.toString().trim().toUpperCase();
}

function processarBombas(bombas) {
  bombas.forEach(b => {
    const nome = b.nome;
    const estadoAtual = normalizarEstado(b.estado);
    const agora = Date.now();

    if (!(nome in tempoLigada)) tempoLigada[nome] = 0;
    if (!(nome in tempoDesligada)) tempoDesligada[nome] = 0;
    if (!(nome in ultimaMudanca)) ultimaMudanca[nome] = agora;
    if (!(nome in ultimoEstado)) ultimoEstado[nome] = estadoAtual;
    if (!(nome in ultimoCiclo)) ultimoCiclo[nome] = { ligado: 0, desligado: 0 };

    const passou = (agora - ultimaMudanca[nome]) / 1000;

    if (estadoAtual !== ultimoEstado[nome]) {
      if (ultimoEstado[nome] === "LIGADA") {
        ultimoCiclo[nome].ligado = passou;
      } else {
        ultimoCiclo[nome].desligado = passou;
      }
      ultimoEstado[nome] = estadoAtual;
      ultimaMudanca[nome] = agora;
    }

    if (estadoAtual === "LIGADA") {
      tempoLigada[nome] += passou;
    } else {
      tempoDesligada[nome] += passou;
    }

    ultimaMudanca[nome] = agora;
  });

  localStorage.setItem("TEMPO_BOMBAS", JSON.stringify(tempoLigada));
  localStorage.setItem("TEMPO_DESLIGADAS", JSON.stringify(tempoDesligada));
  localStorage.setItem("ULTIMA_MUDANCA", JSON.stringify(ultimaMudanca));
  localStorage.setItem("ULTIMO_ESTADO", JSON.stringify(ultimoEstado));
  localStorage.setItem("ULTIMO_CICLO", JSON.stringify(ultimoCiclo));
}

/* ====================== BOMBAS — Renderizar cards ====================== */
function renderBombas(lista) {
  const box = document.getElementById("pressaoBombaGrid"); // Mesmo grid de pressão e bomba

  const ciclos = lista.map(b => b.ciclo);
  const alertaCiclos = !ciclos.every(v => v === ciclos[0]);
