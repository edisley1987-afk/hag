const API_URL = "/api/dashboard";

async function carregarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now());

    if (!res.ok) throw new Error("Erro HTTP " + res.status);

    const data = await res.json();

    if (!data || !data.reservatorios) {
      console.warn("Dados inválidos");
      return;
    }

    atualizarReservatorios(data.reservatorios);
    atualizarPressoes(data.pressoes);
    atualizarHeader(data.lastUpdate);

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    mostrarErro();
  }
}

// ---------------- RESERVATÓRIOS ----------------
function atualizarReservatorios(lista) {
  const map = {
    elevador: "Elevador",
    osmose: "Osmose",
    cme: "CME",
    abrandada: "Abrandada"
  };

  lista.forEach(r => {
    const nome = map[r.setor];
    if (!nome) return;

    const elNivel = document.getElementById(`nivel${nome}`);
    const elLitros = document.getElementById(`litros${nome}`);
    const bar = document.getElementById(`nivel${nome}Bar`);

    if (!elNivel || !elLitros || !bar) return;

    elNivel.innerText = `${r.percent}%`;
    elLitros.innerText = `${r.current_liters} L`;

    bar.style.height = r.percent + "%";

    // cores inteligentes
    if (r.percent < 25) {
      bar.style.background = "#ff3b3b";
      bar.style.boxShadow = "0 0 10px #ff3b3b";
    } else if (r.percent < 60) {
      bar.style.background = "#ffaa00";
    } else {
      bar.style.background = "#00ff88";
    }
  });
}

// ---------------- PRESSÕES ----------------
function atualizarPressoes(lista) {
  if (!lista) return;

  lista.forEach(p => {
    if (p.setor === "saida_osmose") {
      setTexto("pressaoSaida", p.pressao);
    }
    if (p.setor === "retorno_osmose") {
      setTexto("pressaoRetorno", p.pressao);
    }
    if (p.setor === "saida_cme") {
      setTexto("pressaoCME", p.pressao);
    }
  });
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerText = valor != null ? `${valor} bar` : "-- bar";
}

// ---------------- HEADER ----------------
function atualizarHeader(timestamp) {
  const el = document.getElementById("lastUpdate");
  if (!el) return;

  if (!timestamp) {
    el.innerText = "Sem atualização";
    return;
  }

  const data = new Date(timestamp);
  el.innerText = "Última atualização: " + data.toLocaleTimeString("pt-BR");
}

// ---------------- ERRO VISUAL ----------------
function mostrarErro() {
  const el = document.getElementById("lastUpdate");
  if (el) {
    el.innerText = "⚠️ Erro ao conectar com servidor";
  }
}

// ---------------- AUTO UPDATE ----------------
setInterval(carregarDados, 5000);
carregarDados();
