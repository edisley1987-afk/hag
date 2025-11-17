const API_URL = window.location.origin;

// capacidades fixas
const CAPACIDADES = {
    "Reservatorio_Elevador_current": 20000,
    "Reservatorio_Osmose_current": 200,
    "Reservatorio_CME_current": 1000,
    "Reservatorio_Agua_Abrandada_current": 9000
};

async function carregarReservatorios() {
    const select = document.getElementById("selectReservatorio");

    try {
        const resp = await fetch(`${API_URL}/historico/lista`);
        const lista = await resp.json();

        select.innerHTML = `<option value="">Selecione o Reservatório</option>`;

        lista.forEach(r => {
            select.innerHTML += `<option value="${r}">${r.replace(/_/g, " ")}</option>`;
        });

    } catch (err) {
        console.error("Erro ao carregar reservatórios:", err);
        select.innerHTML = `<option value="">Erro ao carregar</option>`;
    }
}

async function carregarHistorico() {
    const r = document.getElementById("selectReservatorio").value;
    if (!r) return;

    try {
        const resp = await fetch(`${API_URL}/historico/${r}`);
        const dados = await resp.json();

        const capacidade = CAPACIDADES[r] || 0;

        const tabela = document.getElementById("tabelaHistorico");
        tabela.innerHTML = "";

        dados.forEach(item => {
            const litros = item.valor;
            const porcentagem = capacidade ? ((litros / capacidade) * 100).toFixed(1) : "-";

            tabela.innerHTML += `
                <tr>
                    <td>${item.horario}</td>
                    <td>${litros} L</td>
                    <td>${porcentagem}%</td>
                </tr>
            `;
        });

        atualizarGrafico(dados, capacidade);

    } catch (err) {
        console.error("Erro ao carregar histórico:", err);
    }
}

let grafico;
function atualizarGrafico(dados, capacidade) {
    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    const labels = dados.map(d => d.horario);
    const litros = dados.map(d => d.valor);
    const porcentagem = dados.map(d => capacidade ? (d.valor / capacidade * 100).toFixed(1) : 0);

    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Litros",
                    data: litros,
                    borderWidth: 2
                },
                {
                    label: "% do Reservatório",
                    data: porcentagem,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarReservatorios();
    document.getElementById("selectReservatorio").addEventListener("change", carregarHistorico);
});
