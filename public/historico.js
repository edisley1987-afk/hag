// === Configuração dos tanques ===
const capacidades = {
    elevador: 20000,
    osmose: 200,
    cme: 5000,
    abrandada: 9000
};

// === Variáveis globais ===
let chartHistorico = null;
let ultimoValorRegistrado = {}; // Armazena último valor salvo para cada reservatório

// === Criar gráfico ===
function criarGrafico() {
    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    chartHistorico = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Nível (%)",
                    data: [],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: "Tendência",
                    data: [],
                    borderDash: [5, 5],
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}

// === Cálculo da linha de tendência (regressão linear simples) ===
function calcularTrendline(labels, values) {
    const n = labels.length;
    if (n < 2) return Array(n).fill(null);

    const x = labels.map((_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    return x.map(i => m * i + b);
}

// === Carregar histórico salvo ===
async function carregarHistorico(reservatorio) {
    const res = await fetch(`/historico/listar/${reservatorio}`);
    const dados = await res.json();

    chartHistorico.data.labels = dados.map(item => item.hora);
    chartHistorico.data.datasets[0].data = dados.map(item => item.nivel);

    chartHistorico.data.datasets[1].data = calcularTrendline(
        chartHistorico.data.labels,
        chartHistorico.data.datasets[0].data
    );

    chartHistorico.update();

    if (dados.length > 0) {
        ultimoValorRegistrado[reservatorio] = dados[dados.length - 1].nivel;
    }
}

// === Salvar novo registro somente se variação > 5% ===
async function tentarRegistrarHistorico(reservatorio, novoValor) {
    let ultimo = ultimoValorRegistrado[reservatorio] ?? null;

    if (ultimo === null || Math.abs(novoValor - ultimo) >= 5) {
        await fetch("/historico/salvar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                reservatorio,
                nivel: novoValor,
                hora: new Date().toLocaleTimeString("pt-BR")
            })
        });

        ultimoValorRegistrado[reservatorio] = novoValor;

        console.log(`Registro salvo (${reservatorio}): ${novoValor}%`);
        carregarHistorico(reservatorio); // Atualiza gráfico automaticamente
    } else {
        console.log(`Mudança menor que 5%, não registrado (${reservatorio})`);
    }
}

// === Atualização em tempo real (via SSE) ===
if (!!window.EventSource) {
    const source = new EventSource("/stream");

    source.addEventListener("nivel", function (e) {
        const dados = JSON.parse(e.data);

        for (const reservatorio in dados) {
            const valorAtual = dados[reservatorio];

            tentarRegistrarHistorico(reservatorio, valorAtual);
        }
    });
}

// === Ao trocar reservatório no select ===
document.getElementById("reservatorioSelect").addEventListener("change", function () {
    carregarHistorico(this.value);
});

// === Inicializar ===
window.onload = function () {
    criarGrafico();
    carregarHistorico("elevador");
};
