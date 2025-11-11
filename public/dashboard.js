const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // Atualiza a cada 5s
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
  Pressao_Saida
