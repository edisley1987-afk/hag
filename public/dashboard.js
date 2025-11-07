const API_URL = "https://reservatorios-hag-dashboard.onrender.com/dados";

const CONFIG = {
  Reservatorio_Elevador: { nome: "Reservatório Elevador", capacidade: 20000 },
  Reservatorio_Osmose: { nome: "Reservatório Osmose", capacidade: 200 },
  Reservatorio_CME: { nome: "Reservatório CME", capacidade: 1000 },
  Agua_Abrandada: { nome: "Água Abrandada", capacidade: 9000 },
};

// === Cria os cards fixos uma única vez ===
function criarCardsFixos() {
  const cards = document.getElementById("cards");
  cards.innerHTML = "";

  Object.entries(CONFIG).forEach(([key, info]) => {
    const card = document.createElement("div");
    card.className = "card card-animada";
    card.id = `card_${key}`;

    card.innerHTML = `
      <h2>${info.nome}</h2>
      <div class="progress">
        <div class="progress-fill" id="fill_${key}" style="width:0%; background:#00c9a7"></div>
      </div>
      <div class="valor" id="valor_${key}">-- L (--%)</div>
    `;

    cards.appendChild(card);
  });

  // Cria bloco de pressões
  const blocoPressao = document.createElement("div");
  blocoPressao.className = "pressao-bloco";
  blocoPressao.innerHTML = "<h2>Pressões</h2>";

  const nomesPressao = [
    "Pressao_Saida_CME_current",
    "Pressao_Retorno_Osmose_current",
    "Pressao_Saida_Osmose_current",
  ];

  nomesPressao.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card-pressao";
    card.id = `pressao_${p}`;
    card.innerHTML = `
      <div class="pressao-nome">${p.replaceAll("_", " ")}</div>
      <div class="pressao-valor">-- A</div>
    `;
    blocoPressao.appendChild(card);
  });

  cards.appendChild(blocoPressao);
}

// === Atualiza somente os valores ===
async function carregarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());
    const dados = await res.json();

    Object.entries(CONFIG).forEach(([key, info]) => {
      const valor = Number(dados[`${key}_current`] || 0);
      const porcent = (valor / info.capacidade) * 100;

      let cor = "#00c9a7";
      if (porcent < 30) cor = "#e53935";
      else if (porcent < 50) cor = "#fbc02d";

      const fill = document.getElementById(`fill_${key}`);
      const texto = document.getElementById(`valor_${key}`);
      const card = document.getElementById(`card_${key}`);

      if (fill) fill.style.width = `${porcent.toFixed(1)}%`;
      if (fill) fill.style.background = cor;
      if (texto)
        texto.textContent = `${valor.toFixed(0)} L (${porcent.toFixed(1)}%)`;

      // brilho vermelho se estiver crítico
      card.style.boxShadow =
        porcent < 30
          ? "0 0 15px 2px rgba(229,57,53,0.4)"
          : "0 0 10px rgba(0,0,0,0.2)";
    });

    // Atualiza pressões
    Object.keys(dados).forEach((key) => {
      if (key.toLowerCase().includes("pressao")) {
        const el = document.querySelector(`#pressao_${key} .pressao-valor`);
        if (el) el.textContent = `${dados[key]} A`;
      }
    });

    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString("pt-BR");
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

// === Inicialização ===
criarCardsFixos();
carregarDados();
setInterval(carregarDados, 15000);
