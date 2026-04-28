/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão FINAL CORRIGIDA (usa backend corretamente)
 */

const API = "/api/dashboard";

let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();
let renderPending = false;

// =======================
// INIT
// =======================
init();

function init() {
    conectarWS();

    // fallback HTTP se WS cair
    setInterval(fallbackHTTP, 8000);

    // status de comunicação
    setInterval(() => {
        if (Date.now() - ultimoDado > 15000) {
            setStatus("🟡 Aguardando sinal do Gateway...");
        }
    }, 5000);
}

// =======================
// PROCESSAMENTO
// =======================

function processarPayload(payload) {
    if (!payload) return;

    // trata pacote do websocket
    if (payload.type === "update" && payload.dados) {
        payload = payload.dados;
    }

    ultimoDado = Date.now();

    // 🔥 NÃO recalcula nada — usa backend direto
    scheduleRender(payload);
}

// =======================
// RENDER OTIMIZADO
// =======================

function scheduleRender(data) {
    if (renderPending) return;

    renderPending = true;

    requestAnimationFrame(() => {
        atualizarUI(data);
        renderPending = false;
    });
}

function atualizarUI(data) {
    if (!data) return;

    // hora
    const elHora = document.getElementById("hora");
    if (elHora) elHora.innerText = data.lastUpdate;

    renderReservatorios(data.reservatorios || []);
    renderBombas(data.bombas || []);
    renderPressoes(data.pressoes || []);
    atualizarKPIs(data);
}

// =======================
// RESERVATÓRIOS (SEM FLICKER)
// =======================

function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor}`;
        let el = document.getElementById(id);

        const [cor1, cor2] = corNivel(r.percent);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio";

            el.innerHTML = `
                <h2>${r.nome}</h2>
                <div class="tanque">
                    <div class="escala">
                        <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <div class="agua"></div>
                </div>
                <div class="info">
                    <div class="valor"></div>
                    <div class="litros"></div>
                </div>
            `;

            area.appendChild(el);
        }

        // atualização suave
        const agua = el.querySelector(".agua");
        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");

        agua.style.height = `${r.percent}%`;
        agua.style.background = `linear-gradient(180deg, ${cor1}, ${cor2})`;

        valor.innerText = `${r.percent}%`;
        litros.innerText = `${formatar(r.current_liters)} L`;
    });
}

// =======================
// BOMBAS
// =======================

function renderBombas(lista) {
    const area = document.getElementById("areaBombas");
    if (!area) return;

    lista.forEach((b, i) => {
        const id = `bomba-${i}`;
        let el = document.getElementById(id);

        const ligada = b.estado === "ligada";

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.innerHTML = `
                <h2></h2>
                <div class="status-icon"></div>
                <div class="valor"></div>
                <div class="ciclos"></div>
            `;
            area.appendChild(el);
        }

        el.className = `card bomba ${ligada ? "ligada" : "desligada"}`;

        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".status-icon").innerText = ligada ? "🟢" : "🔴";
        el.querySelector(".valor").innerText = ligada ? "EM OPERAÇÃO" : "INATIVA";
        el.querySelector(".ciclos").innerText = `${b.ciclo || 0} ciclos`;
    });
}

// =======================
// PRESSÕES
// =======================

function renderPressoes(lista) {
    const area = document.getElementById("areaPressoes");
    if (!area) return;

    lista.forEach((p, i) => {
        const id = `pressao-${i}`;
        let el = document.getElementById(id);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card";
            el.innerHTML = `
                <h2></h2>
                <div class="valor-pressao"></div>
            `;
            area.appendChild(el);
        }

        el.querySelector("h2").innerText = p.nome;
        el.querySelector(".valor-pressao").innerText = `${Number(p.pressao || 0).toFixed(2)} bar`;
    });
}

// =======================
// WEBSOCKET
// =======================

function conectarWS() {
    if (ws) ws.close();

    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);

    ws.onopen = () => setStatus("🟢 Tempo real conectado");

    ws.onmessage = (msg) => {
        try {
            processarPayload(JSON.parse(msg.data));
        } catch (e) {
            console.error("Erro WS:", e);
        }
    };

    ws.onclose = () => {
        setStatus("🔴 Reconectando...");
        setTimeout(conectarWS, reconnectDelay);
    };
}

// =======================
// FALLBACK HTTP
// =======================

async function fallbackHTTP() {
    if (ws && ws.readyState === 1) return;

    try {
        const res = await fetch(API + "?t=" + Date.now());
        const data = await res.json();
        processarPayload(data);
    } catch {
        setStatus("🔴 Erro de comunicação");
    }
}

// =======================
// UTIL
// =======================

function setStatus(txt) {
    const el = document.getElementById("statusSistema");
    if (el) el.innerText = txt;
}

function formatar(n) {
    return Number(n || 0).toLocaleString("pt-BR");
}

function corNivel(p) {
    if (p >= 70) return ["#00ff88", "#00c853"];
    if (p >= 40) return ["#ffd600", "#ff8f00"];
    return ["#ff1744", "#b71c1c"];
}

function atualizarKPIs(data) {
    const elCritico = document.getElementById("kpiCritico");
    const elAtivas = document.getElementById("bombasAtivas");

    if (elCritico) {
        elCritico.innerText = (data.reservatorios || []).filter(r => r.percent < 30).length;
    }

    if (elAtivas) {
        elAtivas.innerText = (data.bombas || []).filter(b => b.estado === "ligada").length;
    }
}
