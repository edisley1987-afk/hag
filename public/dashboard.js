// ===== dashboard.js =====
// Leitura simples direto da rota /dados (modelo antigo)

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// IDs usados no HTML atual
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
  Abrandada_current: {
    nome: "Água Abrandada",
    capacidade: 9000
  }
};

const PRESS_MAP = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

// Atualização
async function atualizarValores() {
  try {
    const resp = await fetch(API_URL);
    const dados = await resp.json();

    // Atualizar relógio
    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString("pt-BR");

    // Loop nos dados brutos vindo do servidor
    dados.forEach(r => {
      const id = r.ref;
      const valor = Number(r.value);

      // ===============================
      // RESERVATÓRIOS
      // ===============================
      if (RES_MAP[id]) {
        const cap = RES_MAP[id].capacidade;
        const perc = Math.min(100, Math.max(0, (valor / cap) * 100));

        const pctEl = document.getElementById(`percent_${id}`);
        const litEl = document.getElementById(`litros_${id}`);
        const nivelEl = document.getElementById(`nivel_${id}`);
        const alertaEl = document.getElementById(`alert_${id}`);
        const cardEl = document.getElementById(`card_${id}`);

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
      }

      // ===============================
      // PRESSÕES
      // ===============================
      if (PRESS_MAP[id]) {
        const presEl = document.getElementById(`pres_${id}`);
        presEl.textContent = valor.toFixed(2);
      }
    });

  } catch (e) {
    console.error("Erro ao atualizar dashboard:", e);
  }
}

atualizarValores();
setInterval(atualizarValores, UPDATE_INTERVAL);
