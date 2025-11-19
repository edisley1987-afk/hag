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

            // ============================================
            // TRATAMENTO UNIVERSAL DO OBJETO RETORNADO
            // ============================================
            const dias = Array.isArray(dados?.dias) ? dados.dias : [];

            if (!dias.length) {
                console.warn("Nenhum dado encontrado para este reservatório.");
                atualizarCardUltimaLeitura(null);
                atualizarGrafico([], []);
                return;
            }

            // Ordena por data crescente
            dias.sort((a, b) => new Date(a.data) - new Date(b.data));

            // Labels e valores
            const labels = dias.map(d => d.data);

            const valores = dias.map(d => {
                const ultimo = d.pontos?.at(-1);
                return ultimo ? Number(ultimo.valor) : 0;
            });

            atualizarCardUltimaLeitura(dias.at(-1));
            atualizarGrafico(labels, valores);

        } catch (erro) {
            console.error("Erro ao carregar histórico:", erro);
        }
    }

    // ============================================================
    // CARD DA ÚLTIMA LEITURA (aparece acima do gráfico)
    // ============================================================
    function atualizarCardUltimaLeitura(registro) {
        const div = document.getElementById("history-cards");

        if (!registro) {
            div.innerHTML = `
                <div class="card card-alerta">
                    <p>Nenhuma leitura encontrada para este reservatório.</p>
                </div>
            `;
            return;
        }

        const ultimoPonto = registro.pontos?.at(-1);

        div.innerHTML = `
            <div class="card card-info">
                <h3>Última Leitura</h3>
                <p><strong>Data:</strong> ${registro.data}</p>
                <p><strong>Hora:</strong> ${ultimoPonto?.hora || "--:--"}</p>
                <p><strong>Nível:</strong> ${ultimoPonto?.valor ?? "-"}%</p>
            </div>
        `;
    }

    // ============================================================
    // GRÁFICO
    // ============================================================
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
                        borderColor: "#2c8b7d",
                        backgroundColor: "rgba(44, 139, 125, 0.3)",
                        pointRadius: 5,
                        tension: 0.35
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

    // Evento no select
    select.addEventListener("change", carregarHistorico);

    // Torna global (chamado pelo HTML)
    window.carregarHistorico = carregarHistorico;

    // Executa ao carregar a página
    carregarHistorico();
});
