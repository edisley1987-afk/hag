// =========================================================
// 📊 HISTÓRICO PROFISSIONAL HAG
// Versão corrigida e compatível com diferentes formatos
// =========================================================

const API_URL = "/historico";

let grafico = null;


// =========================================================
// 🚀 INICIALIZAÇÃO
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    carregarHistorico();

    // Atualiza automaticamente a cada 60 segundos
    setInterval(carregarHistorico, 60000);

});


// =========================================================
// 📊 CARREGAR HISTÓRICO
// =========================================================

async function carregarHistorico() {

    const container =
        document.getElementById("historico");

    const canvas =
        document.getElementById("graficoHistorico");


    if (!container) {
        console.warn(
            "Elemento #historico não encontrado."
        );
        return;
    }


    container.innerHTML =
        "⏳ Carregando histórico...";


    try {

        const resposta =
            await fetch(
                API_URL + "?t=" + Date.now(),
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );


        // =====================================================
        // VERIFICA HTTP
        // =====================================================

        if (!resposta.ok) {

            throw new Error(
                `Erro HTTP ${resposta.status}`
            );

        }


        // =====================================================
        // VERIFICA CONTENT-TYPE
        // =====================================================

        const contentType =
            resposta.headers.get(
                "content-type"
            ) || "";


        if (
            !contentType.includes(
                "application/json"
            )
        ) {

            const texto =
                await resposta.text();

            console.error(
                "Resposta recebida em /historico:",
                texto.substring(0, 500)
            );


            throw new Error(
                "O servidor não retornou JSON em /historico."
            );

        }


        let dados =
            await resposta.json();


        // =====================================================
        // NORMALIZAR DADOS
        // =====================================================

        dados =
            normalizarHistorico(dados);


        if (!dados.length) {

            container.innerHTML =
                `
                <div class="historico-vazio">
                    📭 Nenhum dado histórico encontrado.
                </div>
                `;

            atualizarConsumos(
                0,
                0,
                0
            );

            return;

        }


        // =====================================================
        // ORDENAR POR DATA
        // =====================================================

        dados.sort(
            (a, b) =>
                obterTimestamp(a) -
                obterTimestamp(b)
        );


        // =====================================================
        // CONSUMO
        // =====================================================

        let consumoElevador = 0;

        let consumoLavanderia = 0;

        let consumoOsmose = 0;


        const ultimoNivel = {};


        // =====================================================
        // TABELA
        // =====================================================

        let html = `

            <div class="historico-tabela-wrapper">

                <table class="tabela-historico">

                    <thead>

                        <tr>

                            <th>Data</th>

                            <th>Reservatório</th>

                            <th>Nível (%)</th>

                            <th>Volume (L)</th>

                        </tr>

                    </thead>

                    <tbody>

        `;


        // =====================================================
        // DATASETS DO GRÁFICO
        // =====================================================

        const datasets = {};


        // =====================================================
        // PROCESSAR DADOS
        // =====================================================

        dados.forEach(p => {

            const reservatorio =
                obterReservatorio(p);


            const timestamp =
                obterTimestamp(p);


            const volume =
                obterVolume(p);


            const percent =
                obterPercentual(p);


            // =================================================
            // CONSUMO
            // =================================================

            if (
                ultimoNivel[reservatorio] !==
                undefined
            ) {

                const diferenca =
                    ultimoNivel[reservatorio] -
                    volume;


                /*
                   Evita considerar:

                   - ruído
                   - reset
                   - valores negativos
                   - grandes saltos
                */

                if (
                    diferenca > 1 &&
                    diferenca < 1000
                ) {

                    if (
                        reservatorio ===
                        "elevador"
                    ) {

                        consumoElevador +=
                            diferenca;

                    }


                    if (
                        reservatorio ===
                        "lavanderia"
                    ) {

                        consumoLavanderia +=
                            diferenca;

                    }


                    if (
                        reservatorio ===
                        "osmose"
                    ) {

                        consumoOsmose +=
                            diferenca;

                    }

                }

            }


            ultimoNivel[reservatorio] =
                volume;


            // =================================================
            // TABELA
            // =================================================

            const dataFormatada =
                new Date(
                    timestamp
                ).toLocaleString(
                    "pt-BR"
                );


            const classeNivel =
                percent < 20
                    ? "nivel-critico"
                    : "";


            html += `

                <tr>

                    <td>
                        ${dataFormatada}
                    </td>

                    <td>
                        ${formatarNome(
                            reservatorio
                        )}
                    </td>

                    <td class="${classeNivel}">
                        ${percent.toFixed(1)}%
                    </td>

                    <td>
                        ${formatarNumero(
                            volume
                        )} L
                    </td>

                </tr>

            `;


            // =================================================
            // GRÁFICO
            // =================================================

            if (
                !datasets[reservatorio]
            ) {

                datasets[reservatorio] =
                    [];

            }


            datasets[
                reservatorio
            ].push({

                x: new Date(timestamp),

                y: percent

            });

        });


        html += `

                    </tbody>

                </table>

            </div>

        `;


        container.innerHTML =
            html;


        // =====================================================
        // ATUALIZAR CONSUMOS
        // =====================================================

        atualizarConsumos(
            consumoElevador,
            consumoLavanderia,
            consumoOsmose
        );


        // =====================================================
        // GRÁFICO
        // =====================================================

        if (canvas) {

            criarGrafico(
                canvas,
                datasets
            );

        }


        // =====================================================
        // HORA DA ATUALIZAÇÃO
        // =====================================================

        const hora =
            document.getElementById(
                "horaHistorico"
            );


        if (hora) {

            hora.innerText =
                new Date()
                    .toLocaleTimeString(
                        "pt-BR"
                    );

        }


    } catch (erro) {

        console.error(
            "Erro ao carregar histórico:",
            erro
        );


        container.innerHTML = `

            <div class="historico-erro">

                ❌ Erro ao carregar histórico.

                <br>

                <small>
                    ${erro.message}
                </small>

            </div>

        `;

    }

}


