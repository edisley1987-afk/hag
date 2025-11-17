document.addEventListener("DOMContentLoaded", async () => {
    const select = document.getElementById("selectReservatorio");
    const ctx = document.getElementById("graficoHistorico").getContext("2d");
    let chart;

    // Capacidades corretas informadas por você
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


    // --- 1) Buscar histórico completo e extrair nomes automaticamente ---
    async function carregarListaReservatorios() {
        try {
            const resposta = await fetch("/historico");
            const dados = await resposta.json();

            if (!dados || dados.length === 0) {
                alert("Nenhum dado encontrado.");
                return;
            }

            // Extrair apenas campos que são RESERVATÓRIOS
            const nomes = Object.keys(dados[0])
                .filter(k =>
                    k.toLowerCase().startsWith("reservatorio") &&
                    k.endsWith("_current")
                );

            // Preencher SELECT com nomes amigáveis
            select.innerHTML = "";
            nomes.forEach(nome => {
                const label = nomesAmigaveis[nome] || nome;
                select.innerHTML += `<option value="${nome}">${label}</option>`;
            });

            // Carregar primeiro reservatório automaticamente
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

            // Remover "_current" antes de buscar capacidade
            const nomeCapacidade = reservatorio.replace("_current", "");
            const capacidade = capacidades[nomeCapacidade] || 100;

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
                        label: nomesAmigaveis[reservatorio] || reservatorio,
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
