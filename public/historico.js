const urlParams = new URLSearchParams(window.location.search);
const reservatorio = urlParams.get("reservatorio");

fetch("/historico")
  .then(res => res.json())
  .then(dados => {
    if (!Array.isArray(dados) || dados.length === 0) {
      console.warn("Sem dados de histórico.");
      return;
    }

    // Pega todas as leituras para o reservatório selecionado
    const filtrados = dados
      .filter(d => d[reservatorio])
      .map(d => ({
        hora: new Date(d.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        valor: d[reservatorio]
      }));

    if (filtrados.length === 0) {
      console.warn("Sem dados para este reservatório.");
      return;
    }

    // Gera gráfico
    const ctx = document.getElementById("grafico").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: filtrados.map(f => f.hora),
        datasets: [{
          label: "Leitura (L)",
          data: filtrados.map(f => f.valor),
          borderColor: "#007bff",
          borderWidth: 2,
          fill: false,
          tension: 0.2
        }]
      },
      options: {
        scales: {
          y: { beginAtZero: true },
          x: { title: { display: true, text: "Horário" } }
        }
      }
    });

    // Atualiza tabela
    const tabela = document.querySelector("tbody");
    tabela.innerHTML = filtrados.map(f => `
      <tr>
        <td>${new Date().toLocaleDateString("pt-BR")}</td>
        <td>${reservatorio}</td>
        <td>${Math.min(...filtrados.map(x => x.valor))}</td>
        <td>${Math.max(...filtrados.map(x => x.valor))}</td>
      </tr>
    `).join("");
  });
