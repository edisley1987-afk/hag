// === dashboard.js ===
// Atualiza o painel em tempo real com barras circulares animadas

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // a cada 5 segundos

// Configuração dos reservatórios
const RESERVATORIOS = {
  Reservatorio_Elevador_current: {
    nome: "Elevador",
    capacidade: 20000,
    elementoNivel: "nivelElevador",
    elementoLitros: "litrosElevador",
    ringId: "ringElevador",
    tipo: "nivel"
  },
  Reservatorio_Osmose_current: {
    nome: "Osmose",
    capacidade: 200,
    elementoNivel: "nivelOsmose",
    elementoLitros: "litrosOsmose",
    ringId: "ringOsmose",
    tipo: "nivel"
  },
  Reservatorio_CME_current: {
    nome: "CME",
    capacidade: 1000,
    elementoNivel: "nivelCME",
    elementoLitros: "litrosCME",
    ringId: "ringCME",
    tipo: "nivel"
  },
  Agua_Abrandada_current: {
    nome: "Abrandada",
    capacidade: 500,
    elementoNivel: "nivelAbrandada",
    elementoLitros: "litrosAbrandada",
    ringId: "ringAbrandada",
    tipo: "nivel"
  },
};

// Configuração das pressões
const PRESSOES = {
  Pressao_Saida_Osmose_current: "pressaoSaidaValor",
  Pressao_Retorno_Osmose_current: "pressaoRetornoValor",
  Pressao_Saida_CME_current: "pressaoCMEValor",
};

// Função principal: busca e atualiza dados
async function atualizarDashboard() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    const timestamp = new Date(data.timestamp);
    document.getElementById("lastUpdate").innerText =
      "Última atualização: " + timestamp.toLocaleTimeString("pt-BR");

    // Atualiza reservatórios
    for (const [chave, cfg] of Object.entries(RESERVATORIOS)) {
      const valor = Number(data[chave]);
      const litros = isNaN(valor) ? 0 : Math.max(0, valor);
      const porcentagem = cfg.capacidade
        ? Math.min(100, ((litros / cfg.capacidade) * 100).toFixed(1))
        : 0;

      const elementoNivel = document.getElementById(cfg.elementoNivel);
      const elementoLitros = document.getElementById(cfg.elementoLitros);
      const ring = document.getElementById(cfg.ringId);

      // Define cores de status
      let cor = "#3aa374"; // verde
      if (porcentagem <= 30) cor = "#e64a19"; // vermelho
      else if (porcentagem <= 60) cor = "#f4c542"; // amarelo

      // Atualiza texto
      elementoNivel.innerText = `${porcentagem}%`;
      elementoLitros.innerText = `${litros.toLocaleString("pt-BR")} L`;

      // Atualiza barra circular
      if (ring) {
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        ring.style.strokeDasharray = `${circumference}`;
        const offset = circumference - (porcentagem / 100) * circumference;
        ring.style.strokeDashoffset = offset;
        ring.style.stroke = cor;
      }
    }

    // Atualiza pressões
    for (const [chave, elementoId] of Object.entries(PRESSOES)) {
      const valor = Number(data[chave]);
      const texto =
        isNaN(valor) || valor <= 0 ? "-- bar" : `${valor.toFixed(2)} bar`;
      document.getElementById(elementoId).innerText = texto;
    }
  } catch (error) {
    console.warn("Erro ao obter dados:", error);

    // Se não houver leitura, zera todos
    document.getElementById("lastUpdate").innerText =
      "Sem comunicação — exibindo 0%";

    for (const [_, cfg] of Object.entries(RESERVATORIOS)) {
      document.getElementById(cfg.elementoNivel).innerText = "0%";
      document.getElementById(cfg.elementoLitros).innerText = "0 L";
      const ring = document.getElementById(cfg.ringId);
      if (ring) {
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        ring.style.strokeDasharray = `${circumference}`;
        ring.style.strokeDashoffset = circumference;
        ring.style.stroke = "#e64a19";
      }
    }

    for (const elementoId of Object.values(PRESSOES)) {
      document.getElementById(elementoId).innerText = "-- bar";
    }
  }
}

// Atualiza automaticamente
setInterval(atualizarDashboard, UPDATE_INTERVAL);
atualizarDashboard();
