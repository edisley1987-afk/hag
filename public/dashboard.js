async function carregarDados() {
  try {
    const res = await fetch("/dados");
    const data = await res.json();

    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date().toLocaleString("pt-BR");

    atualizarCard("elevador", data.Reservatorio_Elevador_current, 20000);
    atualizarCard("osmose", data.Reservatorio_Osmose_current, 200);
    atualizarCard("cme", data.Reservatorio_CME_current, 1000);
    atualizarCard("abrandada", data.Agua_Abrandada_current, 9000);
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

function atualizarCard(id, valor, capacidade) {
  const litros = valor || 0;
  const perc = Math.min(100, ((litros / capacidade) * 100).toFixed(1));

  document.getElementById(`${id}Valor`).textContent = `${litros} L`;
  document.getElementById(`${id}Percent`).textContent = `${perc}%`;

  if (relogios[id]) {
    relogios[id].data.datasets[0].data = [perc, 100 - perc];
    relogios[id].update();
  }
}

const configGauge = (label) => ({
  type: "doughnut",
  data: {
    labels: ["Nível", "Faltante"],
    datasets: [
      {
        data: [0, 100],
        backgroundColor: ["#00c9a7", "#004f46"],
        borderWidth: 0,
      },
    ],
  },
  options: {
    cutout: "80%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      title: {
        display: true,
        text: label,
        color: "#ffffff",
        font: { size: 14 },
      },
    },
  },
});

const relogios = {
  elevador: new Chart(document.getElementById("relogioElevador"), configGauge("Elevador")),
  osmose: new Chart(document.getElementById("relogioOsmose"), configGauge("Osmose")),
  cme: new Chart(document.getElementById("relogioCME"), configGauge("CME")),
  abrandada: new Chart(document.getElementById("relogioAbrandada"), configGauge("Água Abrandada")),
};

function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("clock").textContent = agora.toLocaleTimeString("pt-BR");
}

setInterval(carregarDados, 5000);
setInterval(atualizarRelogio, 1000);

carregarDados();
atualizarRelogio();