// =========================================================
// 🔄 NORMALIZAR HISTÓRICO
// =========================================================

function normalizarHistorico(dados) {

    /*
       FORMATO 1:

       Array:

       [
           {
               reservatorio: "elevador",
               timestamp: ...,
               valor: ...
           }
       ]
    */

    if (Array.isArray(dados)) {

        return dados;

    }


    /*
       FORMATO 2:

       Objeto:

       {
           elevador: [...],
           lavanderia: [...],
           osmose: [...]
       }
    */

    if (
        dados &&
        typeof dados === "object"
    ) {

        const resultado = [];


        Object.entries(
            dados
        ).forEach(
            ([reservatorio, valores]) => {

                if (
                    !Array.isArray(
                        valores
                    )
                ) {

                    return;

                }


                valores.forEach(
                    ponto => {

                        /*
                           Mantém objetos já completos.
                        */

                        if (
                            ponto &&
                            typeof ponto ===
                            "object"
                        ) {

                            resultado.push({

                                ...ponto,

                                reservatorio:
                                    ponto.reservatorio ||
                                    reservatorio

                            });

                        }

                    }
                );

            }
        );


        return resultado;

    }


    return [];

}


// =========================================================
// ⏱️ TIMESTAMP
// =========================================================

function obterTimestamp(p) {

    if (
        p.timestamp !==
        undefined
    ) {

        const n =
            Number(
                p.timestamp
            );


        /*
           Timestamp em segundos
           precisa ser convertido
           para milissegundos.
        */

        if (
            Number.isFinite(n)
        ) {

            return n < 10000000000
                ? n * 1000
                : n;

        }

    }


    if (p.data) {

        return new Date(
            p.data
        ).getTime();

    }


    if (p.datetime) {

        return new Date(
            p.datetime
        ).getTime();

    }


    if (p.created_at) {

        return new Date(
            p.created_at
        ).getTime();

    }


    return Date.now();

}


// =========================================================
// 💧 RESERVATÓRIO
// =========================================================

function obterReservatorio(p) {

    const nome =
        String(
            p.reservatorio ||
            p.setor ||
            p.nome ||
            ""
        )
        .toLowerCase()
        .trim();


    /*
       Normalização dos nomes.
    */

    if (
        nome.includes("elevador")
    ) {

        return "elevador";

    }


    if (
        nome.includes("lavanderia")
    ) {

        return "lavanderia";

    }


    if (
        nome.includes("osmose")
    ) {

        return "osmose";

    }


    if (
        nome.includes("cme")
    ) {

        return "cme";

    }


    if (
        nome.includes("abrand")
    ) {

        return "abrandada";

    }


    return nome
        .replace(/\s+/g, "_");

}


