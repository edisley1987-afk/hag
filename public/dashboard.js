// ========================= CONFIG =========================
const API = "/api/dashboard";

// Carregar manutenção salva
let manutencao = JSON.parse(localStorage.getItem("manutencao")) || {};
let alertaAtivo = {};


// ========================= LOOP PRINCIPAL =========================
async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw 0;

        const dados = await r.json();

        render(dados);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date().toLocaleTimeString();

    } catch (e) {
        console.error("Erro ao atualizar dados:", e);
        document.getElementById("lastUpdate").textContent =
            "Erro ao atualizar…";
    }
}

setInterval(atualizar, 5000);
atualizar();


// ========================= SOM =========================
function bipCurto() {
    const audio = new Audio("bip.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
}


// ========================= CONTROLLER (RENDER) =========================
function render(d) {
    renderReservatorios(d.reservatorios);
    renderPressao(d.pressoes);
    renderBombas(d.bombas);
}



// ========================= ALERTA DE NÍVEL BAIXO =========================
function exibirAlertaNivel(nome, porcentagem) {
    const box = document.getElementById("alerta-nivelbaixo");
    if (!box) return;

    box.style.display = "block";
    box.innerHTML = `⚠️ O reservatório <b>${nome}</b> está com nível crítico (${porcentagem}%)`;
}

function limparAlertaNivel() {
    const box = document.getElementById("alerta-nivelbaixo");
    if (box) {
        box.style.display = "none";
        box.innerHTML = "";
    }
}



// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
    const box = document.getElementById("reservatoriosContainer");

    // limpar alerta sempre antes de recalcular
    limparAlertaNivel();

    const frag = document.createDocumentFragment();

    lista.forEach(r => {

        // ---- ALERTA DE NÍVEL BAIXO (<= 10%) ----
        if (r.percent <= 10 && !manutencao[r.setor]) {
            exibirAlertaNivel(r.nome, r.percent);
        }

        // REMOVE manutenção automática se subir acima de 41%
        if (manutencao[r.setor] && r.percent >= 41) {
            manutencao[r.setor] = false;
            salvarManutencao();
        }

        const card = document.createElement("div");
        card.className = "card-reservatorio";

        // ---- Estado de nível (cores) ----
        if (r.percent <= 30) card.classList.add("nv-critico");
        else if (r.percent <= 60) card.classList.add("nv-alerta");
        else if (r.percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        // ---- ALERTA 40% (bip) ----
        if (r.percent <= 40 && !manutencao[r.setor]) {
            if (!alertaAtivo[r.setor]) {
                bipCurto();
                alertaAtivo[r.setor] = true;
            }
        } else {
            alertaAtivo[r.setor] = false;
        }

        // ---- Manutenção ----
        const emManut = manutencao[r.setor] === true;
        const msgMan = emManut ? `<div class="msg-manutencao">🔧 EM MANUTENÇÃO</div>` : "";
        if (emManut) card.classList.add("manutencao");

        // ---- HTML ----
        card.innerHTML = `
            <div class="top-bar">
                <h3>${r.nome}</h3>
                <button class="gear-btn" onclick="toggleManutencao('${r.setor}')">⚙</button>
            </div>

            <div class="tanque-visu">
                <div class="nivel-agua" style="height:${r.percent}%"></div>
                <div class="overlay-info">
                    <div class="percent-text">${r.percent}%</div>
                    <div class="liters-text">${r.current_liters} L</div>
                </div>
            </div>

            ${msgMan}

            <button onclick="abrirHistorico('${r.setor}')">📊 Histórico</button>
            <p>Capacidade: ${r.capacidade} L</p>
        `;

        frag.appendChild(card);
    });

    box.innerHTML = "";
    box.appendChild(frag);
}



// ========================= MANUTENÇÃO =========================
function toggleManutencao(setor) {
    manutencao[setor] = !manutencao[setor];
    salvarManutencao();
}

function salvarManutencao() {
    localStorage.setItem("manutencao", JSON.stringify(manutencao));
}

function abrirHistorico(setor) {
    location.href = `/historico.html?setor=${setor}`;
}



// ========================= PRESSÕES =========================
function renderPressao(lista) {
    const mapa = {
        "saida_osmose": "pSaidaOsmose",
        "retorno_osmose": "pRetornoOsmose",
        "saida_cme": "pSaidaCME"
    };

    lista.forEach(p => {
        const id = mapa[p.setor];
        const span = document.getElementById(id);
        if (span) span.textContent = p.pressao.toFixed(2);
    });
}



// ========================= BOMBAS =========================
function renderBombas(lista) {
    lista.forEach((b, i) => {
        const id = `bomba${i + 1}`;
        const el = document.getElementById(id);

        if (!el) return;

        const ligada = b.estado_num === 1;

        el.classList.toggle("bomba-ligada", ligada);
        el.classList.toggle("bomba-desligada", !ligada);

        document.getElementById(`b${i + 1}Status`).textContent = b.estado;
        document.getElementById(`b${i + 1}Ciclos`).textContent = b.ciclo;
    });
}
