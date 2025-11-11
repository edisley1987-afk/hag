// === Dashboard.js ===
// Atualiza leituras em tempo real, converte valores em litros e %
// e ajusta as cores/níveis dinamicamente.

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // atualização a cada 5s

// === Configurações de cada reservatório ===
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

// === Função para calcular litros ===
function calcularLitros(leitura, config) {
  if (!leitura || leitura <= 0) return 0;

  const { leituraVazio, leituraCheio, capacidade } = config;
  const faixa = leituraCheio - leituraVazio;
  const posicao = leitura - leituraVazio;
  let percentual = (posicao / faixa) * 100;

  percentual = Math.max(0, Math.min(100, percentual)); // limita entre 0 e 100
  const litros = (percentual / 100) * capacidade;
  return { litros, percentual };
}

// === Atualiza um card com os dados ===
function atualizarCard(id, leitura) {
  const config = RESERVATORIOS[id];
  const litrosElem = document.getElementById(`litros${config.nome.split(" ")[1]}`);
  const percElem = document.getElementById(`nivel${config.nome.split(" ")[1]}`);
  const barElem = document.getElementById(`nivel${config.nome.split(" ")[1]}Bar`);
  const cardElem = document.getElementById(`card${config.nome.split(" ")[1]}`);

  if (!config || !litrosElem || !percElem) return;

  const { litros, percentual } = calcularLitros(leitura, config);

  litrosElem.textContent = `${litros.toFixed(0)} L`;
  percElem.textContent = `${percentual.toFixed(0)}%`;

  // Atualiza barra lateral
  if (barElem) barElem.style.height = `${percentual}%`;

  // Muda a cor da lateral conforme nível
  let cor = "#3aa374";
  if (percentual < 20) cor = "#ff3b3b"; // vermelho
  else if (percentual < 50) cor = "#ffb347"; // laranja
  else if (percentual < 80) cor = "#5cb85c"; // verde médio
  else cor = "#007bff"; // cheio (azul)

  cardElem.style.borderLeftColor = cor;
  if (barElem) barElem.style.background = cor;
}

// === Atualiza pressão ===
function atualizarPressao(idElem, valor) {
  const elem = document.getElementById(idElem);
  if (elem) elem.textContent = valor ? `${valor.toFixed(3)} bar` : "-- bar";
}

// === Atualiza o horário da última atualização ===
function atualizarHorario() {
  const agora = new Date();
  document.getElementById("lastUpdate").textContent =
    "Última atualização: " + agora.toLocaleTimeString("pt-BR");
}

// === Requisição de dados ===
async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Falha na requisição");
    const dados = await res.json();

    // Atualiza cada reservatório
    for (const id in RESERVATORIOS) {
      const leitura = dados[id];
      atualizarCard(id, leitura);
    }

    // Atualiza pressões
    atualizarPressao("pressaoSaida", dados.Pressao_saida_current || dados.Pressao_Saida_current);
    atualizarPressao("pressaoRetorno", dados.Pressao_Retorno_current);
    atualizarPressao("pressaoCME", dados.Pressao_Saida_current || 0);

    atualizarHorario();
  } catch (e) {
    console.error("Erro ao buscar dados:", e);
    for (const id in RESERVATORIOS) atualizarCard(id, 0);
  }
}

// === Botão de histórico (exemplo futuro) ===
function abrirHistorico(nome) {
  alert(`(Em breve) Histórico de leituras de ${RESERVATORIOS[nome]?.nome || nome}`);
}

// === Inicialização ===
setInterval(atualizarLeituras, UPDATE_INTERVAL);
atualizarLeituras();
