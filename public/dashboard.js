// ===== dashboard.js =====
// Exibe leituras em tempo real com nível visual (caixa d'água)

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

let ultimaLeitura = 0;

// Configuração dos reservatórios (em litros)
const RESERVATORIOS = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    capacidade: 20000
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    capacidade: 200
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    capacidade: 1000
  },
  Abrandada_current: {
    nome: "Água Abrandada",
    capacidade: 9000
  }
};

// Configuração das pressões
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

// Salva manutenção aplicada pelo usuário
let manutencao = JSON.parse(localStorage.getItem("manutencaoReservatorios") || "{}");

// ========= CRIA OS CARDS =========
function criarCards() {
  const containerRes = document.getElementById("reservatoriosContainer");
  const containerPres = document.getElementById("pressoesContainer");

  // Criar cards de reservatórios
  Object.entries(RESERVATORIOS).forEach(([id, info]) => {
    const div = document.createElement("div");
    div.className = "card reservatorio-card";
    div.id = `card_${id}`;
    div.innerHTML = `
      <h3>${info.nome}</h3>

      <div class="nivel-container">
        <div class="nivel-agua" id="nivel_${id}">
          <span id="percent_${id}">--%</span>
          <small id="litros_${id}">-- L</small>
        </div>
      </div>

      <label class="manut-check">
        <input type="checkbox" id="man_${id}" ${manutencao[id] ? "checked" : ""}> Em manutenção
      </label>

      <p id="alert_${id}" class="alerta-msg" style="display:none;">⚠ Nível abaixo de 30%</p>

      <p class="capacidade" id="${id}_cap">Capacidade: ${info.capacidade} L</p>

      <button class="btn-historico" onclick="abrirHistorico('${id}')">Ver histórico</button>
    `;

    containerRes.appendChild(div);

    document.getElementById(`man_${id}`).addEventListener("change", e => {
      manutencao[id] = e.target.checked;
      localStorage.setItem("manutencaoReservatorios", JSON.stringify(manutencao));
    });
  });

  // Criar cards de pressões
  Object.entries(PRESSOES).forEach(([id, nome]) => {
    const div = document.createElement("div");
    div.className = "card pressao-card";
    div.id = `card_${id}`;
    div.innerHTML = `
      <h3>${nome}</h3>
      <p><span id="pres_${id}">--</span> <small>bar</small></p>
    `;
    containerPres.appendChild(div);
  });
}

// ========= ATUALIZA OS VALORES =========
async function atualizarValores() {
  try {
    const resposta = await fetch(API_URL);
    const dados = await resposta.json();

    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString();

    // 👉 CORRIGIDO: agora percorre um OBJETO
    Object.keys(dados).forEach(ref => {
      const r = dados[ref];
      if (!r) return;

      const id = r.ref;

      // ==============================
      // TRATAMENTO DA CAPACIDADE
      // ==============================
      let capacidade = r.capacidade;

      if (capacidade == null) {
        const capTxt = document.getElementById(`${id}_cap`)?.textContent || "";
        const num = capTxt.replace(/\D+/g, "");
        capacidade = num ? Number(num) : null;
      }

      if (!capacidade) return;

      // Reservatórios
      if (RESERVATORIOS[id]) {
        const litros = Number(r.value || 0);
        const perc = Math.min(100, Math.max(0, (litros / capacidade) * 100));

        document.getElementById(`percent_${id}`).textContent = perc.toFixed(0) + "%";
        document.getElementById(`litros_${id}`).textContent = litros + " L";

        const nivelDiv = document.getElementById(`nivel_${id}`);
        nivelDiv.style.height = perc + "%";

        // ====== ALERTA E CORES ======
        const card = document.getElementById(`card_${id}`);
        const alerta = document.getElementById(`alert_${id}`);
        const emManutencao = manutencao[id] === true;

        if (perc <= 30 && !emManutencao) {
          card.classList.add("alerta");
          alerta.style.display = "block";
        } else {
          card.classList.remove("alerta");
          alerta.style.display = "none";
        }

        // Cor dinâmica
        if (perc <= 30) nivelDiv.style.background = "#e63946";
        else if (perc <= 60) nivelDiv.style.background = "#f1c40f";
        else nivelDiv.style.background = "linear-gradient(to top, #3498db, #6dd5fa)";
      }

      // Pressões
      if (PRESSOES[id]) {
        document.getElementById(`pres_${id}`).textContent = Number(r.value).toFixed(2);
      }
    });
  } catch (err) {
    console.error("Erro ao atualizar:", err);
  }
}

// ========= HISTÓRICO =========
function abrirHistorico(id) {
  location.href = `historico.html?reservatorio=${id}`;
}

// ========= INICIALIZA =========
criarCards();
atualizarValores();
setInterval(atualizarValores, UPDATE_INTERVAL);
