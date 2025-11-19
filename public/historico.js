// === CONFIGURAÇÕES ===
const API_URL = "https://hag-9ki9.onrender.com"; // seu servidor Render

// Reservatórios e seus volumes máximos
const RESERVATORIOS = {
    elevador: 20000,
    osmose: 200,
    cme: 5000,
    abrandada: 9000
};

// === ELEMENTOS DA TELA ===
const selectReservatorio = document.getElementById("reservatorioSelect");
const ctx = document.getElementById("graficoHistorico");

// Variáveis globais do gráfico
let grafico = null;
let ultimoNivel = null;

// === FUNÇÃO PRINCIPAL ===
async function carregarHistorico() {
    const reservatorio = selectReservatorio.value;
    const volumeMax = RESERVATORIOS[reservatorio];

    try {
        const response = await fetch(`${API_URL}/historico/listar/${reservatorio}`);
        if (!response.ok) throw new Error("Erro ao buscar histórico");

        const dados = await response.json();

        // Converte para porcentagem
        const labels = dados.map(item =>
            new Date(item.data_hora).toLocaleString("pt-BR")
        );

        const valores = dados.map(item =>
            Number(((item.nivel / volumeMax) * 100).toFixed(2))
        );

        montarGrafico(labels, valores);
        ultimoNivel = valores[valores.length - 1] || null;

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
}

// === MONTAR GRÁFICO ===
function montarGrafico(labels, valores) {
    if (grafico) grafico.destroy();

    // Gerar linha de tendência (regressão linear)
    const trend = gerarTrendline(valores);

    grafico = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Nível (%)",
                    data: valores,
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: "Tendência",
                    data: trend,
                    borderWidth: 2,
                    borderDash: [6, 6],
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

// === TRENDLINE (Regressão Linear Simples) ===
function gerarTrendline(valores) {
    const n = valores.length;
    if (n < 2) return valores.map(() => null);

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    valores.forEach((y, x) => {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    });

    const mediaX = sumX / n;
    const mediaY = sumY / n;

    const b = (sumXY - n * mediaX * mediaY) / (sumXX - n * mediaX * mediaX);
    const a = mediaY - b * mediaX;

    return valores.map((_, x) => Number((a + b * x).toFixed(2)));
}

// === MONITORAR ATUALIZAÇÕES EM TEMPO REAL ===
async function monitorarAtualizacoes() {
    setInterval(async () => {
        const reservatorio = selectReservatorio.value;
        const volumeMax = RESERVATORIOS[reservatorio];

        try {
            const resp = await fetch(`${API_URL}/nivel/${reservatorio}`);
            if (!resp.ok) return;

            const dado = await resp.json();
            const nivelAtual = Number(((dado.nivel / volumeMax) * 100).toFixed(2));

            if (ultimoNivel === null) {
                ultimoNivel = nivelAtual;
                return;
            }

            const diferenca = Math.abs(nivelAtual - ultimoNivel);

            // Grava no histórico somente se variou +5%
            if (diferenca >= 5) {
                await registrarHistorico(reservatorio, dado.nivel);
                await carregarHistorico();
                ultimoNivel = nivelAtual;
            }

        } catch (error) {
            console.error("Erro no monitoramento:", error);
        }

    }, 5000); // Atualiza a cada 5 segundos
}

// === GRAVAR HISTÓRICO NO SERVIDOR ===
async function registrarHistorico(reservatorio, nivel) {
    try {
        await fetch(`${API_URL}/historico/registrar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                reservatorio,
                nivel,
                data_hora: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error("Erro ao salvar histórico:", error);
    }
}

// === EVENTOS ===
selectReservatorio.addEventListener("change", carregarHistorico);

// === INICIAR ===
carregarHistorico();
monitorarAtualizacoes();
