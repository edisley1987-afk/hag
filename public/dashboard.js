// ===== dashboard.js =====
// API retorna OBJETO com { chave: valor }

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// MAPA DE RESERVATÓRIOS E SUAS CAPACIDADES
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
    nome: "Reservatório Abrandada",
    capacidade: 9000
  }
};

// PRESSÕES
const PRESS_MAP = {
  Pressao_Saida_Osmose_current: "Pressão Saída (296)",
  Pressao_Retorno_Osmose_current: "Pressão Retorno (296)",
  Pressao_Saida_CME_current: "Pressão Saída CME"
};

// =======================================
// Atualização principal
// =======================================
async function atualizarValores() {
  try {
    const resp = await fetch(API_URL);
    const dados = await resp.json();   // <-- OBJETO

    if (typeof dados !== "object" || Array.isArray(dados)) {
      console.error("❌ ERRO: API deveria retornar OBJETO, mas retornou:", dados);
      return;
    }

    // Atualiza relógio
    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString("pt-BR");

    // Converte para pares [chave, valor]
    const entradas = Object.entries(dados);

    entradas.forEach(([id, valorBruto]) => {
      if (id === "timestamp") return; // ignora campo timestamp

      const valor = Number(valorBruto);

      // ===============================
      // RESERVATÓRIOS
      // ===============================
      if (RES_MAP[id]) {
        const cap = RES_MAP[id].capacidade;
        const perc = Math.min(100, Math.max(0, (valor / cap) * 100));

        const pctEl   = document.getElementById(`percent_${id}`);
        const litEl   = document.getElementById(`litros_${id}`);
        const nivelEl = document.getElementById(`nivel_${id}`);
        const alertaEl = document.getElementById(`alert_${id}`);
        const cardEl  = document.getElementById(`card_${id}`);

        if (pctEl) pctEl.textContent = perc.toFixed(0) + "%";
        if (litEl) litEl.textContent = valor + " L";
        if (nivelEl) nivelEl.style.height = perc + "%";

        // ALERTA visual
        if (perc <= 30) {
          if (alertaEl) alertaEl.style.display = "block";
          if (cardEl) cardEl.classList.add("alerta");
        } else {
          if (alertaEl) alertaEl.style.display = "none";
          if (cardEl) cardEl.classList.remove("alerta");
        }
      }

      // ===============================
      // PRESSÕES
      // ===============================
      if (PRESS_MAP[id]) {
        const presEl = document.getElementById(`pres_${id}`);
        if (presEl) presEl.textContent = valor.toFixed(2);
      }
    });

  } catch (e) {
    console.error("❌ Erro ao atualizar dashboard:", e);
  }
}

// Rodar imediatamente
atualizarValores();
setInterval(atualizarValores, UPDATE_INTERVAL);
