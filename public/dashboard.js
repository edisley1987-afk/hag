// === Dashboard.js ===
// Atualiza leituras em tempo real, converte valores em litros e %
// e ajusta as cores/níveis dinamicamente.

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // atualização a cada 5s

// === Configuração dos reservatórios (calibração e capacidade) ===
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
    nome: "Água Abrandada",
    capacidade: 9000,
    leituraVazio: 0.004008,
    leituraCheio: 0.004929,
  },
};

// === Função para calcular litros e percentual ===
function calcularLitros(leitura, config) {
  if (typeof leitura !== "number" || leitura <= 0) return { litros: 0, percentual: 0 };

  const { leituraVazio, leituraCheio, capacidade } = config;
  const faixa = leituraCheio - leituraVazio;
  const posicao = leitura - leituraVazio;
  let percentual = (posicao / faixa) * 100;

  percentual = Math.max(0, Math.min(100, percentual)); // limitar de 0 a 100%
  const litros = (percentual / 100) * capacidade;

  return { litros, percentual };
}

// === Atualiza card de reservatório ===
function atualizarCard(id, leitura) {
  const config = RESERVATORIOS[id];
  if (!config) return;

  const nomeId = config.nome.split(" ")[1];
  const litrosElem = document.getElementById(`litros${nomeId}`);
  const percElem = document.getElementById(`nivel${nomeId}`);
  const barElem = document.getElementById(`nivel${nomeId}Bar`);
  const cardElem = document.getElementById(`card${nomeId}`);

  const { litros, percentual } = calcularLitros(leitura, config);

  litrosElem.textContent = `${litros.toFixed(0)} L`;
  percElem.textContent = `${percentual.toFixed(0)}%`;

  // Atualiza barra lateral
  if (barElem) barElem.style.height = `${percentual}%`;

  // Define a cor conforme o nível
  let cor = "#3aa374";
  if (percentual < 20) cor = "#ff3b3b"; // vermelho
  else if (percentual < 50) cor = "#ffb347"; // laranja
  else if (percentual < 80) cor = "#5cb85c"; // verde
  else cor = "#007bff"; // azul (cheio)

  cardElem.style.borderLeftColor = cor;
  if (barElem) barElem.style.background = cor;
}

// === Atualiza valores de pressão (formato bar) ===
function atualizarPressao(idElem, valor) {
  const elem = document.getElementById(idElem);
  if (!elem) return;

  // Conversão opcional se valor vier como leitura bruta (exemplo: 0.006 -> 1.20 bar)
  const pressaoBar = valor > 0.02 ? valor : valor * 200; // converte se for sinal analógico
  elem.textContent = pressaoBar ? `${pressaoBar.toFixed(2)} bar` : "0.00 bar";
}

// === Atualiza horário da última atualização ===
function atualizarHorario() {
  const agora = new Date();
  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + agora.toLocaleTimeString("pt-BR");
}

// === Atualiza todos os dados do dashboard ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Falha na requisição");
    const dados = await res.json();

    // Atualiza reservatórios
    for (const id in RESERVATORIOS) {
      const leitura = dados[id];
      atualizarCard(id, leitura);
    }

    // Atualiza pressões (com nomes variados de chave)
    atualizarPressao("pressaoSaida", dados.Pressao_Saida_Osmose || dados.Pressao_saida_current);
    atualizarPressao("pressaoRetorno", dados.Pressao_Retorno_Osmose_current || dados.Pressao_Retorno_current);
    atualizarPressao("pressaoCME", dados.Pressao_Saida_CME_current || dados.Pressao_Saida_current);

    atualizarHorario();
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
    for (const id in RESERVATORIOS) atualizarCard(id, 0);
  }
}

// === Botão de histórico (placeholder) ===
function abrirHistorico(nome) {
  window.location.href = `historico.html?reservatorio=${nome}`;
}

// === Início automático ===
setInterval(atualizarLeituras, UPDATE_INTERVAL);
atualizarLeituras();
