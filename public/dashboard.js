// ========================= CONFIG =========================
const API = "/api/dashboard";

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


// ========================= RENDER =========================
function render(d) {
    renderReservatorios(d.reservatorios);
    renderPressao(d.pressoes);
    renderBombas(d.bombas);
}


// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
    const box = document.getElementById("reservatoriosContainer");
    box.innerHTML = "";

    lista.forEach(r => {
        const card = document.createElement("div");
        card.className = "card-reservatorio";

        if (r.percent <= 30) card.classList.add("nv-critico");
        else if (r.percent <= 60) card.classList.add("nv-alerta");
        else if (r.percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        card.innerHTML = `
            <h3>${r.nome}</h3>

            <div class="tanque-visu">
                <div class="nivel-agua" style="height:${r.percent}%"></div>
                <div class="overlay-info">
                    <div class="percent-text">${r.percent}%</div>
                    <div class="liters-text">${r.current_liters} L</div>
                </div>
            </div>

            <button onclick="abrirHistorico('${r.setor}')">📊 Histórico</button>
            <p>Capacidade: ${r.capacidade} L</p>
        `;

        box.appendChild(card);
    });
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
