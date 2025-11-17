document.addEventListener("DOMContentLoaded", async () => {
    const select = document.getElementById("selectReservatorio");
    const ctx = document.getElementById("graficoHistorico").getContext("2d");
    let chart;

    // Capacidades corretas
    const capacidades = {
        "Reservatorio_Elevador": 20000,
        "Reservatorio_Osmose": 200,
        "Reservatorio_CME": 1000,
        "Reservatorio_Abrandada": 9000
    };

    const nomesAmigaveis = {
        "Reservatorio_Elevador_current": "Reservatório Elevador",
        "Reservatorio_Osmose_current": "Reservatório Osmose",
        "Reservatorio_CME_current": "Reservatório CME",
        "Reservatorio_Abrandada_current": "Reservatório Abrandada",
        "Reservatorio_Agua_Abrandada_current": "Reservatório Abrandada"
    };


    // --- 1) Carregar lista de reservatórios ---
    async function carregarListaReservatorios() {
        try {
            const resposta = await fetch("/historico");
            const dados = await resposta.json();

            if (!dados || dados.length === 0) {
                alert("Nenhum dado encontrado.");
                return;
            }

            const nomes = Object.keys(dados[0])
                .filter(k =>
                    k.toLowerCase().startsWith("reservatorio") &&
                    k.endsWith("_current")
                );

            select.innerHTML = "";
            nomes.forEach(nome => {
                const label = nomesAmigaveis[nome] || nome;
                select.innerHTML += `<option value="${nome}">${label}</option>`;
            });

            carregarHistorico(nomes[0]);

        } catch (erro) {
            console.error("Erro ao carregar lista:", erro);
        }
    }


    // --- 2) Carregar histórico do reservatório ---
    async function carregarHistorico(reservatorio) {
        try {
            const resposta = await fetch("/historico");
            const dados = await resposta.json();

            const registros = dados.map(item => ({
                data: item.timestamp,
                litros: item[reservatorio]
            })).filter(r => r.litros !== undefined);

            const nomeCapacidade = reservatorio.replace("_current", "");
            const capacidade = capacidades[nomeCapacidade] || 100;

            const datas = registros.map(r => formatarData(r.data));
            const litros = registros.map(r => Number(r.litros));

            // Valores de máximo, mínimo e média
            const maximo = Math.max(...litros);
            const minimo = Math.min(...litros);
            const media = litros.reduce((a, b) => a + b, 0) / litros.length;

            // Linha de alerta (30% da capacidade)
            const alerta = capacidade * 0.30;

            // Criar linhas horizontais
            const linhaMax = Array(litros.length).fill(maximo);
            const linhaMin = Array(litros.length).fill(minimo);
            const linhaMedia = Array(litros.length).fill(media);
            const linhaAlerta = Array(litros.length).fill(alerta);

            if (chart) chart.destroy();

            chart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: datas,
                    datasets: [
                        {
                            label: nomesAmigaveis[reservatorio] || reservatorio,
                            data: litros,
                            borderColor: "#2c8b7d",
                            borderWidth: 2,
                            tension: 0.3
                        },
                        {
                            label: "Máximo",
                            data: linhaMax,
                            borderColor: "green",
                            borderWidth: 1,
                            borderDash: [6, 6],
                        },
                        {
                            label: "Mínimo",
                            data: linhaMin,
                            borderColor: "orange",
                            borderWidth: 1,
                            borderDash: [6, 6],
                        },
                        {
                            label: "Média",
                            data: linhaMedia,
                            borderColor: "blue",
                            borderWidth: 1,
                            borderDash: [4, 4],
                        },
                        {
                            label: "Alerta (30%)",
                            data: linhaAlerta,
                            borderColor: "red",
                            borderWidth: 2,
                            borderDash: [10, 5],
                        }
                    ]
                },
                options: {
                    plugins: {
                        legend: { position: "bottom" }
                    }
                }
            });

            // TABELA
            const tbody = document.querySelector("#tabelaHistorico tbody");
            tbody.innerHTML = "";

            registros.forEach((registro, i) => {
                const percentual = ((litros[i] / capacidade) * 100).toFixed(1);

                tbody.innerHTML += `
                    <tr>
                        <td>${datas[i]}</td>
                        <td>${litros[i]} L</td>
                        <td>${percentual}%</td>
                    </tr>
                `;
            });

        } catch (erro) {
            console.error("Erro ao carregar histórico:", erro);
        }
    }


    function formatarData(dt) {
        return new Date(dt).toLocaleString("pt-BR");
    }

    select.addEventListener("change", () => {
        carregarHistorico(select.value);
    });

    carregarListaReservatorios();
});