// =========================================================
// 📦 VOLUME
// =========================================================

function obterVolume(p) {

    const valor =
        Number(
            p.valor ??
            p.current_liters ??
            p.litros ??
            p.volume ??
            0
        );


    return Number.isFinite(valor)
        ? valor
        : 0;

}


// =========================================================
// 📊 PERCENTUAL
// =========================================================

function obterPercentual(p) {

    const percent =
        Number(
            p.percent ??
            p.percentual ??
            p.nivel ??
            0
        );


    if (
        Number.isFinite(percent)
    ) {

        return Math.min(
            100,
            Math.max(
                0,
                percent
            )
        );

    }


    return 0;

}


// =========================================================
// 📊 ATUALIZAR CONSUMOS
// =========================================================

function atualizarConsumos(
    elevador,
    lavanderia,
    osmose
) {

    setText(
        "consumoElevador",
        elevador
    );


    setText(
        "consumoLavanderia",
        lavanderia
    );


    setText(
        "consumoOsmose",
        osmose
    );


    setText(
        "consumoTotal",

        elevador +
        lavanderia +
        osmose

    );

}


// =========================================================
// 📈 CRIAR GRÁFICO
// =========================================================

function criarGrafico(
    canvas,
    datasets
) {

    if (grafico) {

        grafico.destroy();

        grafico = null;

    }


    const cores = [

        "#00e5ff",

        "#00ff88",

        "#ffd600",

        "#ff9800",

        "#b388ff",

        "#ff5252"

    ];


    const datasetsGrafico =
        Object.entries(
            datasets
        ).map(
            ([nome, valores], index) => {

                return {

                    label:
                        formatarNome(
                            nome
                        ),

                    data:
                        valores.sort(
                            (a, b) =>
                                a.x - b.x
                        ),

                    borderColor:
                        cores[
                            index %
                            cores.length
                        ],

                    backgroundColor:
                        cores[
                            index %
                            cores.length
                        ],

                    tension:
                        0.3,

                    borderWidth:
                        2,

                    pointRadius:
                        1,

                    pointHoverRadius:
                        4,

                    fill:
                        false

                };

            }
        );


    grafico =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    datasets:
                        datasetsGrafico

                },

                options: {

                    parsing: false,

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    animation: false,

                    interaction: {

                        intersect:
                            false,

                        mode:
                            "index"

                    },

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        },

                        title: {

                            display:
                                true,

                            text:
                                "📊 Histórico de Nível (%)"

                        }

                    },

                    scales: {

                        x: {

                            type:
                                "time",

                            time: {

                                unit:
                                    "hour",

                                displayFormats: {

                                    hour:
                                        "HH:mm"

                                }

                            }

                        },

                        y: {

                            beginAtZero:
                                true,

                            min:
                                0,

                            max:
                                100,

                            ticks: {

                                callback:
                                    value =>
                                        value + "%"

                            }

                        }

                    }

                }

            }
        );

}


// =========================================================
// 🔧 FORMATAR NOME
// =========================================================

function formatarNome(nome) {

    return String(
        nome || ""
    )
    .replace(/_/g, " ")
    .replace(
        /reservatorio/gi,
        "Reservatório"
    )
    .replace(
        /agua/gi,
        "Água"
    )
    .replace(
        /\b\w/g,
        letra =>
            letra.toUpperCase()
    )
    .trim();

}


// =========================================================
// 🔢 FORMATAR NÚMERO
// =========================================================

function formatarNumero(n) {

    return Number(
        n || 0
    ).toLocaleString(
        "pt-BR",
        {
            maximumFractionDigits: 2
        }
    );

}


// =========================================================
// 📝 ALTERAR TEXTO
// =========================================================

function setText(
    id,
    valor
) {

    const el =
        document.getElementById(
            id
        );


    if (!el) return;


    el.innerText =
        formatarNumero(
            valor
        ) + " L";

}
