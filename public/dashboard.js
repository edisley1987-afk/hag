const API_URL = "/dados";
const UPDATE_MS = 4000;

// Configurações dos reservatórios
const CONFIG = {
  elevador: {
    capacidade: 20000,
    leituraVazio: 0.004168,
    leituraCheio: 0.008742,
    bar: "nivelElevadorBar",
    pct: "nivelElevador",
    lt: "litrosElevador",
    card: "cardElevador"
  },

  osmose: {
    capacidade: 200,
    leituraVazio: 0.00505,
    leituraCheio: 0.006492,
    bar: "nivelOsmoseBar",
    pct: "nivelOsmose",
    lt: "litrosOsmose",
    card: "cardOsmose"
  },

  cme: {
    capacidade: 1000,
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    bar: "nivelCMEBar",
    pct: "nivelCME",
    lt: "litrosCME",
    card: "cardCME"
  },

  abrandada: {
    capacidade: 9000,
    leituraVazio: 0.004048,
    leituraCheio: 0.006515,
    bar: "nivelAbrandadaBar",
    pct: "nivelAbrandada",
    lt: "litrosAbrandada",
    card: "cardAbrandada"
  }
};

// Pressões (só exibe valor)
let PRESSOES = {
  pressaoSaida: "pressaoSaida",
  pressaoRetorno: "pressaoRetorno",
  pressaoCME: "pressaoCME"
};

// FUNÇÃO PRINCIPAL
async function atualizar() {
  try {
    const resp = await fetch(API_URL);
    const dados = await resp.json();

    // Atualiza data/hora
    document.getElementById("lastUpdate").innerText =
      "Atualizado em: " + new Date().toLocaleTimeString("pt-BR");

    // Atualiza reservatórios
    Object.keys(CONFIG).forEach(key => {
      const sensor = "Reservatorio_" + key.charAt(0).toUpperCase() + key.slice(1) + "_current";
      const entrada = dados[sensor];

      if (!entrada) return;

      const valor = entrada.value;
      const cfg = CONFIG[key];

      let pct = ((valor - cfg.leituraVazio) /
                  (cfg.leituraCheio - cfg.leituraVazio)) * 100;

      pct = Math.max(0, Math.min(100, pct));

      const litros = (pct / 100) * cfg.capacidade;

      // Exibe
      document.getElementById(cfg.pct).innerText = pct.toFixed(0) + "%";
      document.getElementById(cfg.lt).innerText = litros.toFixed(0) + " L";

      // Anima barra
      const barra = document.getElementById(cfg.bar);
      barra.style.setProperty("--h", pct + "%");

      // Alerta < 30%
      const card = document.getElementById(cfg.card);
      if (pct <= 30) card.classList.add("alerta");
      else card.classList.remove("alerta");
    });

    // Atualiza pressões
    if (dados.Pressao_Saida_Osmose_current)
      document.getElementById("pressaoSaida").innerText =
        dados.Pressao_Saida_Osmose_current.value.toFixed(2) + " bar";

    if (dados.Pressao_Retorno_Osmose_current)
      document.getElementById("pressaoRetorno").innerText =
        dados.Pressao_Retorno_Osmose_current.value.toFixed(2) + " bar";

    if (dados.Pressao_Saida_CME_current)
      document.getElementById("pressaoCME").innerText =
        dados.Pressao_Saida_CME_current.value.toFixed(2) + " bar";

  } catch (erro) {
    console.error("Erro ao atualizar:", erro);
  }
}

setInterval(atualizar, UPDATE_MS);
atualizar();
