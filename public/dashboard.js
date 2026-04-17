async function carregarDashboard() {
  try {
    const res = await fetch("/api/dashboard");
    const data = await res.json();

    console.log("DADOS:", data);

    document.getElementById("lastUpdate").innerText =
      "Última atualização: " + data.lastUpdate;

    // =========================
    // RESERVATÓRIOS
    // =========================
    data.reservatorios.forEach(r => {

      function atualizarCard(nome, id) {
        document.getElementById("nivel" + id).innerText = r.percent + "%";
        document.getElementById("litros" + id).innerText = r.current_liters + " L";
        document.getElementById("nivel" + id + "Bar").style.height = r.percent + "%";
      }

      if (r.setor === "elevador") atualizarCard(r, "Elevador");
      if (r.setor === "osmose") atualizarCard(r, "Osmose");
      if (r.setor === "cme") atualizarCard(r, "CME");
      if (r.setor === "abrandada") atualizarCard(r, "Abrandada");
      if (r.setor === "lavanderia") atualizarCard(r, "Lavanderia");
    });

    // =========================
    // PRESSÕES
    // =========================
    data.pressoes.forEach(p => {
      if (p.setor === "saida_osmose")
        document.getElementById("pressaoSaida").innerText = p.pressao + " bar";

      if (p.setor === "retorno_osmose")
        document.getElementById("pressaoRetorno").innerText = p.pressao + " bar";

      if (p.setor === "saida_cme")
        document.getElementById("pressaoCME").innerText = p.pressao + " bar";
    });

    // =========================
    // BOMBAS
    // =========================
    data.bombas.forEach(b => {

      function setBomba(id, statusId, ciclosId) {
        document.getElementById(statusId).innerText = b.estado;
        document.getElementById(ciclosId).innerText = b.ciclo + " ciclos";

        const card = document.getElementById(id);

        if (b.estado === "ligada") {
          card.style.background = "#14532d";
        } else {
          card.style.background = "#3f3f46";
        }
      }

      if (b.nome === "Bomba 01") setBomba("bomba1", "statusBomba1", "ciclosBomba1");
      if (b.nome === "Bomba 02") setBomba("bomba2", "statusBomba2", "ciclosBomba2");
      if (b.nome === "Bomba Osmose") setBomba("bombaOsmose", "statusBombaOsmose", "ciclosBombaOsmose");

    });

  } catch (err) {
    console.error("Erro:", err);
  }
}

// Atualiza a cada 5s
setInterval(carregarDashboard, 5000);
carregarDashboard();
