// ========================
// HISTORICO.JS COMPLETO
// ========================

// Capacidades fixas dos reservatórios
const CAPACIDADES = {
    "Reservatorio_elevador": 20000,
    "RESERVATORIO_Osmose": 200,
    "RESERVATORIO_CME": 1000,
    "RESERVATORIO_Abrandada": 9000
};

document.addEventListener("DOMContentLoaded", () => {
    carregarReservatorios();
    document.getElementById("selectReservatorio").addEventListener("change", carregarHistorico);
});


// ========================
// CARREGA RESERVATÓRIOS (SEM API)
// ========================
function carregarReservatorios() {
    const select = document.getElementById("selectReservatorio");

    select.innerHTML = `<option value="">Selecione o reservatório</option>`;

    Object.keys(CAPACIDADES).forEach(key => {
        let nome = key.replace(/_/g, " ");
        select.innerHTML += `<option value="${key}">${nome}</option>`;
    });
}


// ========================
// BUSCA HISTÓRICO NO SERVIDOR
// ========================
async function carregarHistorico() {
    const reservatorio = document.getElementById("selectReservatorio").value;
    if (!reservatorio) return;

    try {
        const res = await fetch(`/historico?reservatorio=${reservatorio}`);
        const dados = await res.json();

        if (!Array.isArray(dados) || dados.length === 0) {
            document.getElementById("tabelaBody").innerHTML =
                `<tr><td colspan="4">Nenhum dado disponível</td></tr>`;
            return;
        }

        preencherTabela(dados, reservatorio);
        gerarGrafico(dados, reservatorio);

    } catch (e) {
        console.error("Erro ao carregar histórico", e);
    }
}


// ========================
// PREENCHER TABELA
// ========================
function preencherTabela(lista, reservatorio) {
    const tbody = document.getElementById("tabelaBody");
    tbody.innerHTML = "";

    const capacidade = CAPACIDADES[reservatorio];

    lista.forEach(item => {
        const litros = Number(item.valorLitros || 0);
        const percentual = ((litros / capacidade) * 100).toFixed(1);

        const tr = `
            <tr>
                <td>${item.dataHora}</td>
                <td>${litros}</td>
                <td>${capacidade}</td>
                <td>${percentual}%</td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}


// ========================
// GRÁFICO
// ========================
let grafico;

function gerarGrafico(lista, reservatorio) {
    const capacidade = CAPACIDADES[reservatorio];

    const labels = lista.map(i => i.dataHora);
    const valores = lista.map(i => Number((i.valorLitros / capacidade) * 100).toFixed(1));

    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    if (grafico) grafico.destroy();

    grafico = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "% do reservatório",
                data: valores,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}
