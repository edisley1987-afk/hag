// === dashboard.js ===
const API_URL = "/api/dashboard";

let ultimoTimestamp = null;
let alertaTimeoutAtivo = false;

/* ============================================================
   TABELA OFICIAL DE RESERVATÓRIOS (LEITURA MIN / MAX)
   ============================================================ */
const RESERVATORIOS_CFG = {
  "ELEVADOR": {
    capacidade: 20000,
    min: 0.004168,
    max: 0.008742
  },
  "OSMOSE": {
    capacidade: 200,
    min: 0.00505,
    max: 0.006492
  },
  "CME": {
    capacidade: 1000,
    min: 0.004088,
    max: 0.004408
  },
  "ABRANDADA": {
    capacidade: 9000,
    min: 0.004048,
    max: 0.006515
  }
};

/* ============================================================
   LISTA OFICIAL DE PRESSÕES
   ============================================================ */
const PRESSOES_CFG = {
  "Pressao_Saida_CME": "PRESSÃO CME - SAÍDA",
  "Pressao_Saida_Osmose": "PRESSÃO OSMOSE - SAÍDA",
  "Pressao_Retorno_Osmose": "PRESSÃO OSMOSE - RETORNO"
};

/* ============================================================
    FUNÇÃO PRINCIPAL DO FETCH
   ============================================================ */
async function carregarDados() {
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const raw = await resp.json();

    const data = transformarDados(raw);

    if (data.lastUpdate) {
      ultimoTimestamp = Date.now();
      alertaTimeoutAtivo = false;
    }

    criarCards(data);
    atualizarReservatorios(data);
    atualizarPressao(data);
    atualizarTimestamp(data.lastUpdate);

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

/* ============================================================
    TRANSFORMA O JSON DO SERVIDOR
   ============================================================ */
function transformarDados(raw) {
  const reservatorios = [];
  const pressoes = [];

  // --- RESERVATÓRIOS ---
  for (const nome in RESERVATORIOS_CFG) {
    const chave = `Reservatorio_${nome}_current`;

    if (raw[chave] !== undefined) {
      const cfg = RESERVATORIOS_CFG[nome];
      const valorSensor = raw[chave];

      const percent = calcularPercent(valorSensor, cfg.min, cfg.max);

      reservatorios.push({
        setor: nome,
        percent,
        litros: Math.round((percent / 100) * cfg.capacidade),
        manutencao: false
      });
    }
  }

  // --- PRESSÕES ---
  for (const chave in PRESSOES_CFG) {
    if (raw[chave + "_current"] !== undefined) {
      pressoes.push({
        nome: PRESCOES_CFG[chave],
        valor: raw[chave + "_current"]
      });
    }
  }

  return {
    reservatorios,
    pressoes,
    lastUpdate: raw.timestamp
  };
}

/* ============================================================
    CALCULA % USANDO MIN/MAX REAL
   ============================================================ */
function calcularPercent(valor, min, max) {
  const p = ((valor - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, Math.round(p)));
}

/* ============================================================
    CRIA TODOS OS CARDS AUTOMATICAMENTE
   ============================================================ */
function criarCards(data) {
  const contRes = document.getElementById("reservatoriosContainer");
  const contPres = document.getElementById("pressoesContainer");

  contRes.innerHTML = "";
  contPres.innerHTML = "";

  // --- RESERVATÓRIOS ---
  data.reservatorios.forEach((r) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.setor = r.setor;

    card.innerHTML = `
      <div class="nivel">
        <svg class="wave-svg" viewBox="0 0 500 150">
          <path d="M0 49 C 150 150, 350 0, 500 49 L500 150 L0 150 Z"/>
        </svg>
      </div>

      <div class="conteudo">
        <h3>${r.setor}</h3>
        <div class="percent">--%</div>
        <div class="liters">-- L</div>
      </div>
    `;

    contRes.appendChild(card);
  });

  // --- PRESSÕES ---
  data.pressoes.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card-pressao";
    card.dataset.nome = p.nome;

    card.innerHTML = `
      <h3>${p.nome}</h3>
      <div class="valor-pressao">--</div>
    `;

    contPres.appendChild(card);
  });
}

/* ============================================================
    ATUALIZA RESERVATÓRIOS (COM ONDA)
   ============================================================ */
function atualizarReservatorios(data) {
  document.querySelectorAll(".card").forEach((card) => {
    const setor = card.dataset.setor;
    const r = data.reservatorios.find(x => x.setor === setor);
    if (!r) return;

    const percent = r.percent;
    const litros = r.litros;

    card.querySelector(".percent").textContent = percent + "%";
    card.querySelector(".liters").textContent = litros + " L";
    card.querySelector(".nivel").style.height = percent + "%";

    // Remove todas as classes e adiciona a correta
    card.classList.remove("alta", "media", "baixa");

    if (percent >= 70) card.classList.add("alta");
    else if (percent >= 40) card.classList.add("media");
    else card.classList.add("baixa");

    // atraso
    if (alertaTimeoutAtivo) {
      card.classList.add("alerta-piscando");
    } else {
      card.classList.remove("alerta-piscando");
    }
  });
}

/* ============================================================
    ATUALIZA PRESSÕES
   ============================================================ */
function atualizarPressao(data) {
  document.querySelectorAll(".card-pressao").forEach((card) => {
    const nome = card.dataset.nome;
    const pres = data.pressoes.find(x => x.nome === nome);
    if (!pres) return;

    card.querySelector(".valor-pressao").textContent =
      pres.valor.toFixed(3) + " bar";

    // atraso
    if (alertaTimeoutAtivo) {
      card.classList.add("alerta-piscando");
    } else {
      card.classList.remove("alerta-piscando");
    }
  });
}

/* ============================================================
    ATUALIZA TIMER NA TELA
   ============================================================ */
function atualizarTimestamp(ms) {
  const el = document.getElementById("lastUpdate");
  if (!ms) {
    el.textContent = "Última atualização: --";
    return;
  }

  const dt = new Date(ms);
  el.textContent = "Última atualização: " + dt.toLocaleTimeString("pt-BR");
}

/* ============================================================
    CONTADOR DE ATRASO > 10s
   ============================================================ */
setInterval(() => {
  if (!ultimoTimestamp) return;
  if (Date.now() - ultimoTimestamp >= 10000 && !alertaTimeoutAtivo) {
    alertaTimeoutAtivo = true;
  }
}, 1000);

/* ============================================================
    ATUALIZA A CADA 5s
   ============================================================ */
setInterval(carregarDados, 5000);
carregarDados();
