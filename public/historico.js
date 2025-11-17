document.addEventListener("DOMContentLoaded", async () => {
    const select = document.getElementById("selectReservatorio");
    const ctx = document.getElementById("graficoHistorico").getContext("2d");
    let chart;

    // Capacidades corretas informadas por você
    const capacidades = {
        "Reservatorio_elevador": 20000,
        "RESERVATORIO_Osmose": 200,
        "RESERVATORIO_CME": 1000,
        "RESERVATORIO_Abrandada": 9000
    };

    // --- 1) Buscar histórico completo e extrair nomes automaticamente ---
    async function carregarListaReservatorios() {
        try {
            const resposta = await fetch("/historico");
            const dados = await resposta.json();

            if (!dados || dados.length === 0) {
                alert("Nenhum dado encontrado.");
                return;
            }

            // Extrair nomes dos campos terminados em "_current"
            const nomes = Object.keys(dados[0])
                .filter(k => k.includes("_current"));

            // Preencher SELECT
            select.innerHTML = "";
            nomes.forEach(nome => {
                select.innerHTML += `<option value="${nome}">${nome}</option>`;
            });

            // Carregar o primeiro reservatório automaticamente
            carregarHistorico(nomes[0]);

        } catch (erro) {
            console.error("Erro ao carregar lista:", erro);
        }
    }

    // --- 2) Carregar histórico do reservatório selecionado ---
    async function carregarHistorico(reservatorio) {
        try {
            const resposta = await fetch("/historico");
            const dados = await resposta.json();

            const registros = dados.map(item => ({
                data: item.timestamp,
                litros: item[reservatorio]
            })).filter(r => r.litros !== undefined);

            const capacidade = capacidades[reservatorio] || 100; // padrão

            const datas = registros.map(r => formatarData(r.data));
            const litros = registros.map(r => Number(r.litros));
            const percentuais = litros.map(v => ((v / capacidade) * 100).toFixed(1));

            // --- gráfico ---
            if (chart) chart.destroy();

            chart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: datas,
                    datasets: [{
                        label: reservatorio,
                        data: litros,
                        borderColor: "#2c8b7d",
                        borderWidth: 2,
                        tension: 0.3
                    }]
                }
            });

            // --- tabela ---
            const tbody = document.querySelector("#tabelaHistorico tbody");
            tbody.innerHTML = "";

            registros.forEach((registro, i) => {
                tbody.innerHTML += `
                    <tr>
                        <td>${datas[i]}</td>
                        <td>${litros[i]} L</td>
                        <td>${percentuais[i]}%</td>
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

    // Troca no SELECT
    select.addEventListener("change", () => {
        carregarHistorico(select.value);
    });

    // Inicializa o sistema
    carregarListaReservatorios();
});
