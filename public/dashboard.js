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
    renderReservatorios(d.reservatorios || []);
    renderPressao(d.pressoes || []);
    renderBombas(d.bombas || []);
}

// ========================= ALERTA DE NÍVEL BAIXO =========================
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
    const alertaBox = document.getElementById("alerta-nivelbaixo");

    limparAlertaNivel();

    const frag = document.createDocumentFragment();
    let alertas40 = []; // lista de reservatórios abaixo de 40%

    lista.forEach(r => {
        const percent = r.percent || 0;

        // ---- ALERTA SONORO E COLETA ALERTA VISUAL <= 40% ----
        if (percent <= 40 && manutencao[r.setor] !== true) {
            if (!alertaAtivo[r.setor]) {
                bipCurto();
                alertaAtivo[r.setor] = true;
            }
            alertas40.push(`${r.nome} (${percent}%)`);
        } else {
            alertaAtivo[r.setor] = false;
        }

        const card = document.createElement("div");
        card.className = "card-reservatorio";

        // ---- Estado de nível (cores) ----
        if (percent <= 30) card.classList.add("nv-critico");
        else if (percent <= 60) card.classList.add("nv-alerta");
        else if (percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        if (percent <= 10 && manutencao[r.setor] !== true) {
            card.classList.add("piscar-perigo");
        }

        const emManut = manutencao[r.setor] === true;
        if (emManut) card.classList.add("manutencao");

        const msgMan = emManut ? `<div class="msg-manutencao">🔧 EM MANUTENÇÃO</div>` : "";

        card.innerHTML = `
            <div class="top-bar">
                <h3>${r.nome}</h3>
                <button class="gear-btn" onclick="toggleManutencao('${r.setor}')">⚙</button>
            </div>

            <div class="tanque-visu">
                <div class="nivel-agua" style="height:${percent}%"></div>
                <div class="overlay-info">
                    <div class="percent-text">${percent}%</div>
                    <div class="liters-text">${r.current_liters || 0} L</div>
                </div>
            </div>

            ${msgMan}

            <button onclick="abrirHistorico('${r.setor}')">📊 Histórico</button>
            <p>Capacidade: ${r.capacidade || 0} L</p>
        `;

        frag.appendChild(card);
    });

    box.innerHTML = "";
    box.appendChild(frag);

    // ---- EXIBE ALERTA VISUAL COM TODOS ABAIXO DE 40% ----
    if (alertas40.length && alertaBox) {
        alertaBox.style.display = "block";
        alertaBox.innerHTML = `⚠️ Reservatórios abaixo de 40%: <b>${alertas40.join(", ")}</b>`;
    }
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
        if (!span) return;

        // ✅ Valor seguro para evitar TypeError
        const valor = (typeof p.pressao === "number") ? p.pressao : 0;
        span.textContent = valor.toFixed(2);
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

        const status = document.getElementById(`b${i + 1}Status`);
        const ciclos = document.getElementById(`b${i + 1}Ciclos`);
        if (status) status.textContent = b.estado || "desligada";
        if (ciclos) ciclos.textContent = b.ciclo || 0;
    });
}
