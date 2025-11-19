document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("reservatorioSelect");
    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    let grafico = null;

    // Capacidades dos reservatórios
    const capacidade = {
        elevador: 10000,
        osmose: 5000,
        cme: 3000,
        abrandada: 9000
    };

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

            const dias = Array.isArray(dados.dias) ? dados.dias : [];

            if (!dias.length) {
                console.warn("Nenhum dado encontrado.");
                atualizarGrafico([], [], []);
                return;
            }

            // Ordena por data
            dias.sort((a, b) => new Date(a.data) - new Date(b.data));

            const labels = dias.map(d => d.data);

            // Último valor de cada dia (litros)
            const valoresLitros = dias.map(d => {
                const ultimo = d.pontos?.at(-1);
                return ultimo ? Number(ultimo.valor) : 0;
            });

            // Cálculo do percentual baseado na capacidade específica
            const capacidadeTotal = capacidade[reservatorio];

            const valoresPercentuais = valoresLitros.map(v =>
                capacidadeTotal ? Number(((v / capacidadeTotal) * 100).toFixed(1)) : 0
            );

            atualizarGrafico(labels, valoresPercentuais, valoresLitros);

        } catch (erro) {
            console.error("Erro ao carregar histórico:", erro);
        }
    }

    function atualizarGrafico(labels, valoresPercentuais, valoresLitros) {
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
                        data: valoresPercentuais,
                        borderWidth: 3,
                        tension: 0.3,
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const i = ctx.dataIndex;
                                const percentual = ctx.raw;
                                const litros = valoresLitros[i];

                                return [
                                    `Nível: ${percentual}%`,
                                    `Litros: ${litros} L`
                                ];
                            }
                        }
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 100,
                        title: {
                            display: true,
                            text: "%"
                        }
                    }
                }
            }
        });
    }

    select.addEventListener("change", carregarHistorico);

    // Deixar função acessível globalmente
    window.carregarHistorico = carregarHistorico;

    // Carrega ao abrir
    carregarHistorico();
});
