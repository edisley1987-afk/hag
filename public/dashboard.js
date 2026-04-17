// ===============================
// CONFIG
// ===============================
const API_URL = "/api/dados"; // 🔴 ajuste se necessário
const INTERVALO = 5000;

// ===============================
// CARREGAR DADOS
// ===============================
async function carregarDados() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    console.log("Dados recebidos:", data);

    // ===============================
    // RESERVATÓRIOS
    // ===============================
    atualizarReservatorio(
      "Elevador",
      data.Reservatorio_Elevador_current_percent,
      data.Reservatorio_Elevador_current
    );

    atualizarReservatorio(
      "Osmose",
      data.Reservatorio_Osmose_current_percent,
      data.Reservatorio_Osmose_current
    );

    atualizarReservatorio(
      "CME",
      data.Reservatorio_CME_current_percent,
      data.Reservatorio_CME_current
    );

    atualizarReservatorio(
      "Abrandada",
      data.Reservatorio_Agua_Abrandada_current_percent,
      data.Reservatorio_Agua_Abrandada_current
    );

    // ===============================
    // PRESSÕES (BAR)
    // ===============================
    setTexto("pressaoSaida", data.Pressao_Saida_Osmose_current, " bar");
    setTexto("pressaoRetorno", data.Pressao_Retorno_Osmose_current, " bar");
    setTexto("pressaoCME", data.Pressao_Saida_CME_current, " bar");

    // ===============================
    // BOMBAS
    // ===============================
    atualizarBomba("cardBomba01", data.Bomba_01_binary);
    atualizarBomba("cardBomba02", data.Bomba_02_binary);
    atualizarBomba("cardBombaOsmose", data.Bomba_Osmose_binary);

    // ===============================
    // DATA
    // ===============================
    if (data.seq_timestamp) {
      document.getElementById("lastUpdate").innerText =
        "Última atualização: " +
        new Date(data.seq_timestamp).toLocaleTimeString("pt-BR");
    }

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    document.getElementById("lastUpdate").innerText =
      "Erro ao atualizar dados";
  }
}

// ===============================
// RESERVATÓRIO
// ===============================
function atualizarReservatorio(nome, percentual, litros) {
  if (percentual == null) return;

  const nivel = document.getElementById("nivel" + nome);
  const litrosEl = document.getElementById("litros" + nome);
  const barra = document.getElementById("nivel" + nome + "Bar");
  const card = document.getElementById("card" + nome);

  if (!nivel || !litrosEl || !barra || !card) return;

  // Texto
  nivel.innerText = percentual.toFixed(1) + "%";
  litrosEl.innerText = formatarNumero(litros) + " L";

  // Altura da barra
  barra.style.height = percentual + "%";

  // Cor dinâmica
  card.classList.remove("nv-critico", "nv-alerta", "nv-normal");

  if (percentual < 40) {
    card.classList.add("nv-critico");
  } else if (percentual < 80) {
    card.classList.add("nv-alerta");
  } else {
    card.classList.add("nv-normal");
  }
}

// ===============================
// PRESSÃO
// ===============================
function setTexto(id, valor, sufixo = "") {
  const el = document.getElementById(id);
  if (!el || valor == null) return;

  el.innerText = Number(valor).toFixed(2) + sufixo;
}

// ===============================
// BOMBAS
// ===============================
function atualizarBomba(id, status) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove("bomba-ligada", "bomba-desligada");

  if (status === 1) {
    el.classList.add("bomba-ligada");
    el.innerHTML = "⚙️ Ligada";
  } else {
    el.classList.add("bomba-desligada");
    el.innerHTML = "⚙️ Desligada";
  }
}

// ===============================
// UTIL
// ===============================
function formatarNumero(num) {
  if (num == null) return "--";
  return Number(num).toLocaleString("pt-BR");
}

// ===============================
// HISTÓRICO
// ===============================
function abrirHistorico(tag) {
  alert("Abrir histórico de: " + tag);
  // 👉 depois você pode abrir modal ou página
}

// ===============================
// LOOP
// ===============================
setInterval(carregarDados, INTERVALO);
carregarDados();
