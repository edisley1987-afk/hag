/**
 * DASHBOARD HAG - SCADA INDUSTRIAL FINAL
 */

const API = "/api/dashboard";

let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();
let renderPending = false;

// 🔊 alarme
let audioCtx = null;
let alarmeAtivo = false;

// =======================
// INIT
// =======================
init();

function init() {
    fallbackHTTP();
    conectarWS();

    setInterval(fallbackHTTP, 8000);

    setInterval(() => {
        if (Date.now() - ultimoDado > 15000) {
            setStatus("🟡 Sem comunicação com gateway");
        }
    }, 5000);
}

// =======================
// PROCESSAMENTO
// =======================

function processarPayload(payload) {
    if (!payload) return;

    if (payload.type === "update") {
        payload = payload.dados;
    }

    ultimoDado = Date.now();
    scheduleRender(payload);
}

function scheduleRender(data) {
    if (renderPending) return;

    renderPending = true;

    requestAnimationFrame(() => {
        atualizarUI(data);
        renderPending = false;
    });
}

// =======================
// UI
// =======================

function atualizarUI(data) {
    if (!data) return;

    atualizarHora(data.lastUpdate);

    renderReservatorios(data.reservatorios || []);
    renderBombas(data.bombas || []);
    renderPressoes(data.pressoes || []);

    atualizarKPIs(data);
    detectarFalhas(data);
}

// =======================
// HORA
// =======================

function atualizarHora(hora) {
    const el = document.getElementById("hora");
    if (el) {
        el.innerText = hora || new Date().toLocaleTimeString("pt-BR");
    }
}

// =======================
// RESERVATÓRIOS
// =======================

function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor}`;
        let el = document.getElementById(id);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio";
            el.innerHTML = `
                <h2>${r.nome}</h2>
                <div class="tanque">
                    <div class="agua"></div>
                </div>
                <div class="info">
                    <div class="valor"></div>
                    <div class="litros"></div>
                </div>
            `;
            area.appendChild(el);
        }

        const agua = el.querySelector(".agua");
        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");

        let percent = Number(r.percent || 0);
        percent = Math.max(0, Math.min(100, percent));

        agua.style.height = percent + "%";

        const [c1, c2] = corNivel(percent);
        agua.style.background = `linear-gradient(180deg, ${c1}, ${c2})`;

        valor.innerText = percent.toFixed(1) + "%";
        litros.innerText = formatar(r.current_liters) + " L";

        // alerta
        if (percent < 25) el.classList.add("alerta");
        else el.classList.remove("alerta");
    });
}

// =======================
// BOMBAS (FIX TOTAL)
// =======================

function renderBombas(lista) {
    const area = document.getElementById("areaBombas");
    if (!area) return;

    lista.forEach((b, i) => {
        const id = `bomba-${i}`;
        let el = document.getElementById(id);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            area.appendChild(el);
        }

        const ligada = b.estado === "ligada";

        el.className = `card bomba ${ligada ? "ligada ativa" : "desligada"}`;

        el.innerHTML = `
            <h2>${b.nome}</h2>
            <div class="status-bomba">
                <span class="status-led"></span>
                ${ligada ? "EM OPERAÇÃO" : "INATIVA"}
            </div>
            <div class="ciclos">${b.ciclo || 0} ciclos</div>
        `;
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
            area.appendChild(el);
        }

        const valor = Number(p.pressao || 0).toFixed(2);

        el.innerHTML = `
            <h2>${p.nome}</h2>
            <div class="valor">${valor} bar</div>
        `;
    });
}

// =======================
// KPIs + ALERTA GLOBAL
// =======================

function atualizarKPIs(data) {
    const criticos = (data.reservatorios || []).filter(r => r.percent < 30).length;
    const bombasAtivas = (data.bombas || []).filter(b => b.estado === "ligada").length;

    setTexto("kpiCritico", criticos);
    setTexto("bombasAtivas", bombasAtivas);

    const box = document.getElementById("kpiCritico")?.closest(".kpi-box");

    if (!box) return;

    if (criticos > 0) {
        box.classList.add("critico", "piscando");
        ativarAlarme();
        ativarTelaCritica(true);
    } else {
        box.classList.remove("critico", "piscando");
        pararAlarme();
        ativarTelaCritica(false);
    }
}

// =======================
// 🚨 TELA CRÍTICA
// =======================

function ativarTelaCritica(ativo) {
    document.body.classList.toggle("modo-critico", ativo);
}

// =======================
// 🔊 ALARME (SEM MP3)
// =======================

function ativarAlarme() {
    if (alarmeAtivo) return;

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "square";
        gain.gain.value = 0.08;

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();

        setInterval(() => {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            setTimeout(() => {
                osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            }, 300);
        }, 600);

        alarmeAtivo = true;

    } catch (e) {
        console.warn("Som bloqueado pelo navegador");
    }
}

function pararAlarme() {
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    alarmeAtivo = false;
}

// =======================
// 🧠 DETECÇÃO DE FALHA
// =======================

function detectarFalhas(data) {
    (data.reservatorios || []).forEach(r => {
        if (r.percent === 0 && r.current_liters === 0) {
            console.warn("Sensor possivelmente travado:", r.nome);
        }

        if (r.percent > 100 || r.percent < 0) {
            console.warn("Leitura inválida:", r.nome);
        }
    });
}

// =======================
// CONEXÃO
// =======================

function conectarWS() {
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);

    ws.onopen = () => setStatus("🟢 Conectado");

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
// FALLBACK
// =======================

async function fallbackHTTP() {
    try {
        const res = await fetch(API + "?t=" + Date.now());
        const data = await res.json();
        processarPayload(data);
    } catch {
        if (!ws || ws.readyState !== 1) {
            setStatus("🔴 Sem comunicação");
        }
    }
}

// =======================
// UTILS
// =======================

function setStatus(txt) {
    const el = document.getElementById("statusSistema");
    if (el) el.innerText = txt;
}

function setTexto(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function formatar(n) {
    return Number(n || 0).toLocaleString("pt-BR");
}

function corNivel(p) {
    if (p >= 70) return ["#00ff88", "#00c853"];
    if (p >= 30) return ["#ffd600", "#ff8f00"];
    return ["#ff1744", "#b71c1c"];
}
