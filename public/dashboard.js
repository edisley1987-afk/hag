const API = "/api/dashboard";   // <<< URL ACERTADA
let cache = JSON.parse(localStorage.getItem("DATA_CACHE")) || {};

let tempoAtivo = {}; // <<< ARMAZENA TEMPO DE FUNCIONAMENTO
let ultEstado = {};  // <<< GUARDA O ESTADO ANTERIOR PARA CONTAR TEMPO

async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw 0;
        const dados = await r.json();

        cache = dados;
        localStorage.setItem("DATA_CACHE", JSON.stringify(dados));

        processarTempo(dados.bombas);   // <<< NOVO
        render(dados);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date().toLocaleTimeString();
    } catch {
        console.warn("Sem atualização, usando valores armazenados.");
        render(cache);

        document.getElementById("lastUpdate").textContent =
            "SEM SINAL — exibindo última leitura";
    }
}
setInterval(atualizar, 5000);
atualizar();

/* =======================================================
                     PROCESSA TEMPO DAS BOMBAS
   ======================================================= */
function processarTempo(lista) {
    lista.forEach(b => {
        if (!tempoAtivo[b.nome]) tempoAtivo[b.nome] = 0;
        if (!ultEstado[b.nome]) ultEstado[b.nome] = b.estado;

        if (b.estado === "Ligada") {
            // Incrementa tempo ativo
            tempoAtivo[b.nome] += 5; // 5s do intervalo
        }

        ultEstado[b.nome] = b.estado;
    });
}

/* =================== RENDER =================== */
function render(d) {
    renderReservatorios(d.reservatorios);
    renderPressao(d.pressoes);
    renderBombas(d.bombas);
}

/* =======================================================
                     RESERVATÓRIOS
======================================================= */
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

        <div class="alerta-msg">⚠ Nível abaixo de 30%</div>

        <button onclick="abrirHistorico('${r.setor}')"
            style="width:100%;padding:9px;border:none;border-radius:8px;
            background:#0f7a5b;color:white;font-weight:bold;margin-top:5px;">
            📊 Histórico
        </button>

        <p style="margin-top:8px;font-size:13px;color:#444">
            Capacidade: ${r.capacidade} L
        </p>
        `;

        box.appendChild(card);
    });
}

function abrirHistorico(x) {
    location.href = `/historico.html?setor=${x}`;
}

/* =======================================================
                     PRESSÕES
======================================================= */
function renderPressao(lista) {
    const box = document.getElementById("pressoesContainer");
    box.innerHTML = lista
        .map(
            p => `
        <div class="card-pressao">
            <h3>${p.nome}</h3>
            <div class="pressao-valor">${p.pressao}</div>
            <div class="pressao-unidade">bar</div>
        </div>
        `
        )
        .join("");
}

/* =======================================================
                     BOMBAS + MELHORIAS
======================================================= */
function renderBombas(lista) {
    const box = document.getElementById("bombasContainer");

    // ====== ALERTA DE CICLOS DIFERENTES ======
    let ciclos = lista.map(b => b.ciclo);
    let alertaCiclos = !(ciclos.every(v => v === ciclos[0])); // se diferentes

    box.innerHTML = lista
        .map(b => {
            let tempoSeg = tempoAtivo[b.nome];
            let min = Math.floor(tempoSeg / 60);
            let seg = tempoSeg % 60;
            let tempoFmt = `${min}m ${seg}s`;

            return `
        <div class="card-bomba" 
             style="border:2px solid #000; padding:10px; border-radius:10px;
             ${b.estado === "Ligada" ? "background:#1dd16a;color:#000;" : ""}">

            <h3>${b.nome}</h3>

            <div class="linha">Status: <b>${b.estado}</b></div>
            <div class="linha">Ciclos: ${b.ciclo}</div>
            <div class="linha">Tempo ligada: <b>${tempoFmt}</b></div>

            ${
                alertaCiclos
                    ? `<div style="margin-top:8px;color:red;font-weight:bold;font-size:14px;">
                        ⚠ As bombas não possuem o mesmo número de ciclos!
                       </div>`
                    : ""
            }
        </div>
        `;
        })
        .join("");
}
