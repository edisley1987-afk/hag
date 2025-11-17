// =========================
//  CAPACIDADES DOS RESERVATÓRIOS
// =========================
const capacidades = {
    "elevador": 20000,
    "osmose": 200,
    "cme": 1000,
    "abrandada": 9000
};

// =========================
//  BUSCAR LISTA DE RESERVATÓRIOS
// =========================
document.addEventListener("DOMContentLoaded", async () => {
    const select = document.getElementById("reservatorioSelect");

    try {
        const response = await fetch("https://hag-9ki9.onrender.com/reservatorios");
        const reservatorios = await response.json();

        select.innerHTML = "";

        reservatorios.forEach(res => {
            const option = document.createElement("option");
            option.value = res.id.toLowerCase();  
            option.textContent = res.nome;
            select.appendChild(option);
        });

        // Seleciona o primeiro da lista automaticamente
        if (reservatorios.length > 0) {
            carregarHistorico(reservatorios[0].id.toLowerCase());
        }

        select.addEventListener("change", () => {
            carregarHistorico(select.value);
        });

    } catch (error) {
        console.error("Erro ao carregar reservatórios:", error);
    }
});

// =========================
//  CARREGAR HISTÓRICO
// =========================
let grafico = null;

async function carregarHistorico(reservatorioId) {

    const tabela = document.getElementById("historicoTabela");
    const corpoTabela = document.getElementById("tabelaBody");
    const ctx = document.getElementById("historicoChart").getContext("2d");

    // Limpar antes de atualizar
    corpoTabela.innerHTML = "";

    try {
        const response = await fetch(`https://hag-9ki9.onrender.com/historico/${reservatorioId}`);
        const data = await response.json();

        if (!data || data.length === 0) {
            corpoTabela.innerHTML = `<tr><td colspan="3">Nenhum registro encontrado.</td></tr>`;
            if (grafico) grafico.destroy();
            return;
        }

        // Preparar dados do gráfico
        const labels = data.map(item => item.data_hora);
        const litros = data.map(item => item.litros);

        // Destruir gráfico anterior
        if (grafico) grafico.destroy();

        grafico = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: reservatorioId.toUpperCase(),
                    data: litros,
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });

        // Preencher tabela
        const capacidade = capacidades[reservatorioId] || 1;

        data.forEach(item => {
            const percentual = ((item.litros / capacidade) * 100).toFixed(1);

            const row = `
                <tr>
                    <td>${item.data_hora}</td>
                    <td>${item.litros}</td>
                    <td>${percentual}%</td>
                </tr>
            `;
            corpoTabela.insertAdjacentHTML("beforeend", row);
        });

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        corpoTabela.innerHTML = `<tr><td colspan="3">Erro ao carregar histórico.</td></tr>`;
    }
}
