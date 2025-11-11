// === dashboard.js ===
// Versão: 11/11/2025 — Mantém último valor válido e atualiza automaticamente

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // Atualiza a cada 5 segundos
const TIMEOUT_LEITURA = 600000; // 10 minutos de tolerância (em ms)
let ultimoDadoValido = null;
let ultimaAtualizacao = 0;

// === Configuração dos sensores ===
const SENSORES = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    capacidade: 20000,
    tipo: "nivel",
    cardId: "card-elevador",
    valorId: "valor-elevador",
    percentId: "percent-elevador",
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    capacidade: 200,
    tipo: "nivel",
    cardId: "card-osmose",
    valorId: "valor-osmose",
    percentId: "percent-osmose",
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    capacidade: 1000,
    tipo: "nivel",
    cardId: "card-cme",
    valorId: "valor-cme",
    percentId: "percent-cme",
  },
  Reservatorio_Agua_Abrandada_current: {
    nome: "Água Abrandada",
    capacidade: 9000,
    tipo: "nivel",
    cardId: "card-ablandada",
    valorId: "valor-ablandada",
    percentId: "percent-ablandada",
  },
  Pressao_Saida_current: {
    nome: "Pressão Saída Osmose",
    tipo: "pressao",
    cardId: "card-psaida-osm",
    valorId: "valor-psaida-osm",
  },
  Pressao_Retorno_current: {
    nome: "Pressão Retorno Osmose",
    tipo: "pressao",
    cardId: "card-pretorno-osm",
    valorId: "valor-pretorno-osm",
  },
  Pressao_saida_current: {
    nome: "Pressão Saída CME",
    tipo: "pressao",
    cardId: "card-psaida-cme",
    valorId: "valor-psaida-cme",
  },
};

// === Função principal: busca dados do servidor ===
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    const dados = await res.json();

    // Se o servidor retornou dados válidos
    if (dados && Object.keys(dados).length > 0) {
      ultimoDadoValido = dados;
      ultimaAtualizacao = Date.now();
      atualizarDashboard(dados);
    } else {
      verificarTimeout();
    }
  } catch (e) {
    console.warn("⚠ Falha ao buscar dados. Mantendo última leitura válida.");
    verificarTimeout();
  }
}

// === Verifica se o tempo sem atualização excede o limite ===
function verificarTimeout() {
  const tempoSemAtualizar = Date.now() - ultimaAtualizacao;
  if (tempoSemAtualizar > TIMEOUT_LEITURA) {
    console.warn("⏱ Nenhuma leitura há muito tempo. Zerar valores.");
    atualizarDashboard(null);
  } else if (ultimoDadoValido) {
    atualizarDashboard(ultimoDadoValido);
  }
}

// === Atualiza todos os cards ===
function atualizarDashboard(dados) {
  Object.entries(SENSORES).forEach(([chave, cfg]) => {
    const cardEl = document.getElementById(cfg.cardId);
    if (!cardEl) return;

    let valor = dados ? dados[chave] : null;
    let textoPrincipal = "--";
    let textoSecundario = "--";
    let cor = "#3aa374";
    let nivel = 0;

    // === Reservatórios ===
    if (cfg.tipo === "nivel") {
      if (valor != null && valor > 0) {
        const porcentagem = Math.min(100, Math.max(0, (valor / cfg.capacidade) * 100));
        textoPrincipal = `${porcentagem.toFixed(1)}%`;
        textoSecundario = `${valor.toFixed(0)} L`;
        nivel = porcentagem;

        // Cores por faixa de nível
        if (porcentagem < 30) cor = "#e53935"; // vermelho
        else if (porcentagem < 60) cor = "#fbc02d"; // amarelo
        else cor = "#43a047"; // verde
      } else {
        textoPrincipal = "0%";
        textoSecundario = "0 L";
        nivel = 0;
        cor = "#999";
      }
    }

    // === Pressões ===
    else if (cfg.tipo === "pressao") {
      if (valor != null && valor > 0) {
        textoPrincipal = `${valor.toFixed(3)} bar`;
        cor = valor < 0.004 ? "#e53935" : "#43a047";
      } else {
        textoPrincipal = "0.000 bar";
        cor = "#999";
      }
    }

    // === Atualiza elementos ===
    cardEl.style.setProperty("--cor-nivel", cor);
    cardEl.style.setProperty("--nivel", `${nivel}%`);

    const valorEl = document.getElementById(cfg.valorId);
    if (valorEl) valorEl.textContent = textoPrincipal;

    const percentEl = document.getElementById(cfg.percentId);
    if (percentEl) percentEl.textContent = textoSecundario;
  });

  // Atualiza o relógio no rodapé
  const last = document.getElementById("lastUpdate");
  if (last) {
    const data = ultimaAtualizacao
      ? new Date(ultimaAtualizacao).toLocaleTimeString("pt-BR", { hour12: false })
      : "--:--:--";
    last.textContent = "Última atualização: " + data;
  }
}

// Atualiza periodicamente
setInterval(carregarDados, UPDATE_INTERVAL);
carregarDados();
