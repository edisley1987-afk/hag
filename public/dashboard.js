// ====== CONFIGURAÇÕES ======
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // 5 segundos
const LIMITE_INATIVIDADE = 10 * 60 * 1000; // 10 minutos

let ultimaLeitura = null; // ← ARMAZENA LEITURA FIXA
let ultimoTimestamp = null;

// Capacidades dos reservatórios
const RES = {
  Reservatorio_Elevador_current: 20000,
  Reservatorio_Osmose_current: 200,
  Reservatorio_CME_current: 1000,
  Reservatorio_Agua_Abrandada_current: 9000,
  Reservatorio_lavanderia_current: 10000
};

// ==============================
//   FUNÇÃO PRINCIPAL DE UPDATE
// ==============================
async function atualizarDados() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Falha na API");

    const dados = await response.json();

    // ========= GARANTIR QUE timestamp SEMPRE EXISTE =========
    const timestamp = dados.timestamp ? new Date(dados.timestamp) : new Date();

    // ========= VERIFICA SE DEVE CONGELAR OU ATUALIZAR =========
    if (!ultimaLeitura || timestamp > ultimoTimestamp) {
      ultimaLeitura = dados;
      ultimoTimestamp = timestamp;
    }

    // Renderiza a leitura fixa
    renderizarReservatorios(ultimaLeitura);
    renderizarPressao(ultimaLeitura);
    renderizarBombas(ultimaLeitura);

    verificarAtraso();

  } catch (err) {
    console.warn("Servidor offline → mantendo dados congelados");

    // Mesmo offline, manter valores fixos
    if (ultimaLeitura) {
      renderizarReservatorios(ultimaLeitura);
      renderizarPressao(ultimaLeitura);
      renderizarBombas(ultimaLeitura);
      verificarAtraso();
    }
  }
}

// ==============================
//      VERIFICA ATRASO
// ==============================
function verificarAtraso() {
  if (!ultimoTimestamp) return;

  const agora = Date.now();
  const atraso = agora - ultimoTimestamp.getTime();

  const avisos = document.querySelectorAll(".aviso-atraso");

  avisos.forEach(el => {
    el.textContent = atraso > LIMITE_INATIVIDADE
      ? "Sem atualização há mais de 10 minutos"
      : "";
  });
}

// ==============================
//     RESERVATÓRIOS
// ==============================
function renderizarReservatorios(d) {
  atualizarReservatorio("Elevador", d.Reservatorio_Elevador_current, RES.Reservatorio_Elevador_current);
  atualizarReservatorio("Osmose", d.Reservatorio_Osmose_current, RES.Reservatorio_Osmose_current);
  atualizarReservatorio("CME", d.Reservatorio_CME_current, RES.Reservatorio_CME_current);
  atualizarReservatorio("Abrandada", d.Reservatorio_Agua_Abrandada_current, RES.Reservatorio_Agua_Abrandada_current);
  atualizarReservatorio("lavanderia", d.Reservatorio_lavanderia_current, RES.Reservatorio_lavanderia_current);
}

function atualizarReservatorio(nome, valor, capacidade) {
  const pct = capacidade ? Math.round((valor / capacidade) * 100) : 0;

  const pctEl = document.getElementById(`pct_${nome}`);
  const litroEl = document.getElementById(`litros_${nome}`);

  if (pctEl) pctEl.textContent = pct + "%";
  if (litroEl) litroEl.textContent = valor + " L";
}

// ==============================
//         PRESSÕES
// ==============================
function renderizarPressao(d) {
  atualizarPressao("Osmose_saida", d.Pressao_Saida_Osmose_current);
  atualizarPressao("Osmose_retorno", d.Pressao_Retorno_Osmose_current);
  atualizarPressao("CME_saida", d.Pressao_Saida_CME_current);
}

function atualizarPressao(domId, valor) {
  const el = document.getElementById(`pressao_${domId}`);
  if (el) el.textContent = valor ? valor.toFixed(2) : "--";
}

// ==============================
//         BOMBAS
// ==============================
function renderizarBombas(d) {

  atualizarBomba(
    1,
    d.Bomba_01_binary,
    d.Ciclos_Bomba_01_counter
  );

  atualizarBomba(
    2,
    d.Bomba_02_binary,
    d.Ciclos_Bomba_02_counter
  );
}

function atualizarBomba(id, status, ciclos) {
  const st = document.getElementById(`bomba${id}_status`);
  const cc = document.getElementById(`bomba${id}_ciclos`);
  const on = document.getElementById(`bomba${id}_on`);

  if (st) st.textContent = status === 1 ? "Ligada" : "Desligada";
  if (cc) cc.textContent = ciclos ?? "--";

  if (on) on.textContent = status === 1 ? "Sim" : "Não";
}

// ==============================
//      INICIAR ROTINA
// ==============================
setInterval(atualizarDados, UPDATE_INTERVAL);
atualizarDados();
