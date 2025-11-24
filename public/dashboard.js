// ===============================
//    ANIMAÇÃO E LÓGICA PRINCIPAL
// ===============================

// --- Template SVG da onda ---
const svgOnda = `
  <div class="nivel" aria-hidden="true">
    <svg class="wave-svg" viewBox="0 0 2400 400" preserveAspectRatio="xMidYMid slice">
      <g class="wave-path wave-1">
        <path d="M0 120 C 150 200 350 40 600 120 C 850 200 1050 40 1200 120 L1200 400 L0 400 Z"></path>
        <path d="M1200 120 C 1350 200 1550 40 1800 120 C 2050 200 2250 40 2400 120 L2400 400 L1200 400 Z"></path>
      </g>
      <g class="wave-path wave-2">
        <path d="M0 140 C 150 60 350 240 600 140 C 850 40 1050 240 1200 140 L1200 400 L0 400 Z"></path>
        <path d="M1200 140 C 1350 60 1550 240 1800 140 C 2050 40 2250 240 2400 140 L2400 400 L1200 400 Z"></path>
      </g>
    </svg>
  </div>
`;


// ===============================
//   LÓGICA PARA DEFINIR CLASSES
// ===============================
function classificarNivel(card, porcentagem, emManutencao) {

  // Remove classes antigas
  card.classList.remove("alta", "media", "baixa", "alerta-piscando", "manutencao");

  // Modo manutenção
  if (emManutencao) {
    card.classList.add("manutencao");
    return;
  }

  // ======================
  //    Definição de cor
  // ======================
  if (porcentagem >= 70) {
    card.classList.add("alta");   // Azul
  } 
  else if (porcentagem >= 40) {
    card.classList.add("media");  // Amarelo
  } 
  else {
    card.classList.add("baixa");  // Vermelho
  }

  // ======================
  // ALERTA < 30%
  // ======================
  if (porcentagem < 30) {
    card.classList.add("alerta-piscando");
  }
}


// ===============================
//    CRIAÇÃO DO CARD DINAMICO
// ===============================
function criarCardReservatorio(item) {
  const porcentagem = item.percent || 0;
  const litros = item.current_liters || 0;
  const manutencao = item.manutencao || false;

  const card = document.createElement("div");
  card.className = "card reservatorio";
  card.id = `${item.setor}_current`;
  card.style = `--nivel: ${porcentagem}%;`;

  // HTML do card
  card.innerHTML = `
    <div class="aviso-inativo" style="display:none;">⚠ Sem atualização há mais de 10 minutos</div>
    ${svgOnda}
    <div class="conteudo">
      <h3>${item.nome}</h3>
      <div class="percent">${porcentagem}%</div>
      <div class="liters">${litros} L</div>
      <button class="btn-hist" onclick="abrirHistorico('${item.setor}')">Ver Histórico</button>
    </div>
  `;

  // Aplicar classes (cor, alerta, manutenção)
  classificarNivel(card, porcentagem, manutencao);

  return card;
}


// ===============================
//         PRESSÕES
// ===============================
function criarCardPressao(item) {
  const card = document.createElement("div");
  card.className = "card pressao";
  card.id = `${item.setor}_pressao`;

  card.innerHTML = `
    <div class="conteudo">
      <h3>${item.nome}</h3>
      <div class="percent">${item.pressao} PSI</div>
    </div>
  `;

  return card;
}


// ===============================
//     CARREGAR DADOS DO SERVIDOR
// ===============================
async function carregarDados() {
  try {
    const resp = await fetch("/api/dashboard");
    const dados = await resp.json();

    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + dados.lastUpdate;

    const contReserv = document.getElementById("reservatoriosContainer");
    const contPress = document.getElementById("pressoesContainer");

    contReserv.innerHTML = "";
    contPress.innerHTML = "";

    // Injetar reservatórios
    dados.reservatorios.forEach(r => {
      contReserv.appendChild(criarCardReservatorio(r));
    });

    // Injetar pressões
    dados.pressoes.forEach(p => {
      contPress.appendChild(criarCardPressao(p));
    });

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}


// ===============================
//       LOOP DE ATUALIZAÇÃO
// ===============================
setInterval(carregarDados, 5000);
carregarDados();


// ===============================
//     FUNÇÃO HISTÓRICO (NAVEGA)
// ===============================
function abrirHistorico(setor) {
  window.location.href = `/historico.html?setor=${setor}`;
}
