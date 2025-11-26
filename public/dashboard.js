// ====== CONFIG ======
const API_URL = "/api/dados"; // ajuste se necessário
const INTERVALO_ATUALIZACAO = 5000; // 5s
const LIMITE_ATRASO = 10 * 60 * 1000; // 10 minutos

let ultimoUpdate = null;

// ====== Carregar último estado salvo ======
let cacheDados = JSON.parse(localStorage.getItem("dados_hag")) || {
    reservatorios: {},
    pressoes: {},
    bombas: {}
};

// ====================== FUNÇÃO PRINCIPAL ======================
async function atualizarDados() {
    try {
        const req = await fetch(API_URL, { cache: "no-store" });
        if (!req.ok) throw new Error("Falha ao obter dados");

        const data = await req.json();
        ultimoUpdate = Date.now();

        // Salva os dados recebidos para manter em tela quando faltar atualização
        cacheDados = data;
        localStorage.setItem("dados_hag", JSON.stringify(data));

        renderizarDashboard(data);

    } catch (e) {
        console.warn("⚠ Falha ao atualizar — exibindo última leitura salva");
        renderizarDashboard(cacheDados); // usa último valor salvo
    }

    verificarAtraso();
}

// ====================== RENDERIZAÇÃO ======================
function renderizarDashboard(data) {
    renderReservatorios(data.reservatorios);
    renderPessoas(data.pressoes);
    renderBombas(data.bombas);
}

// ====================== RESERVATÓRIOS ======================
function renderReservatorios(items = {}) {
    const container = document.getElementById("reservatoriosContainer");
    container.innerHTML = "";

    Object.keys(items).forEach(nome => {
        const r = items[nome];
        const nivel = ((r.atual / r.capacidade) * 100).toFixed(0);
        const manutencao = r.manutencao === true;

        // comportamento solicitado:
        // ✔ abaixo de 30% alerta
        // ✔ se manutenção e chegar 31%, retira manutenção e volta verde
        let alerta = nivel < 30;
        if (manutencao && nivel >= 31) r.manutencao = false;

        const cor = manutencao ? "#b8b8b8"
                : alerta ? "#e05252"
                : "#1da67a";

        const card = document.createElement("div");
        card.className = "card-reservatorio";
        card.style.borderColor = cor;

        card.innerHTML = `
            <h3>${nome}</h3>
            <div class="grafico" style="background:${cor}22">
                <strong>${nivel}%</strong><br>${r.atual} L
            </div>

            ${manutencao ? "" : alerta ? `<div class='alerta'>⚠ Nível < 30%</div>` : ""}

            <label>
                <input type="checkbox" ${manutencao ? "checked" : ""} 
                    onclick="toggleManutencao('${nome}')">
                Em manutenção
            </label><br>

            Capacidade: ${r.capacidade} L
        `;

        container.appendChild(card);
    });
}

// controle manual do checkbox
function toggleManutencao(nome) {
    cacheDados.reservatorios[nome].manutencao =
        !cacheDados.reservatorios[nome].manutencao;

    localStorage.setItem("dados_hag", JSON.stringify(cacheDados));
    renderReservatorios(cacheDados.reservatorios);
}

// ====================== PRESSÕES ======================
function renderPessoas(p = {}) {
    document.getElementById("pressoesContainer").innerHTML = `
        ${criaPressao("Pressão Saída Osmose", p.saida_osmose)}
        ${criaPressao("Pressão Retorno Osmose", p.retorno_osmose)}
        ${criaPressao("Pressão Saída CME", p.saida_cme)}
    `;
}

function criaPressao(titulo, valor="--") {
    return `
        <div class="card-pressao">
            <h3>${titulo}</h3>
            <strong>${valor}</strong><br>bar
        </div>
    `;
}

// ====================== BOMBAS ======================
function renderBombas(b = {}) {
    const container = document.getElementById("bombasContainer");
    container.innerHTML = "";
    Object.keys(b).forEach(nome=>{
        const i=b[nome];
        container.innerHTML+=`
        <div class="card-bomba">
            <h3>${nome}</h3>
            Status: ${i.status || "--"}<br>
            Ciclos: ${i.ciclos || "--"}<br>
            Tempo ligada: ${i.tempo || "--"}<br>
            Último ON: ${i.ultimo || "--"}<br>
        </div>`;
    });
}

// ====================== ALERTA DE ATRASO ======================
function verificarAtraso() {
    const aviso = document.getElementById("aviso-atraso");
    if (!ultimoUpdate) return;

    const diff = Date.now() - ultimoUpdate;
    aviso.style.display = diff > LIMITE_ATRASO ? "block" : "none";
}

// ============ LOOP ============
atualizarDados();
setInterval(atualizarDados, INTERVALO_ATUALIZACAO);
