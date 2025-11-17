document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("reservatorioSelect");
    const ctx = document.getElementById("historicoChart").getContext("2d");
    let chart;

    // CAPACIDADES REAIS DOS RESERVATÓRIOS
    const capacidades = {
        "osmose": 200,
        "evento": 200,
        "hemodialise": 500,
        "torre": 1000
    };

    async function carregarHistorico(reservatorio) {
        try {
            const resposta = await fetch(`https://hag-9ki9.onrender.com/historico/${reservatorio}`);
            const dados = await resposta.json();

            if (!dados || dados.length === 0) {
                alert("Nenhum registro encontrado.");
                return;
            }

            const capacidade = capacidades[reservatorio];
            const datas = dados.map(item => formatarData(item.data_hora));
            const litros = dados.map(item => Number(item.litros));
            const percentuais = dados.map(item => ((item.litros / capacidade) * 100).toFixed(1));

            // ====== AJUSTE AUTOMÁTICO DO EIXO Y ======
            const maxValor = Math.max(...litros, 1);     // maior valor recebido
            const margem = maxValor * 0.30;              // 30% de espaço visual
            const limiteY = Math.ceil(maxValor + margem);

            // ====== GRÁFICO ======
            if (chart) chart.destroy();

            chart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: datas,
                    datasets: [{
                        label: reservatorio.charAt(0).toUpperCase() + reservatorio.slice(1),
                        data: litros,
                        borderWidth: 2,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: limiteY
                        }
                    }
                }
            });

            // ====== TABELA ======
            const tbody = document.querySelector("#historicoTable tbody");
            tbody.innerHTML = "";

            dados.forEach((item, index) => {
                tbody.innerHTML += `
                    <tr>
                        <td>${formatarData(item.data_hora)}</td>
                        <td>${litros[index]} L</td>
                        <td>${percentuais[index]}%</td>
                    </tr>
                `;
            });

        } catch (erro) {
            console.log("Erro:", erro);
        }
    }

    function formatarData(dataISO) {
        const d = new Date(dataISO);
        return d.toLocaleString("pt-BR");
    }

    // Evento de troca no select
    select.addEventListener("change", () => {
        carregarHistorico(select.value);
    });

    // Carrega Osmose como padrão
    carregarHistorico("osmose");
});
