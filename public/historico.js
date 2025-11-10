// Simulação de histórico (em versão real, pode vir do servidor)
const historicoMock = {
  Reservatorio_elevador: [
    { hora: "08:00", nivel: 60 },
    { hora: "10:00", nivel: 58 },
    { hora: "12:00", nivel: 55 },
    { hora: "14:00", nivel: 52 },
    { hora: "16:00", nivel: 50 },
  ],
  Reservatorio_Osmose: [
    { hora: "08:00", nivel: 85 },
    { hora: "10:00", nivel: 80 },
    { hora: "12:00", nivel: 75 },
    { hora: "14:00", nivel: 72 },
    { hora: "16:00", nivel: 68 },
  ],
  Reservatorio_CME: [
    { hora: "08:00", nivel: 40 },
    { hora: "10:00", nivel: 38 },
    { hora: "12:00", nivel: 35 },
    { hora: "14:00", nivel: 32 },
    { hora: "16:00", nivel: 30 },
  ],
  Reservatorio_Abrandada: [
    { hora: "08:00", nivel: 70 },
    { hora: "10:00", nivel: 68 },
    { hora: "12:00", nivel: 65 },
    { hora: "14:00", nivel: 63 },
    { hora: "16:00", nivel: 60 },
  ],
};

const params = new URLSearchParams(window.location.search);
const reservatorio = params.get("res");

if (!reservatorio || !historicoMock[reservatorio]) {
  document.body.innerHTML = "<h2 style='text-align:center'>Reservatório não encontrado.</h2>";
} else {
  const dados = historicoMock[reservatorio];
  document.getElementById("tituloHistorico").textContent =
    "Histórico — " + reservatorio.replace("Reservatorio_", "");

  const ctx = document.getElementById("graficoHistorico");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: dados.map((d) => d.hora),
      datasets: [
        {
          label: "Nível (%)",
          data: dados.map((d) => d.nivel),
          borderColor: "#1e88e5",
          backgroundColor: "rgba(30,136,229,0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        x: { ticks: { color: "#ccc" }, grid: { color: "#222" } },
        y: { ticks: { color: "#ccc" }, grid: { color: "#222" }, beginAtZero: true },
      },
    },
  });

  const tbody = document.querySelector("#tabelaHistorico tbody");
  dados.forEach((d) => {
    const row = `<tr><td>${d.hora}</td><td>${d.nivel}%</td></tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}
