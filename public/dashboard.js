const API_URL = "/api/dashboard";

async function carregarDados() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now()); // evita cache
    const data = await res.json();

    atualizarReservatorios(data.reservatorios);
    atualizarPressoes(data.pressoes);
    atualizarHeader(data.lastUpdate);

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

function atualizarReservatorios(lista) {
  lista.forEach(r => {
    const id = r.setor;

    // MAPEAMENTO DOS IDS DO HTML
    const map = {
      elevador: "Elevador",
      osmose: "Osmose",
      cme: "CME",
      abrandada: "Abrandada"
    };

    const nome = map[id];
    if (!nome) return;

    // Atualiza valores
    document.getElementById(`nivel${nome}`).innerText = `${r.percent}%`;
    document.getElementById(`litros${nome}`).innerText = `${r.current_liters} L`;

    // Atualiza barra
    const bar = document.getElementById(`nivel${nome}Bar`);
    if (bar) {
      bar.style.height = r.percent + "%";

      // cor dinâmica
      if (r.percent < 30) bar.style.background = "#ff4d4d";
      else if (r.percent < 60) bar.style.background = "#ffaa00";
      else bar.style.background = "#00ff88";
    }
  });
}

function atualizarPressoes(lista) {
  lista.forEach(p => {
    if (p.setor === "saida_osmose") {
      document.getElementById("pressaoSaida").innerText = `${p.pressao} bar`;
    }
    if (p.setor === "retorno_osmose") {
      document.getElementById("pressaoRetorno").innerText = `${p.pressao} bar`;
    }
    if (p.setor === "saida_cme") {
      document.getElementById("pressaoCME").innerText = `${p.pressao} bar`;
    }
  });
}

function atualizarHeader(timestamp) {
  if (!timestamp) return;

  const data = new Date(timestamp);
  document.getElementById("lastUpdate").innerText =
    "Última atualização: " + data.toLocaleTimeString("pt-BR");
}

// Atualiza a cada 5 segundos
setInterval(carregarDados, 5000);

// Primeira carga
carregarDados();
