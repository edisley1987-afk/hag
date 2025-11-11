// === dashboard.js ===
// Exibe níveis e pressões em cards modernos com barra lateral colorida
// Atualiza automaticamente a cada 5 segundos

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// Configuração dos reservatórios
const RESERVATORIOS = {
  Reservatorio_Elevador_current: {
    nome: "Reservatório Elevador",
    capacidade: 20000
  },
  Reservatorio_Osmose_current: {
    nome: "Reservatório Osmose",
    capacidade: 200
  },
  Reservatorio_CME_current: {
    nome: "Reservatório CME",
    capacidade: 1000
  },
  Reservatorio_Abrandada_current: {
    nome: "Reservatório Água Abrandada",
    capacidade: 2000
  },
  Pressao_Saida_Osmose_current: { nome: "Pressão Saída Osmose", unidade: "bar" },
  Pressao_Retorno_Osmose_current: { nome: "Pressão Retorno Osmose", unidade: "bar" },
  Pressao_Saida_CME_current: { nome: "Pressão Saída CME", unidade: "bar" },
};

// === Função principal ===
async function atualizarDados() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    const container = document.getElementById("cards-container");
    container.innerHTML = "";

    Object.entries(RESERVATORIOS).forEach(([key, cfg]) => {
      const valor = data[key];
      const card = document.createElement("div");
      card.classList.add("card");

      // Caso seja um reservatório (em litros)
      if (cfg.capacidade) {
        const litros = Number(valor) || 0;
        const perc = Math.min((litros / cfg.capacidade) * 100, 100).toFixed(1);

        // Define cor conforme nível
        let nivel = "vazio";
        if (perc >= 80) nivel = "alto";
        else if (perc >= 50) nivel = "medio";
        else if (perc > 5) nivel = "baixo";
        card.setAttribute("data-nivel", nivel);

        card.innerHTML = `
          <h2>${cfg.nome}</h2>
          <div class="valor">${perc}%</div>
          <div class="subvalor">${litros.toLocaleString()} L</div>
          <button onclick="abrirHistorico('${cfg.nome}')">Ver histórico</button>
        `;

      // Caso seja um sensor de pressão
      } else {
        const pressao = valor !== undefined && valor !== null ? valor.toFixed(2) : "--";
        card.setAttribute("data-nivel", "vazio");
        card.innerHTML = `
          <h2>${cfg.nome}</h2>
          <div class="valor">${pressao}</div>
          <div class="subvalor">${cfg.unidade || ""}</div>
        `;
      }

      container.appendChild(card);
    });

    document.getElementById("updateTime").textContent =
      "Última atualização: " + new Date().toLocaleTimeString("pt-BR");

  } catch (err) {
    console.error("Erro ao buscar dados:", err);
  }
}

// === Botão de histórico ===
function abrirHistorico(nome) {
  // Aqui você pode alterar o link do histórico (HTML ou rota específica)
  const url = "historico.html?reservatorio=" + encodeURIComponent(nome);
  window.open(url, "_blank");
}

// === Iniciar atualização automática ===
setInterval(atualizarDados, UPDATE_INTERVAL);
atualizarDados();
