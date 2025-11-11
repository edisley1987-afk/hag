// === dashboard.js ===
// URL da API
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// Configuração dos reservatórios
const RESERVATORIOS = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    capacidade: 20000,
    leituraVazio: 0.004168,
    leituraCheio: 0.008056,
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    capacidade: 200,
    leituraVazio: 0.00505,
    leituraCheio: 0.006693,
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    capacidade: 1000,
    leituraVazio: 0.004088,
    leituraCheio: 0.004408,
  },
  Reservatorio_Agua_Abrandada_current: {
    nome: "Reservatório Água Abrandada",
    capacidade: 9000,
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
  },
};

// Função auxiliar: normaliza o nome das chaves recebidas
function normalizarNome(chave) {
  return chave
    .replace(/Pressao_saida_current/i, "Pressao_Saida_Osmose_current")
    .replace(/Pressao_Saida_current/i, "Pressao_Saida_CME_current")
    .replace(/Pressao_Retorno_current/i, "Pressao_Retorno_Osmose_current")
    .replace(/Reservatorio_Agua_Abrandada_current/i, "Reservatorio_Agua_Abrandada_current");
}

// Função para calcular litros e porcentagem
function calcularNivel(leitura, conf) {
  if (!leitura || leitura <= 0) return { litros: 0, porcentagem: 0 };
  const { leituraVazio, leituraCheio, capacidade } = conf;
  let nivel = (leitura - leituraVazio) / (leituraCheio - leituraVazio);
  nivel = Math.max(0, Math.min(1, nivel)); // limita entre 0% e 100%
  const litros = Math.round(nivel * capacidade);
  const porcentagem = (nivel * 100).toFixed(1);
  return { litros, porcentagem };
}

// Atualiza os cards de reservatórios
function atualizarCardNivel(id, leitura) {
  const conf = RESERVATORIOS[id];
  if (!conf) return;

  const card = document.querySelector(`#card_${id}`);
  if (!card) return;

  const nivelElem = card.querySelector(".nivel");
  const litrosElem = card.querySelector(".litros");
  const barra = card.querySelector(".nivel-barra");

  const { litros, porcentagem } = calcularNivel(leitura, conf);

  nivelElem.textContent = `${porcentagem}%`;
  litrosElem.textContent = `${litros.toLocaleString()} L`;

  // Atualiza cor da borda/barra conforme o nível
  let cor = "#28a745"; // verde
  if (porcentagem < 30) cor = "#dc3545"; // vermelho
  else if (porcentagem < 60) cor = "#ffc107"; // amarelo

  barra.style.height = `${porcentagem}%`;
  barra.style.background = cor;
}

// Atualiza as pressões
function atualizarCardPressao(id, valor) {
  const card = document.querySelector(`#card_${id}`);
  if (!card) return;

  const valorElem = card.querySelector(".pressao");
  valorElem.textContent = valor ? valor.toFixed(2) + " bar" : "-- bar";
}

// Função principal: buscar dados do servidor
async function atualizarLeituras() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    // Atualiza data/hora
    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleTimeString();

    // Atualiza reservatórios
    Object.keys(RESERVATORIOS).forEach((id) => {
      const keyServidor = Object.keys(data).find((k) =>
        normalizarNome(k).includes(id)
      );
      const leitura = keyServidor ? data[keyServidor] : null;
      atualizarCardNivel(id, leitura);
    });

    // Atualiza pressões
    atualizarCardPressao("Pressao_Saida_Osmose", data.Pressao_saida_current);
    atualizarCardPressao("Pressao_Retorno_Osmose", data.Pressao_Retorno_current);
    atualizarCardPressao("Pressao_Saida_CME", data.Pressao_Saida_current);
  } catch (err) {
    console.error("Erro ao atualizar leituras:", err);
  }
}

// Atualização automática
setInterval(atualizarLeituras, UPDATE_INTERVAL);
atualizarLeituras();

// Função do botão “Ver histórico”
function abrirHistorico(reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
}
window.abrirHistorico = abrirHistorico;
