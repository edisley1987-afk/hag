const API_URL = window.location.origin;

async function carregarHistorico() {
    try {
        const resp = await fetch(`${API_URL}/historico`);
        const historico = await resp.json();

        if (!Array.isArray(historico)) return;

        const select = document.getElementById("selectReservatorio");
        const ref = select.value;

        const dadosSensor = historico
            .map(h => ({
                hora: new Date(h.timestamp).toLocaleString(),
                valor: h[ref],
                ocupacao: h[ref] ? ((h[ref] / capacidade(ref)) * 100).toFixed(1) : 0
            }))
            .filter(e => e.valor !== undefined);

        atualizarTabela(dadosSensor);
        atualizarGrafico(dadosSensor);

    } catch (err) {
        console.error("Erro ao carregar histórico:", err);
    }
}

function capacidade(ref) {
    const mapa = {
        "Reservatorio_Elevador_current": 20000,
        "Reservatorio_Osmose_current": 200,
        "Reservatorio_CME_current": 1000,
        "Reservatorio_Agua_Abrandada_current": 9000
    };
    return mapa[ref] || 1;
}

function atualizarTabela(lista) {
    const tbody = document.querySelector("#tabelaHistorico tbody");
    tbody.innerHTML = "";

    const dadosOrdenados = [...lista].reverse(); // ⬅ último no topo

    for (const item of dadosOrdenados) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.hora}</td>
            <td>${item.valor}</td>
            <td>${item.ocupacao}%</td>
        `;
        tbody.appendChild(tr);
    }
}

let grafico = null;

function atualizarGrafico(lista) {
    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    if (grafico) grafico.destroy();

    const horas = lista.map(e => e.hora);
    const valores = lista.map(e => e.valor);

    grafico = new Chart(ctx, {
        type: "line",
        data: {
            labels: horas,
            datasets: [{
                label: "Consumo / Leitura",
                data: valores,
                fill: false,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    reverse: true   // HORAS da direita para a esquerda
                }
            }
        }
    });
}

document.getElementById("selectReservatorio").addEventListener("change", carregarHistorico);

carregarHistorico();
setInterval(carregarHistorico, 10000);
