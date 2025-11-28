/* ============================ CONFIG ============================ */
const API_URL = "/dados";   // endpoint vindo do Gateway ITG convertido no servidor
const TEMPO_ATUALIZACAO = 2000;

/* Lista com os reservatórios que existem no dashboard */
const RESERVATORIOS = {
    elevador: { nome: "Elevador", capacidade: 20000 },
    cme: { nome: "CME", capacidade: 5000 },
    abr: { nome: "Abrandada", capacidade: 3200 },
    osmose: { nome: "Osmose", capacidade: 650 },
};

/* ============================ INICIALIZAÇÃO ============================ */
document.addEventListener("DOMContentLoaded", () => {
    carregarReservatorios();
    atualizarDados();
    setInterval(atualizarDados, TEMPO_ATUALIZACAO);
});

/* ============================ CRIAR CARDS ============================ */
function carregarReservatorios() {
    const container = document.getElementById("reservatoriosContainer");
    container.innerHTML = "";

    Object.entries(RESERVATORIOS).forEach(([id, cfg]) => {
        container.innerHTML += `
            <div class="card-reservatorio" id="card-${id}">
                <h3>${cfg.nome}</h3>
                <div class="tanque-visu">
                    <div class="nivel-agua" id="nivel-${id}"></div>
                    <div class="overlay-info">
                        <div class="percent-text" id="pct-${id}">--%</div>
                        <div class="liters-text" id="lit-${id}">-- L</div>
                    </div>
                </div>
            </div>
        `;
    });
}

/* ============================ ATUALIZAR DADOS ============================ */
async function atualizarDados() {
    try {
        const res = await fetch(API_URL);
        const dados = await res.json();

        atualizarReservatorios(dados);
        atualizarPressao(dados);
        atualizarBombas(dados);
        atualizarStatus(dados);

    } catch (err) {
        console.warn("Erro ao atualizar:", err);
    }
}

/* ============================ RESERVATÓRIOS ============================ */
function atualizarReservatorios(dados) {
    const mapa = {
        elevador: dados.Reservatorio_Elevador_current,
        cme: dados.Reservatorio_CME_current,
        abr: dados.Reservatorio_Agua_Abrandada_current,
        osmose: dados.Reservatorio_Osmose_current
    };

    Object.entries(RESERVATORIOS).forEach(([id, cfg]) => {
        const litros = mapa[id];
        if (litros == null) return;

        const pct = Math.min(100, Math.max(0, (litros / cfg.capacidade) * 100));

        document.getElementById(`lit-${id}`).textContent = `${litros} L`;
        document.getElementById(`pct-${id}`).textContent = `${pct.toFixed(0)}%`;

        const nivel = document.getElementById(`nivel-${id}`);
        nivel.style.height = pct + "%";

        const card = document.getElementById(`card-${id}`);
        card.classList.remove("nv-critico", "nv-alerta", "nv-normal", "nv-cheio");

        if (pct <= 10) card.classList.add("nv-critico");
        else if (pct <= 30) card.classList.add("nv-alerta");
        else if (pct < 95) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");
    });
}

/* ============================ PRESSÕES ============================ */
function atualizarPressao(data) {
    const pressCME = document.getElementById("pressao-cme");
    const pressRetorno = document.getElementById("pressao-retorno");
    const pressSaidaOsm = document.getElementById("pressao-osmose");

    if (pressCME) pressCME.textContent = data.Pressao_Saida_CME_current?.toFixed(2) ?? "--";
    if (pressRetorno) pressRetorno.textContent = data.Pressao_Retorno_Osmose_current?.toFixed(2) ?? "--";
    if (pressSaidaOsm) pressSaidaOsm.textContent = data.Pressao_Saida_Osmose_current?.toFixed(2) ?? "--";
}

/* ============================ BOMBAS ============================ */
function atualizarBombas(data) {
    const bombas = [
        { nome: "Bomba 01", id: "b1", status: data.Bomba_01_status, ciclos: data.Bombas_01_counter },
        { nome: "Bomba 02", id: "b2", status: data.Bomba_02_status, ciclos: data.Bombas_02_counter },
    ];

    bombas.forEach(bomba => {
        const card = document.getElementById(`card-${bomba.id}`);
        const ciclosEl = document.getElementById(`ciclos-${bomba.id}`);

        if (!card) return;

        card.classList.remove("bomba-ligada", "bomba-desligada");

        if (bomba.status === 1) {
            card.classList.add("bomba-ligada");
        } else {
            card.classList.add("bomba-desligada");
        }

        if (ciclosEl) ciclosEl.textContent = bomba.ciclos ?? "--";
    });
}

/* ============================ MODO MANUTENÇÃO ============================ */
function atualizarStatus(data) {
    const status = data.status_manutencao;

    const section = document.getElementById("status-sistema");
    const texto = document.getElementById("msg-status");

    if (!section) return;

    if (status === 1) {
        section.classList.add("manutencao");
        texto.textContent = "⚠ Sistema em Modo de Manutenção";
    } else {
        section.classList.remove("manutencao");
        texto.textContent = "";
    }
}
