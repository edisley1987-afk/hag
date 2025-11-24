// === dashboard.js (versão compatível com HTML antigo e novo) ===
// Atualiza: alerta interno <30%, botão Manutenção (localStorage), inatividade

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
const INATIVITY_MS = 10 * 60 * 1000; // 10 min

// Configuração dos reservatórios (capacidade e nomes)
const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
  Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 }
};

// Pressões (apenas exibidas)
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

let ultimaLeitura = 0;

// --- Helpers manutenção (localStorage por reservatório) ---
function estaEmManutencao(id) {
  return localStorage.getItem("manut_" + id) === "1";
}
function setManutencao(id, valor) {
  localStorage.setItem("manut_" + id, valor ? "1" : "0");
}

// --- Garantir container compatível (aceita #cardsRow, .cards-container ou .cards-row) ---
function getCardsContainer() {
  return document.getElementById("cardsRow")
    || document.querySelector(".cards-container")
    || document.querySelector(".cards-row")
    || null;
}

// --- Cria cards dinamicamente se necessário ---
function criarCardsSeNecessario() {
  const container = getCardsContainer();
  if (!container) return;

  // Se já tem cards (pelo menos um card com id de reservatorio) não recria
  const tem = Object.keys(RESERVATORIOS).some(id => document.getElementById(id));
  if (tem) return;

  // cria cards dos reservatórios
  Object.keys(RESERVATORIOS).forEach(id => {
    const cfg = RESERVATORIOS[id];

    const card = document.createElement("div");
    card.className = "card";
    card.id = id;

    // estrutura interna compatível com CSS existente
    card.innerHTML = `
      <div class="fill" style="height:0%; background: linear-gradient(to top, #3498db, #2ecc71);"></div>
      <div class="content">
        <div class="title">${cfg.nome}</div>
        <div class="percent-large">--%</div>
        <div class="liters">0 L</div>

        <div class="alerta-interno" style="display:none; margin-top:8px; font-weight:700; color:#c0392b;">⚠ Nível abaixo de 30%</div>

        <div class="manutencao-area" style="margin-top:8px; display:flex; flex-direction:column; gap:6px; width:100%;">
          <button class="btn-menu histórico-btn" style="width:120px; margin:0 auto;" onclick="abrirHistorico('${id}')">Ver Histórico</button>
          <button class="btn-manut" style="display:none; width:120px; margin:0 auto;">Marcar Manutenção</button>
          <div class="manut-badge" style="display:none; text-align:center; font-weight:700; color:#8e44ad;">🔧 Em manutenção</div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // cria cards de pressões
  Object.keys(PRESSOES).forEach(id => {
    const card = document.createElement("div");
    card.className = "card pressao";
    card.id = id;

    card.innerHTML = `
      <div class="content">
        <div class="title">${PRESSOES[id]}</div>
        <div class="percent-large">-- bar</div>
      </div>
    `;

    container.appendChild(card);
  });

  // adicionar listeners de manutenção (delegação simples)
  Object.keys(RESERVATORIOS).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const btn = card.querySelector(".btn-manut");
    btn.onclick = () => {
      const atual = estaEmManutencao(id);
      setManutencao(id, !atual);
      // atualiza visual imediatamente
      atualizarLeituras(); 
    };

    // Para expor botão de manutenção rapidamente: clique com o botão direito abre/fecha (como sugerido antes)
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      btn.style.display = (btn.style.display === "none" || btn.style.display === "") ? "block" : "none";
    });
  });
}

// --- Atualiza leituras (principal) ---
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();
    if (!dados || Object.keys(dados).length === 0) return;

    ultimaLeitura = Date.now();

    // cria cards se necessário (caso HTML antigo tenha sido usado)
    criarCardsSeNecessario();

    // Atualiza reservatórios
    Object.entries(RESERVATORIOS).forEach(([id, conf]) => {
      const card = document.getElementById(id);
      if (!card) return;

      const valor = dados[id];
      const percentEl = card.querySelector(".percent-large");
      const litrosEl = card.querySelector(".liters");
      const fill = card.querySelector(".fill");
      const alertaInterno = card.querySelector(".alerta-interno");
      const btnManut = card.querySelector(".btn-manut");
      const badgeManut = card.querySelector(".manut-badge");

      if (!fill || !percentEl || !litrosEl) return;

      // Se valor não numérico -> sem dados
      if (typeof valor !== "number" || isNaN(valor)) {
        percentEl.innerHTML = "--%";
        litrosEl.innerHTML = "0 L";
        fill.style.height = "0%";
        fill.style.background = "linear-gradient(to top, #cccccc, #eeeeee)";
        alertaInterno.style.display = "none";
        btnManut.style.display = "none";
        badgeManut.style.display = "none";
        card.classList.remove("critico");
        return;
      }

      // calcula porcentagem
      const perc = Math.min(100, Math.max(0, (valor / conf.capacidade) * 100));
      percentEl.innerHTML = perc.toFixed(0) + "%";
      litrosEl.innerHTML = valor.toLocaleString() + " L";
      fill.style.height = perc + "%";

      // cor do preenchimento
      if (perc < 30) {
        fill.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
      } else if (perc < 70) {
        fill.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
      } else {
        fill.style.background = "linear-gradient(to top, #3498db, #2ecc71)";
      }

      // botão e badge manutenção: botão só aparece quando <=30%
      const emManut = estaEmManutencao(id);
      if (perc <= 30) {
        btnManut.style.display = "block";
        if (!emManut) {
          alertaInterno.style.display = "block";
          badgeManut.style.display = "none";
          card.classList.add("critico");
        } else {
          // está em manutenção: alerta não aparece
          alertaInterno.style.display = "none";
          badgeManut.style.display = "block";
          card.classList.remove("critico");
          fill.style.background = "linear-gradient(to top, #bdc3c7, #95a5a6)"; // cinza suave
        }
      } else {
        // acima de 30%: ocultar botão e alertas; limpar manutenção se estava marcada
        btnManut.style.display = "none";
        alertaInterno.style.display = "none";
        badgeManut.style.display = "none";
        card.classList.remove("critico");

        if (emManut) {
          setManutencao(id, false);
        }
      }
    });

    // Atualiza pressões
    Object.keys(PRESSOES).forEach(id => {
      const card = document.getElementById(id);
      if (!card) return;
      const el = card.querySelector(".percent-large");
      const valor = dados[id];
      if (typeof valor !== "number") {
        el.innerHTML = "-- bar";
      } else {
        el.innerHTML = valor.toFixed(2) + " bar";
      }
    });

    // Atualiza texto da última atualização (se o servidor retornar timestamp)
    const last = document.getElementById("lastUpdate") || document.getElementById("lastUpdateText");
    if (last) {
      const dt = new Date(dados.timestamp || Date.now());
      last.innerHTML = "Última atualização: " + dt.toLocaleString("pt-BR");
    }

    // Atualiza alerta global (lista críticos)
    atualizarAlertaGlobal();

  } catch (err) {
    console.error("Erro ao buscar leituras:", err);
  }
}

// --- Atualiza alerta global com lista de reservatorios críticos ---
function atualizarAlertaGlobal() {
  const criticalList = [];
  Object.keys(RESERVATORIOS).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const percText = card.querySelector(".percent-large")?.textContent || "";
    const perc = parseInt(percText);
    if (!isNaN(perc) && perc <= 30 && !estaEmManutencao(id)) {
      criticalList.push(RESERVATORIOS[id].nome);
    }
  });

  const alertBox = document.getElementById("globalAlert");
  const critEl = document.getElementById("criticalList");
  if (!alertBox || !critEl) return;

  if (criticalList.length > 0) {
    alertBox.style.display = "block";
    critEl.textContent = criticalList.join(", ");
  } else {
    alertBox.style.display = "none";
    critEl.textContent = "";
  }
}

// --- Monitor inatividade: se sem atualização por INATIVITY_MS mostrar aviso dentro do card --- 
setInterval(() => {
  const agora = Date.now();
  const diff = agora - ultimaLeitura;

  Object.keys(RESERVATORIOS).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const aviso = card.querySelector(".aviso-inatividade");
    if (!aviso) {
      // cria aviso (se ainda não existir)
      const a = document.createElement("div");
      a.className = "aviso-inatividade";
      a.textContent = "⚠ Sem atualização há mais de 10 minutos";
      card.querySelector(".content").appendChild(a);
    }
  });

  // mostra ou oculta avisos
  document.querySelectorAll(".card").forEach(card => {
    const a = card.querySelector(".aviso-inatividade");
    if (!a) return;
    a.style.display = (diff > INATIVITY_MS && !estaEmManutencao(card.id)) ? "block" : "none";
  });

}, 10000);

// --- Inicialização ---
window.addEventListener("DOMContentLoaded", () => {
  criarCardsSeNecessario();
  atualizarLeituras();
  setInterval(atualizarLeituras, UPDATE_INTERVAL);
});

// --- Abrir histórico (global) ---
window.abrirHistorico = function (reservatorioId) {
  // mapping: se quiser trocar nomes amigáveis, faça aqui
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
