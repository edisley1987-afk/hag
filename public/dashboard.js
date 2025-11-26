// === dashboard.js (completo e atualizado) ===

// URL da API
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

let ultimaLeitura = 0;

// Configuração dos reservatórios (capacidades)
const RESERVATORIOS = {
    Reservatorio_Agua_Abrandada_current: { nome: "Água Abrandada", capacidade: 5000 },
    Reservatorio_Elevador_current: { nome: "Elevador", capacidade: 20000 },
    Reservatorio_CME_current: { nome: "CME", capacidade: 5000 },
    Reservatorio_Osmose_current: { nome: "Osmose", capacidade: 200 },
};

// Dados internos para ciclos
let estadoAnterior = {
    bomba1: null,
    bomba2: null
};

let ciclos = {
    bomba1: 0,
    bomba2: 0
};

let tempoLigada = {
    bomba1: 0,
    bomba2: 0
};

let tempoDesligada = {
    bomba1: 0,
    bomba2: 0
};

let timestampEstado = {
    bomba1: Date.now(),
    bomba2: Date.now()
};


// ========================================
// FUNÇÃO PARA ATUALIZAR A TELA
// ========================================
async function atualizarDashboard() {
    try {
        const resp = await fetch(API_URL);
        const dados = await resp.json();

        if (!dados) return;

        // Atualiza reservatórios
        atualizarReservatorios(dados);

        // Atualiza bombas
        atualizarBombas(dados);

    } catch (err) {
        console.error("Erro ao atualizar dashboard:", err);
    }
}


// ========================================
// RESERVATÓRIOS
// ========================================
function atualizarReservatorios(dados) {
    Object.keys(RESERVATORIOS).forEach(key => {
        const elem = document.getElementById(key);
        const barra = document.getElementById(key + "_barra");
        const cap = RESERVATORIOS[key].capacidade;

        if (!elem || !barra) return;

        const valor = dados[key] ?? 0;
        const perc = Math.min(100, Math.max(0, (valor / cap) * 100));

        elem.textContent = `${valor} L`;
        barra.style.height = perc + "%";

        barra.style.background =
            perc < 30 ? "#d9534f" :
            perc < 60 ? "#f0ad4e" :
                        "#4DA492";
    });
}


// ========================================
// BOMBAS (ciclos, cores, estados)
// ========================================
function atualizarBombas(dados) {

    const bombas = [
        { id: "bomba1", estado: dados.Bomba_01_current },
        { id: "bomba2", estado: dados.Bomba_02_current }
    ];

    bombas.forEach(b => {
        const cont = document.getElementById(b.id);

        if (!cont) return;

        // Estado atual
        const ligado = b.estado === 1;
        const estadoTxt = ligado ? "LIGADA" : "DESLIGADA";

        // Detectar mudança de estado
        if (estadoAnterior[b.id] !== null && estadoAnterior[b.id] !== ligado) {
            ciclos[b.id]++;

            const agora = Date.now();
            const duracao = agora - timestampEstado[b.id];

            if (ligado) {
                tempoDesligada[b.id] = duracao;
            } else {
                tempoLigada[b.id] = duracao;
            }

            timestampEstado[b.id] = agora;
        }

        estadoAnterior[b.id] = ligado;

        // aplicar cor: verde quando ligada
        const bg = ligado ? "background:#28a745;color:white;border:2px solid #1e7e34;" : "";

        cont.innerHTML = `
            <div class="card-bomba" style="${bg}">
                <h3>${b.id === "bomba1" ? "Bomba 01" : "Bomba 02"}</h3>
                <p><strong>Estado:</strong> ${estadoTxt}</p>
                <p><strong>Ciclos:</strong> ${ciclos[b.id]}</p>
                <p><strong>Último ciclo ligada:</strong> ${fmtTempo(tempoLigada[b.id])}</p>
                <p><strong>Último ciclo desligada:</strong> ${fmtTempo(tempoDesligada[b.id])}</p>
            </div>
        `;
    });

    validarDiferencaCiclos();
}


// ========================================
// ALERTA DE DIFERENÇA DE CICLOS (> 2)
// ========================================
function validarDiferencaCiclos() {
    const diff = Math.abs(ciclos.bomba1 - ciclos.bomba2);

    const aviso = document.getElementById("aviso-ciclos");

    if (!aviso) return;

    if (diff > 2) {
        aviso.style.display = "block";
        aviso.textContent = `⚠ Diferença de ciclos detectada: ${diff} ciclos`;
    } else {
        aviso.style.display = "none";
    }
}


// ========================================
// FORMATAÇÃO DO TEMPO
// ========================================
function fmtTempo(ms) {
    if (!ms || ms < 1000) return "0m 0s";

    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = s % 60;

    return `${m}m ${ss}s`;
}


// ========================================
// LOOP AUTOMÁTICO
// ========================================
atualizarDashboard();
setInterval(atualizarDashboard, UPDATE_INTERVAL);
