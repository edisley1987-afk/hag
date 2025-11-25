// ===== dashboard.js =====
// Leitura direta da rota /dados (backend retorna um objeto)

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// Mapeamento dos reservatórios visíveis no dashboard
const RES_MAP = {
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
  Reservatorio_Agua_Abrandada_current: {
    nome: "Água Abrandada",
    capacidade: 9000
  }
};

// Mapeamento das pressões
const PRESS_MAP = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

// Atualização dos valores
async function atualizarValores() {
  try {
    const resp = await fetch(API_URL);
    const dados = await resp.json();

    if (!dados || typeof dados !== "object") {
      console.error("Formato inesperado:", dados);
      return;
    }

    // Atualiza relógio
    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString("pt-BR");

    // ========================================
    // RESERVATÓRIOS
    // ========================================
    Object.entries(RES_MAP).forEach(([id, info]) => {
      const valor = Number(dados[id] || 0); // pega direto do objeto
      const cap = info.capacidade;

      const perc = Math.min(100, Math.max(0, (valor / cap) * 100));

      const pctEl = document.getElementById(`percent_${id}`);
      const litEl = document.getElementById(`litros_${id}`);
      const nivelEl = document.getElementById(`nivel_${id}`);
      const alertaEl = document.getElementById(`alert_${id}`);
      const cardEl = document.getElementById(`card_${id}`);

      if (!pctEl) return; // card ainda não carregado

      pctEl.textContent = perc.toFixed(0) + "%";
      litEl.textContent = valor + " L";
      nivelEl.style.height = perc + "%";

      // ALERTA
      if (perc <= 30) {
        alertaEl.style.display = "block";
        cardEl.classList.add("alerta");
      } else {
        alertaEl.style.display = "none";
        cardEl.classList.remove("alerta");
      }
    });

    // ========================================
    // PRESSÕES
    // ========================================
    Object.entries(PRESS_MAP).forEach(([id, nome]) => {
      const valor = Number(dados[id] || 0);
      const presEl = document.getElementById(`pres_${id}`);
      if (presEl) presEl.textContent = valor.toFixed(2);
    });

  } catch (e) {
    console.error("Erro ao atualizar dashboard:", e);
  }
}

// Chamada inicial
atualizarValores();
setInterval(atualizarValores, UPDATE_INTERVAL);
