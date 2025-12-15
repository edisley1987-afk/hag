// ========================= CONFIG =========================
const API = "/api/dashboard";

// Manutenção salva
let manutencao = JSON.parse(localStorage.getItem("manutencao")) || {};

// Cache global (estado único)
let ultimasLeituras = {};

// === Alertas ===
let alertaAtivo = {};
let alertaNivel31 = {};
let bipNivelIntervalo = {};
let alertaReservatoriosCriticos = [];


// ========================= LOOP HTTP (BASE) =========================
async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw new Error("API retornou " + r.status);

        const dados = await r.json();
        const globalTs = dados.lastUpdate || new Date().toISOString();

        // ---- RESERVATÓRIOS ----
        if (Array.isArray(dados.reservatorios)) {
            dados.reservatorios.forEach(rsv => {
                ultimasLeituras[rsv.setor] = {
                    ...ultimasLeituras[rsv.setor],
                    ...rsv,
                    timestamp: rsv.timestamp || globalTs
                };
            });
        }

        // ---- PRESSÕES ----
        if (Array.isArray(dados.pressoes)) {
            dados.pressoes.forEach(p => {
                ultimasLeituras[p.setor] = {
                    ...ultimasLeituras[p.setor],
                    pressao: p.pressao,
                    timestamp: p.timestamp || globalTs
                };
            });
        }

        // ---- BOMBAS (3) ----
        if (Array.isArray(dados.bombas)) {
            dados.bombas.forEach((b, i) => {
                ultimasLeituras[`bomba${i + 1}`] = {
                    ...ultimasLeituras[`bomba${i + 1}`],
                    ...b,
                    timestamp: b.timestamp || globalTs
                };
            });
        }

        render(dados);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date(globalTs).toLocaleTimeString();

    } catch (e) {
        console.error("Erro HTTP:", e);

        document.getElementById("lastUpdate").textContent =
            "Falha na comunicação – exibindo último estado";

        render({});
    }
}

setInterval(atualizar, 5000);
atualizar();


// ========================= SOM =========================
function bipCurto() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = 600;
        o.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.12);
    } catch {}
}


// ========================= CONTROLLER (ANTI-SUMIÇO) =========================
function render(d) {
    // RESERVATÓRIOS
    if (Array.isArray(d.reservatorios) && d.reservatorios.length) {
        renderReservatorios(d.reservatorios);
    } else {
        const cache = Object.values(ultimasLeituras).filter(r => r.capacidade);
        if (cache.length) renderReservatorios(cache);
    }

    // PRESSÕES
    if (Array.isArray(d.pressoes) && d.pressoes.length) {
        renderPressao(d.pressoes);
    }

    // BOMBAS
    if (Array.isArray(d.bombas) && d.bombas.length) {
        renderBombas(d.bombas);
    }
}


// ========================= ALERTA NÍVEL 40% =========================
function exibirAlertaNivel(lista) {
    const box = document.getElementById("alerta-nivelbaixo");
    if (!box) return;

    if (!lista.length) {
        box.style.display = "none";
        return;
    }

    box.style.display = "block";
    box.innerHTML =
        `⚠️ Reservatórios abaixo de 40%: <b>${lista.join(", ")}</b>`;
}


// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
    const box = document.getElementById("reservatoriosContainer");
    if (!box || !lista || !lista.length) return;

    const frag = document.createDocumentFragment();
    let alertas40 = [];

    lista.forEach(r => {
        const percent = Math.round(r.percent || 0);
        const litros = r.current_liters ?? "--";
        const ts = r.timestamp || new Date().toISOString();

        const card = document.createElement("div");
        card.className = "card-reservatorio";

        if (percent <= 30) card.classList.add("nv-critico");
        else if (percent <= 60) card.classList.add("nv-alerta");
        else if (percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        // ALERTA <31%
        if (percent < 31 && !manutencao[r.setor]) {
            card.classList.add("piscar-31");
            if (!alertaNivel31[r.setor]) {
                alertaNivel31[r.setor] = true;
                bipNivelIntervalo[r.setor] = setInterval(bipCurto, 3000);
            }
        } else {
            clearInterval(bipNivelIntervalo[r.setor]);
            delete alertaNivel31[r.setor];
        }

        // ALERTA <=40%
        if (percent <= 40 && !manutencao[r.setor]) {
            if (!alertaAtivo[r.setor]) bipCurto();
            alertaAtivo[r.setor] = true;
            alertas40.push(`${r.nome} (${percent}%)`);
        } else {
            alertaAtivo[r.setor] = false;
        }

        card.innerHTML = `
            <div class="top-bar">
                <h3>${r.nome}</h3>
                <button class="gear-btn"
                    onclick="toggleManutencao('${r.setor}')">⚙</button>
            </div>

            <div class="tanque-visu">
                <div class="nivel-agua" style="height:${percent}%"></div>
                <div class="overlay-info">
                    <div class="percent-text">${percent}%</div>
                    <div class="liters-text">${litros} L</div>
                </div>
            </div>

            <button onclick="abrirHistorico('${r.setor}')">
                📊 Histórico
            </button>
        `;

        frag.appendChild(card);
    });

    box.innerHTML = "";
    box.appendChild(frag);
    exibirAlertaNivel(alertas40);
}


// ========================= PRESSÕES =========================
function renderPressao(lista) {
    const mapa = {
        saida_osmose: "pSaidaOsmose",
        retorno_osmose: "pRetornoOsmose",
        saida_cme: "pSaidaCME"
    };

    lista.forEach(p => {
        const el = document.getElementById(mapa[p.setor]);
        if (el && p.pressao != null) {
            el.textContent = Number(p.pressao).toFixed(2);
        }
    });
}


// ========================= BOMBAS =========================
function renderBombas(lista) {
    lista.forEach((b, i) => {
        const el = document.getElementById(`bomba${i + 1}`);
        if (!el) return;

        const ligada =
            b.estado_num === 1 ||
            b.estado === 1 ||
            b.estado === "ligada";

        el.classList.toggle("bomba-ligada", ligada);
        el.classList.toggle("bomba-desligada", !ligada);

        document.getElementById(`b${i + 1}Status`).textContent =
            ligada ? "Ligada" : "Desligada";

        document.getElementById(`b${i + 1}Ciclos`).textContent =
            b.ciclo ?? 0;
    });
}


// ========================= MANUTENÇÃO =========================
function toggleManutencao(setor) {
    manutencao[setor] = !manutencao[setor];
    localStorage.setItem("manutencao", JSON.stringify(manutencao));
}

function abrirHistorico(setor) {
    location.href = `/historico.html?setor=${setor}`;
}


// ========================= WEBSOCKET (SEGURO) =========================
let ws;

function connectWS() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.onopen = () => console.log("✅ WS conectado");

    ws.onmessage = e => {
        try {
            const msg = JSON.parse(e.data);
            if (msg.type === "update" && msg.dados) {
                // Atualiza cache SEM apagar nada
                msg.dados.reservatorios?.forEach(r =>
                    ultimasLeituras[r.setor] = r
                );
                msg.dados.pressoes?.forEach(p =>
                    ultimasLeituras[p.setor] = p
                );
                msg.dados.bombas?.forEach((b, i) =>
                    ultimasLeituras[`bomba${i + 1}`] = b
                );

                render(msg.dados);

                document.getElementById("lastUpdate").textContent =
                    "Tempo real " + new Date().toLocaleTimeString();
            }
        } catch (err) {
            console.warn("WS inválido", err);
        }
    };

    ws.onclose = () => setTimeout(connectWS, 3000);
    ws.onerror = () => ws.close();
}

connectWS();
