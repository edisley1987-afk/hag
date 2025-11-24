// =========================
// Configuração Geral
// =========================
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

const RESERVATORIOS = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_CME_current:      { nome: "Reservatório CME",       capacidade: 5000 },
  Reservatorio_Osmose_current:   { nome: "Reservatório Osmose",    capacidade: 200 }
};

// =========================
// Funções de manutenção
// =========================
function isEmManutencao(id) {
  return localStorage.getItem("manut_" + id) === "1";
}

function setManutencao(id, valor) {
  localStorage.setItem("manut_" + id, valor ? "1" : "0");
}

// =========================
// Criar cards na interface
// =========================
function criarCards() {
  const cardsRow = document.getElementById("cardsRow");
  cardsRow.innerHTML = "";

  Object.entries(RESERVATORIOS).forEach(([id, cfg]) => {
    const card = document.createElement("div");
    card.className = "card-tanque";
    card.id = id;

    card.innerHTML = `
      <h3>${cfg.nome}</h3>
      <div class="nivel">
        <div class="nivel-barra" id="barra_${id}"></div>
      </div>

      <p class="litros" id="litros_${id}">-- L</p>

      <p class="alerta-msg" style="color:#e74c3c; font-weight:bold; display:none;">
        ⚠ Nível abaixo de 30%!
      </p>

      <p class="manut-msg" style="color:#3498db; font-weight:bold; display:none;">
        🔧 Em manutenção
      </p>
    `;

    // Botão oculto de manutenção
    const btn = document.createElement("button");
    btn.className = "manut-btn";
    btn.style.display = "none";
    btn.innerHTML = "Marcar Manutenção";

    btn.onclick = () => {
      const atual = isEmManutencao(id);
      setManutencao(id, !atual);
      btn.innerHTML = !atual ? "Em manutenção" : "Marcar Manutenção";
    };

    // Alternar botão com clique direito
    card.oncontextmenu = (e) => {
      e.preventDefault();
      btn.style.display = btn.style.display === "none" ? "block" : "none";
    };

    card.appendChild(btn);
    cardsRow.appendChild(card);
  });
}

// =========================
// Atualiza leituras com o JSON do servidor
// =========================
function atualizarReservatorios(dados) {
  let criticos = [];

  Object.entries(RESERVATORIOS).forEach(([id, cfg]) => {
    const nivel = dados[id];
    if (!nivel && nivel !== 0) return;

    const perc = Math.min(100, Math.max(0, (nivel / cfg.capacidade) * 100));

    const card = document.getElementById(id);
    const barra = document.getElementById("barra_" + id);
    const litros = document.getElementById("litros_" + id);
    const alertaMsg = card.querySelector(".alerta-msg");
    const manutMsg = card.querySelector(".manut-msg");

    litros.textContent = `${nivel} L`;
    barra.style.height = perc + "%";

    // ======== MANUTENÇÃO ========
    if (isEmManutencao(id)) {
      alertaMsg.style.display = "none";
      manutMsg.style.display = "block";

      barra.style.background = "gray";
      card.dataset.status = "manutencao";
      return;
    }
    manutMsg.style.display = "none";

    // ======== ALERTAS ========
    if (perc < 30) {
      alertaMsg.style.display = "block";
      barra.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
      criticos.push(cfg.nome);
      card.dataset.status = "baixo";
    } else if (perc < 70) {
      alertaMsg.style.display = "none";
      barra.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
      card.dataset.status = "medio";
    } else {
      alertaMsg.style.display = "none";
      barra.style.background = "linear-gradient(to top, #3498db, #2ecc71)";
      card.dataset.status = "alto";
    }
  });

  atualizarAlertaGlobal(criticos);
}

// =========================
// Alerta global (rodapé)
// =========================
function atualizarAlertaGlobal(lista) {
  const alertBox = document.getElementById("globalAlert");
  const criticalList = document.getElementById("criticalList");

  if (lista.length === 0) {
    alertBox.style.display = "none";
    criticalList.innerHTML = "";
    return;
  }

  alertBox.style.display = "block";
  criticalList.textContent = lista.join(", ");
}

// =========================
// Requisição ao servidor
// =========================
async function atualizarDashboard() {
  try {
    const res = await fetch(API_URL);
    const dados = await res.json();

    // Exibe timestamp
    if (dados.timestamp) {
      document.getElementById("lastUpdate").textContent =
        "Última atualização: " + new Date(dados.timestamp).toLocaleString("pt-BR");
    }

    atualizarReservatorios(dados);

  } catch (err) {
    console.error("Erro ao atualizar dashboard:", err);
  }
}

// =========================
// Inicialização
// =========================
document.getElementById("btnBack").onclick = () => history.back();
document.getElementById("btnHistorico").onclick = () => location.href = "historico.html";

criarCards();
atualizarDashboard();
setInterval(atualizarDashboard, UPDATE_INTERVAL);
