document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("reservatorioSelect");
    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    let grafico = null;

    async function carregarHistorico() {
        try {
            const reservatorio = select.value;
            const url = `/historico/listar/${reservatorio}`;

            const resp = await fetch(url);

            if (!resp.ok) {
                throw new Error(`Erro HTTP ${resp.status}`);
            }

            const dados = await resp.json();

            console.log("Recebido da API:", dados);

            // ================================
            // CORREÇÃO PRINCIPAL 
            // API retorna: { reservatorio, dias:[...] }
            // ================================
            const dias = Array.isArray(dados.dias) ? dados.dias : [];

            if (!dias.length) {
                console.warn("Nenhum dado encontrado.");
                atualizarGrafico([], []);
                return;
            }

            // Ordena por data
            dias.sort((a, b) => new Date(a.data) - new Date(b.data));

            const labels = dias.map(d => d.data);
            const valores = dias.map(d => {
                if (d.pontos && d.pontos.length) {
                    return d.pontos[d.pontos.length - 1].valor;
                }
                return 0;
            });

            atualizarGrafico(labels, valores);

        } catch (erro) {
            console.error("Erro ao carregar histórico:", erro);
        }
    }

    function atualizarGrafico(labels, valores) {
        if (grafico) {
            grafico.destroy();
        }

        grafico = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Nível (%)",
                        data: valores,
                        borderWidth: 3,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 100
                    }
                }
            }
        });
    }

    select.addEventListener("change", carregarHistorico);

// === Torna a função global ===
window.carregarHistorico = carregarHistorico;

    carregarHistorico(); // Carrega ao abrir a página
});
