// === CONFIGURAÇÕES ===
const API_URL = window.location.origin + "/historico"; // rota no servidor

const select = document.getElementById("reservatorioSelect");
const tabela = document.getElementById("consumoCorpo");


// === GRÁFICO ===
const ctx = document.getElementById("graficoHistorico").getContext("2d");

let chart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "",
            data: [],
            borderWidth: 3,
            fill: false,
            tension: 0.2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: false },
            x: { ticks: { maxRotation: 0, minRotation: 0 } }
        }
    }
});


// === FUNÇÃO PRINCIPAL ===
async function carregarHistorico(reservatorio) {

    // Bloqueia Geral e Irrigação no gráfico
    if (reservatorio === "geral" || reservatorio === "irrigacao") {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update();

        tabela.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center; padding:20px;">
                    Consumo disponível apenas para Elevador e Osmose
                </td>
            </tr>
        `;
        return;
    }

    try {
        const resp = await fetch(`${API_URL}?reservatorio=${reservatorio}`);
        const dados = await resp.json();

        if (!dados || dados.length === 0) {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update();

            tabela.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center; padding:20px;">
                        Nenhum dado encontrado.
                    </td>
                </tr>
            `;
            return;
        }

        // Preenche o gráfico
        chart.data.labels = dados.map(item => item.dataHoraFormatada);
        chart.data.datasets[0].label = `Nível – ${reservatorio}`;
        chart.data.datasets[0].data = dados.map(item => item.nivel);
        chart.update();

        // Preenche tabela de consumo
        tabela.innerHTML = "";

        dados.forEach(row => {
            tabela.innerHTML += `
                <tr>
                    <td>${row.dia}</td>
                    <td>${reservatorio}</td>
                    <td>${row.consumo ?? 0}</td>
                </tr>
            `;
        });

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
    }
}


// === EVENTO DE ALTERAÇÃO DE RESERVATÓRIO ===
select.addEventListener("change", () => {
    carregarHistorico(select.value);
});


// === CARREGAR INICIALMENTE ===
carregarHistorico(select.value);
