/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão Final Otimizada - Sem "Pisca-Pisca" e com Conversão de Dados
 */

const API = "/api/dashboard";

let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();
let renderPending = false;

// Configurações de Capacidade (Baseadas na sua Planilha)
const CAPACIDADES = {
    elevador: 20000,
    osmose: 200,
    cme: 1000,
    abrandada: 9000,
    lavanderia: 10000
};

// =======================
// INIT
// =======================
init();

function init() {
    conectarWS();
    setInterval(fallbackHTTP, 8000);

    // Monitor de inatividade do Gateway
    setInterval(() => {
        if (Date.now() - ultimoDado > 15000) {
            setStatus("🟡 Aguardando sinal do Gateway Khomp...");
        }
    }, 5000);
}

// =======================
// PROCESSAMENTO DE DADOS (CONVERSÃO)
// =======================
function converterDadosBrutos(payload) {
    // Se o payload já vier mastigado do server.js (formato dashboard), retorna ele
    if (payload.reservatorios && payload.bombas) return payload;

    // Se vier o JSON bruto do Gateway (como o que você enviou)
    const calcPct = (atual, max) => Math.min(100, Math.max(0, Math.round((atual / max) * 100)));

    return {
        reservatorios: [
            { nome: "Elevador", setor: "elevador", current_liters: payload.Reservatorio_Elevador_current || 0, percent: calcPct(payload.Reservatorio_Elevador_current, CAPACIDADES.elevador) },
            { nome: "Osmose", setor: "osmose", current_liters: payload.Reservatorio_Osmose_current || 0, percent: calcPct(payload.Reservatorio_Osmose_current, CAPACIDADES.osmose) },
            { nome: "Cme", setor: "cme", current_liters: payload.Reservatorio_CME_current || 0, percent: calcPct(payload.Reservatorio_CME_current, CAPACIDADES.cme) },
            { nome: "Abrandada", setor: "abrandada", current_liters: payload.Agua_Abrandada_current || payload.Reservatorio_Agua_Abrandada_current || 0, percent: calcPct(payload.Agua_Abrandada_current || payload.Reservatorio_Agua_Abrandada_current, CAPACIDADES.abrandada) },
            { nome: "Lavanderia", setor: "lavanderia", current_liters: payload.Reservatorio_lavanderia_current || 0, percent: calcPct(payload.Reservatorio_lavanderia_current, CAPACIDADES.lavanderia) }
        ],
        bombas: [
            { nome: "Bomba 01", estado: payload.Bomba_01_binary === 1 ? "ligada" : "desligada", ciclo: payload.Ciclos_Bomba_01_counter || 0 },
            { nome: "Bomba 02", estado: payload.Bomba_02_binary === 1 ? "ligada" : "desligada", ciclo: payload.Ciclos_Bomba_02_counter || 0 },
            { nome: "Bomba Osmose", estado: payload.Bomba_Osmose_binary === 1 ? "ligada" : "desligada", ciclo: payload.Ciclos_Bomba_Osmose_counter || 0 }
        ],
        pressoes: [
            { nome: "Pressão Saída Osmose", pressao: payload.Pressao_Saida_Osmose_current || 0 },
            { nome: "Pressão Retorno Osmose", pressao: payload.Pressao_Retorno_Osmose_current || 0 },
            { nome: "Pressão Saída CME", pressao: payload.Pressao_Saida_CME_current || 0 }
        ],
        lastUpdate: payload.timestamp ? new Date(payload.timestamp).toLocaleTimeString("pt-BR") : new Date().toLocaleTimeString("pt-BR")
    };
}

function processarPayload(payload) {
    if (!payload) return;
    ultimoDado = Date.now();

    let dadosProcessados;
    if (payload.type === "update" && payload.dados) {
        dadosProcessados = converterDadosBrutos(payload.dados);
    } else {
        dadosProcessados = converterDadosBrutos(payload);
    }

    scheduleRender(dadosProcessados);
}

// =======================
// WEBSOCKET & HTTP
// =======================
function conectarWS() {
    if (ws) ws.close();
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);

    ws.onopen = () => setStatus("🟢 Monitoramento em tempo real");
    ws.onmessage = (msg) => {
        try { processarPayload(JSON.parse(msg.data)); } catch (e) { console.error("Erro no parse WS"); }
    };
    ws.onclose = () => {
        setStatus("🔴 Reconectando...");
        setTimeout(conectarWS, reconnectDelay);
    };
}

async function fallbackHTTP() {
    if (ws && ws.readyState === 1) return;
    try {
        const res = await fetch(API + "?ts=" + Date.now());
        const data = await res.json();
        processarPayload(data);
    } catch (e) { setStatus("🔴 Erro de comunicação"); }
}

// =======================
// RENDERIZAÇÃO (SEM REESCREVER O DOM)
// =======================
function scheduleRender(data) {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
        atualizarTela(data);
        renderPending = false;
    });
}

function atualizarTela(data) {
    const elHora = document.getElementById("hora");
    if (elHora) elHora.innerText = data.lastUpdate;

    renderReservatorios(data.reservatorios);
    renderBombas(data.bombas);
    renderPressoes(data.pressoes);
    atualizarKPIs(data);
}

function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor || r.nome.toLowerCase()}`;
        let el = document.getElementById(id);
        const percent = r.percent;
        const [cor1, cor2] = corNivel(percent);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio";
            el.innerHTML = `<h2>${r.nome}</h2><div class="tanque"><div class="escala"><span></span><span></span><span></span><span></span><span></span></div><div class="agua"></div></div><div class="info"><div class="valor"></div><div class="litros"></div></div>`;
            area.appendChild(el);
        }

        const divAgua = el.querySelector(".agua");
        const divValor = el.querySelector(".valor");
        const divLitros = el.querySelector(".litros");

        divAgua.style.height = `${percent}%`;
        divAgua.style.background = `linear-gradient(180deg, ${cor1}, ${cor2})`;
        divValor.innerText = `${percent}%`;
        divLitros.innerText = `${formatar(r.current_liters)} L`;
    });
}

function renderBombas(lista) {
    const area = document.getElementById("areaBombas");
    if (!area) return;

    lista.forEach((b, index) => {
        const id = `bomba-${index}`;
        let el = document.getElementById(id);
        const ligada = b.estado === "ligada";

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.innerHTML = `<h2></h2><div class="status-icon"></div><div class="valor"></div><div class="ciclos"></div>`;
            area.appendChild(el);
        }

        el.className = `card bomba ${ligada ? "ligada" : "desligada"}`;
        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".status-icon").innerText = ligada ? "🟢" : "🔴";
        el.querySelector(".valor").innerText = ligada ? "EM OPERAÇÃO" : "INATIVA";
        el.querySelector(".ciclos").innerText = `${b.ciclo || 0} ciclos`;
    });
}

function renderPressoes(lista) {
    const area = document.getElementById("areaPressoes");
    if (!area) return;

    lista.forEach((p, index) => {
        const id = `pressao-${index}`;
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card";
            el.innerHTML = `<h2></h2><div class="valor-pressao"></div>`;
            area.appendChild(el);
        }
        el.querySelector("h2").innerText = p.nome;
        el.querySelector(".valor-pressao").innerText = `${p.pressao.toFixed(2)} bar`;
    });
}

// =======================
// AUXILIARES
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
    if (elCritico) elCritico.innerText = data.reservatorios.filter(r => r.percent < 30).length;
    if (elAtivas) elAtivas.innerText = data.bombas.filter(b => b.estado === "ligada").length;
}
