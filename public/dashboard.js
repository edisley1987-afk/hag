/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão FINAL ESTÁVEL - Correção de redundância e proteção de UI
 */

const API = "/api/dashboard";

let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();
let renderPending = false;

// =======================
// INIT
// =======================
// Chamamos o init após o carregamento da página para garantir que os elementos existam
window.addEventListener('DOMContentLoaded', init);

function init() {
    fallbackHTTP();
    conectarWS();

    setInterval(fallbackHTTP, 8000);

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

    // Se o payload for um array direto (do HTTP), transformamos no formato esperado
    // Caso contrário, mantemos o tratamento de WS
    let dadosProcessados = payload;
    if (payload.type === "update" && payload.dados) {
        dadosProcessados = payload.dados;
    }

    ultimoDado = Date.now();
    scheduleRender(dadosProcessados);
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
    // Proteção: Garante que 'data' seja um objeto válido antes de acessar propriedades
    if (!data || typeof data !== 'object') return;

    const elHora = document.getElementById("hora");
    if (elHora) elHora.innerText = data.lastUpdate || "-";

    // Executa as funções apenas se os dados existirem para evitar erros de leitura
    if (data.reservatorios) renderReservatorios(data.reservatorios);
    if (data.bombas) renderBombas(data.bombas);
    if (data.pressoes) renderPressoes(data.pressoes);
    
    atualizarKPIs(data);
}

// =======================
// RESERVATÓRIOS
// =======================

function renderReservatorios(lista) {
    if (!Array.isArray(lista)) return;
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
    <div class="tanque-topo"></div>

    <div class="tanque-corpo">
        <div class="agua"></div>
    </div>

    <div class="info">
        <h3>${r.nome}</h3>
        <div class="valor"></div>
        <div class="litros"></div>
    </div>
`;

            area.appendChild(el);
        }

        const agua = el.querySelector(".agua");
        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");

        if(agua) agua.style.height = `${Math.min(100, Math.max(0, r.percent))}%`;
        if(agua) agua.style.background = `linear-gradient(180deg, ${cor1}, ${cor2})`;
        if(valor) valor.innerText = `${r.percent}%`;
        if(litros) litros.innerText = `${formatar(r.current_liters)} L`;
    });
}

// =======================
// BOMBAS
// =======================

function renderBombas(lista) {
    if (!Array.isArray(lista)) return;
    const area = document.getElementById("areaBombas");
    if (!area) return;

    lista.forEach((b, i) => {
        const id = `bomba-${i}`;
        let el = document.getElementById(id);

        const ligada = b.estado === "ligada";
        const desconhecido = b.estado === "desconhecido";

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

        el.className = `card bomba ${desconhecido ? "stale" : ligada ? "ligada" : "desligada"}`;
        el.querySelector("h2").innerText = b.nome || "Bomba";
        el.querySelector(".status-icon").innerText = desconhecido ? "⚪" : ligada ? "🟢" : "🔴";
        el.querySelector(".valor").innerText = desconhecido ? "SEM DADOS" : ligada ? "EM OPERAÇÃO" : "INATIVA";
        el.querySelector(".ciclos").innerText = `${b.ciclo || 0} ciclos`;
    });
}

// =======================
// PRESSÕES
// =======================

function renderPressoes(lista) {
    if (!Array.isArray(lista)) return;
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

        el.querySelector("h2").innerText = p.nome || "Pressão";
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
    try {
        const res = await fetch(`${API}?t=${Date.now()}`);
        if (!res.ok) throw new Error("Erro HTTP");
        const data = await res.json();
        processarPayload(data);
    } catch (err) {
        if (!ws || ws.readyState !== 1) {
            setStatus("🔴 Erro de comunicação");
        }
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
    const percent = Number(p) || 0;
    if (percent >= 70) return ["#00ff88", "#00c853"];
    if (percent >= 40) return ["#ffd600", "#ff8f00"];
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
