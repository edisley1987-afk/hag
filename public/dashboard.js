// === Dashboard HAG ===
// Exibe leituras em tempo real, converte para litros/bar e mostra % corretamente

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // a cada 5 segundos

// Configuração dos reservatórios
const RESERVATORIOS = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    capacidade: 20000,
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    capacidade: 200,
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    capacidade: 1000,
  },
  Reservatorio_Agua_Abrandada_current: {
    nome: "Água Abrandada",
    capacidade: 9000,
  },
};

// Pressões
const PRESSOES = {
  Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
  Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
  Pressao_Saida_CME_current: "Pressão Saída CME",
};

let ultimaAtualizacao = 0;

async function atualizarLeituras() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();

    if (!dados || !dados.timestamp) return;

    const ts = new Date(dados.timestamp).getTime();
    const agora = Date.now();

    // Se a leitura for muito antiga, ignora (mais de 5 min)
    if (agora - ts > 5 * 60 * 1000) {
      console.warn("⏳ Dados antigos — aguardando nova leitura...");
      return;
    }

    ultimaAtualizacao = ts;
    document.getElementById("lastUpdate").innerText =
      "Última atualização: " + new Date(ts).toLocaleString();

    const container = document.getElementById("cards");
    container.innerHTML = "";

    // === Reservatórios ===
    for (const [id, cfg] of Object.entries(RESERVATORIOS)) {
      const valor = dados[id];
      const temDado = typeof valor === "number" && valor > 0;

      const nivel = temDado
        ? Math.min(100, Math.round((valor / cfg.capacidade) * 100))
        : 0;

      const card = document.createElement("div");
      card.className = "card" + (temDado ? "" : " sem-dados");
      card.style.setProperty("--nivel", `${nivel}%`);

      card.innerHTML = `
        <h2>${cfg.nome}</h2>
        <p><strong>${temDado ? nivel + "%" : "--"}</strong></p>
        <p>${temDado ? valor.toLocaleString() + " L" : "Sem dados"}</p>
        <button class="historico-btn">Ver Histórico</button>
      `;

      card.querySelector(".historico-btn").onclick = () =>
        (window.location.href = "/historico-view?res=" + id);

      container.appendChild(card);
    }

    // === Pressões ===
    for (const [id, nome] of Object.entries(PRESSOES)) {
      const valor = dados[id];
      const temDado = typeof valor === "number" && valor > 0;

      const card = document.createElement("div");
      card.className = "card" + (temDado ? "" : " sem-dados");
      card.innerHTML = `
        <h2>${nome}</h2>
        <p><strong>${temDado ? valor.toFixed(2) : "--"} bar</strong></p>
      `;
      container.appendChild(card);
    }
  } catch (err) {
    console.error("Erro ao buscar leituras:", err);
  }
}

setInterval(atualizarLeituras, UPDATE_INTERVAL);
window.onload = atualizarLeituras;
