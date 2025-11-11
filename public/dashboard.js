// === dashboard.js ===
// URL da API
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // Atualização a cada 5 segundos

// === CONFIGURAÇÃO DOS SENSORES ===
const SENSORES = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    tipo: "nivel",
    capacidade: 20000,
    leituraVazio: 0.004168,
    leituraCheio: 0.008056,
    cardId: "cardElevador",
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    tipo: "nivel",
    capacidade: 200,
    leituraVazio: 0.00505,
    leituraCheio: 0.006693,
    cardId: "cardOsmose",
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    tipo: "nivel",
    capacidade: 1000,
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
    cardId: "cardCME",
  },
  Reservatorio_Abrandada_current: {
    nome: "Reservatório Água Abrandada",
    tipo: "nivel",
    capacidade: 9000,
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
    cardId: "cardAbrandada",
  },
  Pressao_Saida_Osmose_current: {
    nome: "Pressão Saída Osmose",
    tipo: "pressao",
    cardId: "cardPressaoSaida",
  },
  Pressao_Retorno_Osmose_current: {
    nome: "Pressão Retorno Osmose",
    tipo: "pressao",
    cardId: "cardPressaoRetorno",
  },
  Pressao_Saida_CME_current: {
    nome: "Pressão Saída CME",
    tipo: "pressao",
    cardId: "cardPressaoCME",
  },
};

// === FUNÇÃO DE CONVERSÃO ===
function converterParaLitros(sensorId, leitura) {
  const s = SENSORES[sensorId];
  if (!s || s.tipo !== "nivel" || leitura === undefined || leitura === null)
    return { litros: 0, porcentagem: 0 };

  const faixa = s.leituraCheio - s.leituraVazio;
  const valor = leitura - s.leituraVazio;
  let porcentagem = (valor / faixa) * 100;
  porcentagem = Math.max(0, Math.min(100, porcentagem));

  const litros = (porcentagem / 100) * s.capacidade;
  return { litros, porcentagem };
}

// === FUNÇÃO DE ATUALIZAÇÃO ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Falha ao obter dados");
    const dados = await res.json();

    document.getElementById("lastUpdate").textContent =
      "Última atualização: " +
      new Date(dados.timestamp).toLocaleTimeString("pt-BR");

    for (const [id, sensor] of Object.entries(SENSORES)) {
      const valor = dados[id];
      const card = document.getElementById(sensor.cardId);

      if (!card) continue;

      if (sensor.tipo === "nivel") {
        const { litros, porcentagem } = converterParaLitros(id, valor);
        atualizarCardNivel(card, litros, porcentagem);
      } else if (sensor.tipo === "pressao") {
        atualizarCardPressao(card, valor);
      }
    }
  } catch (err) {
    console.error("Erro ao atualizar leituras:", err);
    for (const sensor of Object.values(SENSORES)) {
      const card = document.getElementById(sensor.cardId);
      if (sensor.tipo === "nivel") atualizarCardNivel(card, 0, 0);
      else if (sensor.tipo === "pressao") atualizarCardPressao(card, 0);
    }
  }
}

// === ATUALIZA CARD DE NÍVEL COM BARRA CIRCULAR ===
function atualizarCardNivel(card, litros, porcentagem) {
  if (!card) return;

  const valorLitros = card.querySelector("p:nth-child(3)");
  const valorNivel = card.querySelector("p:nth-child(2)");

  valorLitros.textContent = `${litros.toFixed(0)} L`;
  valorNivel.textContent = `${porcentagem.toFixed(0)}%`;

  // Atualiza barra circular
  let barra = card.querySelector(".barra-circular");
  if (!barra) {
    barra = document.createElement("div");
    barra.classList.add("barra-circular");
    card.appendChild(barra);
  }

  const angulo = (porcentagem / 100) * 360;
  barra.style.background = `conic-gradient(#0080ff ${angulo}deg, #ddd ${angulo}deg)`;
}

// === ATUALIZA CARD DE PRESSÃO ===
function atualizarCardPressao(card, valor) {
  if (!card) return;
  const p = card.querySelector("p");
  p.textContent = `${(valor || 0).toFixed(2)} bar`;
}

// === FUNÇÃO HISTÓRICO ===
function abrirHistorico(reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
}
window.abrirHistorico = abrirHistorico;

// === INICIAR ATUALIZAÇÃO ===
atualizarLeituras();
setInterval(atualizarLeituras, UPDATE_INTERVAL);
