const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // Atualiza a cada 5 segundos
let ultimaLeitura = null;

// ===== Função para criar os cards =====
function criarCard(id, nome, tipo) {
  const card = document.createElement("div");
  card.className = "card";
  if (tipo === "pressao") card.classList.add("pressao");
  card.id = id;

  const titulo = document.createElement("h2");
  titulo.textContent = nome;

  const container = document.createElement("div");
  container.className = "nivel-container";

  const nivel = document.createElement("div");
  nivel.className = "nivel";

  const valor = document.createElement("div");
  valor.className = "valor";

  container.appendChild(nivel);
  container.appendChild(valor);
  card.appendChild(titulo);
  card.appendChild(container);

  document.getElementById("cardsContainer").appendChild(card);
  return { card, nivel, valor };
}

// ===== Configuração dos sensores =====
const SENSORES = {
  Reservatorio_Elevador_current: { nome: "Reservatório Elevador", tipo: "reservatorio", capacidade: 20000 },
  Reservatorio_Osmose_current: { nome: "Reservatório Osmose", tipo: "reservatorio", capacidade: 200 },
  Reservatorio_CME_current: { nome: "Reservatório CME", tipo: "reservatorio", capacidade: 1000 },
  Pressao_Retorno_Osmose_current: { nome: "Pressão Retorno Osmose", tipo: "pressao", capacidade: 5 },
  Pressao_Saida_current: { nome: "Pressão Saída", tipo: "pressao", capacidade: 5 }
};

// ===== Criação inicial dos cards =====
const elementos = {};
for (const id in SENSORES) {
  const sensor = SENSORES[id];
  elementos[id] = criarCard(id, sensor.nome, sensor.tipo);
}

// ===== Função para atualizar os dados =====
async function atualizarDados() {
  try {
    const resposta = await fetch(API_URL);
    if (!resposta.ok) throw new Error("Erro ao buscar dados do servidor");

    const dados = await resposta.json();
    ultimaLeitura = new Date();

    for (const id in SENSORES) {
      const sensor = SENSORES[id];
      const valorSensor = dados[id];

      if (valorSensor !== undefined) {
        const { nivel, valor } = elementos[id];

        if (sensor.tipo === "reservatorio") {
          const porcentagem = Math.min(100, (valorSensor / sensor.capacidade) * 100);
          nivel.style.height = `${porcentagem}%`;
          valor.textContent = `${porcentagem.toFixed(1)}% (${valorSensor} L de ${sensor.capacidade.toLocaleString()} L)`;
        } else if (sensor.tipo === "pressao") {
          const porcentagem = Math.min(100, (valorSensor / sensor.capacidade) * 100);
          nivel.style.height = `${porcentagem}%`;
          valor.textContent = `${valorSensor.toFixed(2)} bar`;
        }
      }
    }

    document.getElementById("ultimaAtualizacao").textContent =
      `Última atualização: ${ultimaLeitura.toLocaleTimeString()}`;
  } catch (erro) {
    console.error("Erro ao atualizar dados:", erro);
  }
}

// ===== Atualização automática =====
setInterval(atualizarDados, UPDATE_INTERVAL);
atualizarDados();
