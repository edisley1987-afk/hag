// ======================= CONFIG ===========================
const API_URL = "/dados";
const UPDATE_INTERVAL = 5000;

// Capacidade dos reservatórios
const RESERVATORIOS = {
    Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
    Reservatorio_Osmose_current: { nome: "Reservatório Osmose", capacidade: 200 },
    Reservatorio_CME_current: { nome: "Reservatório CME", capacidade: 1000 },
    Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 9000 },
    Reservatorio_Lavanderia_current: { nome: "Lavanderia", capacidade: 10000 }
};

// Pressões
const PRESSOES = {
    Pressao_Saida_Osmose_current: "Pressão Saída Osmose",
    Pressao_Retorno_Osmose_current: "Pressão Retorno Osmose",
    Pressao_Saida_CME_current: "Pressão Saída CME"
};

// Bombas
const BOMBAS = [
    { id: "Bomba_01", ciclos: "Ciclos_Bomba_01", name: "Bomba 01" },
    { id: "Bomba_02", ciclos: "Ciclos_Bomba_02", name: "Bomba 02" }
];

// ===========================================================

async function carregarDados() {
    try {
        const response = await fetch(API_URL);
        const dados = await response.json();

        atualizarReservatorios(dados);
        atualizarPressoes(dados);
        atualizarBombas(dados);

        document.getElementById("lastUpdate").innerText =
            "Última atualização: " + new Date().toLocaleString();

    } catch (e) {
        console.error("Erro ao carregar dados:", e);
    }
}

function atualizarReservatorios(d) {
    const container = document.getElementById("reservatoriosContainer");
    container.innerHTML = "";

    Object.keys(RESERVATORIOS).forEach(key => {
        const valor = d[key] || 0;
        const cap = RESERVATORIOS[key].capacidade;
        const pct = Math.min(100, Math.round((valor / cap) * 100));

        container.innerHTML += `
            <div class="card-reservatorio">
                <div class="barra" style="height:${pct}%"></div>
                <div class="texto">
                    <h3>${RESERVATORIOS[key].nome}</h3>
                    <p class="pct">${pct}%</p>
                    <p class="litros">${valor} L</p>
                    <a href="historico.html?res=${key}" class="btnHistorico">📊 Histórico</a>
                </div>
            </div>
        `;
    });
}

function atualizarPressoes(d) {
    const container = document.getElementById("pressoesContainer");
    container.innerHTML = "";

    Object.keys(PRESSOES).forEach(key => {
        const valor = d[key] || 0;

        container.innerHTML += `
            <div class="card-pressao">
                <h3>${PRESSOES[key]}</h3>
                <p class="valor">${valor}</p>
                <p class="unidade">bar</p>
            </div>
        `;
    });
}

function atualizarBombas(d) {
    const container = document.getElementById("bombasContainer");
    container.innerHTML = "";

    const ciclos1 = d["Ciclos_Bomba_01"] || 0;
    const ciclos2 = d["Ciclos_Bomba_02"] || 0;

    const diff = Math.abs(ciclos1 - ciclos2);
    const mostrarAlerta = diff > 2; // ALERTA SOMENTE SE DIFERENÇA > 2

    BOMBAS.forEach(b => {
        const ligado = d[b.id] == 1;
        const ciclos = d[b.ciclos] || 0;

        container.innerHTML += `
            <div class="card-bomba ${ligado ? "ligada" : ""}">
                <h3>${b.name}</h3>
                <p>Status: <b>${ligado ? "ligada" : "desligada"}</b></p>
                <p>Ciclos: ${ciclos}</p>
                ${
                    mostrarAlerta
                    ? `<div class="alerta">⚠ Diferença de ciclos detectada (${diff})</div>`
                    : ""
                }
            </div>
        `;
    });
}

setInterval(carregarDados, UPDATE_INTERVAL);
carregarDados();
