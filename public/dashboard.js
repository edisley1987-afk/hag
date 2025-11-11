// === dashboard.js ===
// Exibe leituras com barra circular e atualização automática

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // 5s

// Configuração dos sensores
const SENSORES = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", tipo: "nivel", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", tipo: "nivel", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", tipo: "nivel", capacidade: 1000 },
  Agua_Abrandada_current: { nome: "Água Abrandada", tipo: "nivel", capacidade: 9000 },
  Pressao_Saida_Osmose_current: { nome: "Pressão Saída Osmose", tipo: "pressao" },
  Pressao_Retorno_Osmose_current: { nome: "Pressão Retorno Osmose", tipo: "pressao" },
  Pressao_Saida_CME_current: { nome: "Pressão Saída CME", tipo: "pressao" },
};

// === Buscar dados ===
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    atualizarLeituras(dados);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
  }
}

// === Atualizar Dashboard ===
function atualizarLeituras(dados) {
  Object.entries(SENSORES).forEach(([chave, cfg]) => {
    const valor = dados[chave] ?? 0; // se faltar leitura, usa 0

    const card = document.querySelector(`#card${cfg.nome.split(" ")[1] || ""}`);
    if (!card) return;

    const barra = card.querySelector(".barra-circular");
    const nivelEl = card.querySelector("p[id^='nivel']");
    const litrosEl = card.querySelector("p[id^='litros']");
    const pressaoEl = card.querySelector("p[id^='pressao']");

    if (cfg.tipo === "nivel") {
      const porcentagem = Math.min(100, Math.max(0, (valor / cfg.capacidade) * 100));
      const litros = valor.toFixed(0);
      const cor = porcentagem < 50 ? "#e64a19" : porcentagem < 80 ? "#f4c542" : "#3aa374";

      // Barra circular
      if (barra) barra.style.background = `conic-gradient(${cor} ${porcentagem * 3.6}deg, #ddd 0deg)`;

      if (nivelEl) nivelEl.textContent = `${porcentagem.toFixed(1)}%`;
      if (litrosEl) litrosEl.textContent = `${litros} L`;
    }

    if (cfg.tipo === "pressao") {
      const cor = valor < 1 ? "#e64a19" : "#3aa374";
      if (pressaoEl) pressaoEl.textContent = `${valor.toFixed(2)} bar`;
      if (barra) barra.style.background = `conic-gradient(${cor} 360deg, ${cor} 360deg)`;
    }
  });

  // Atualizar hora
  const last = document.getElementById("lastUpdate");
  if (last) last.textContent = "Última atualização: " + new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

// Atualização automática
setInterval(carregarDados, UPDATE_INTERVAL);
carregarDados();

// === Função para abrir histórico ===
function abrirHistorico(reservatorioId) {
  window.location.href = `historico.html?reservatorio=${reservatorioId}`;
}
window.abrirHistorico = abrirHistorico;
