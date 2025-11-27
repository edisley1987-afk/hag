// === dashboard.js ===
// Exibe leituras em tempo real com nível visual (caixa d'água)

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;
let ultimaLeitura = 0;

// Configuração dos reservatórios (em litros)
const RESERVATORIOS = {
    Reservatorio_Elevador_current: {
        nome: "Reservatório Elevador",
        capacidade: 20000,
        idNivel: "nivelElevador",
        idValor: "valorElevador"
    },
    Reservatorio_Abrandada_current: {
        nome: "Reservatório Abrandada",
        capacidade: 5000,
        idNivel: "nivelAbrandada",
        idValor: "valorAbrandada"
    },
    Reservatorio_CME_current: {
        nome: "Reservatório CME",
        capacidade: 5000,
        idNivel: "nivelCME",
        idValor: "valorCME"
    },
    Reservatorio_Osmose_current: {
        nome: "Reservatório Osmose",
        capacidade: 200,
        idNivel: "nivelOsmose",
        idValor: "valorOsmose"
    }
};

// Bombas (as duas estão no mesmo NIT e agora estão no plural)
const BOMBAS = {
    bombaAbrandada: {
        ids: ["Bomba_Abrandada_1", "Bomba_Abrandada_2"],
        idStatus: "statusBombaAbrandada"
    },
    bombaElevador: {
        ids: ["Bomba_Elevador_1", "Bomba_Elevador_2"],
        idStatus: "statusBombaElevador"
    },
    bombaCME: {
        ids: ["Bomba_CME_1", "Bomba_CME_2"],
        idStatus: "statusBombaCME"
    },
    bombaOsmose: {
        ids: ["Bomba_Osmose_1", "Bomba_Osmose_2"],
        idStatus: "statusBombaOsmose"
    }
};

// Pressões
const PRESSOES = {
    Pressao_Saida_CME_current: "valorPressaoCME",
    Pressao_Retorno_Osmose_current: "valorPressaoRetornoOsmose",
    Pressao_Saida_Osmose_current: "valorPressaoSaidaOsmose"
};

// Função principal: atualiza tudo
async function atualizarDados() {
    try {
        const resposta = await fetch(API_URL);
        const dados = await resposta.json();

        if (!dados || typeof dados !== "object") return;

        // Atualiza reservatórios
        for (const key in RESERVATORIOS) {
            if (dados[key] !== undefined) {
                atualizarReservatorio(key, dados[key]);
            }
        }

        // Atualiza pressões
        for (const key in PRESSOES) {
            if (dados[key] !== undefined) {
                document.getElementById(PRESSOES[key]).innerText = dados[key] + " bar";
            }
        }

        // Atualiza bombas (duas por setor)
        for (const key in BOMBAS) {
            atualizarBombas(BOMBAS[key], dados);
        }

        // Horário da última atualização
        const agora = new Date();
        document.getElementById("lastUpdate").innerText =
            agora.toLocaleTimeString("pt-BR") + " — atualizado";

    } catch (erro) {
        console.error("Erro ao atualizar dados:", erro);
        document.getElementById("lastUpdate").innerText = "Erro ao atualizar...";
    }
}

// Atualiza visual de um reservatório
function atualizarReservatorio(key, valor) {
    const res = RESERVATORIOS[key];
    if (!res) return;

    const percentual = Math.min(100, Math.max(0, (valor / res.capacidade) * 100));

    document.getElementById(res.idValor).innerText = `${valor} L (${percentual.toFixed(1)}%)`;
    document.getElementById(res.idNivel).style.height = percentual + "%";
}

// Atualiza duas bombas (ligada/desligada)
function atualizarBombas(config, dados) {
    let ligada = false;

    config.ids.forEach(id => {
        if (dados[id] !== undefined && dados[id] == 1) ligada = true;
    });

    const elemento = document.getElementById(config.idStatus);

    if (ligada) {
        elemento.innerText = "Ligada";
        elemento.classList.add("ligada");
        elemento.classList.remove("desligada");
    } else {
        elemento.innerText = "Desligada";
        elemento.classList.add("desligada");
        elemento.classList.remove("ligada");
    }
}

// Atualização periódica
setInterval(atualizarDados, UPDATE_INTERVAL);
atualizarDados();
