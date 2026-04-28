/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão Final Otimizada: Sem flicker e com conversão de dados precisa
 */

const API = "/api/dashboard";

let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();
let renderPending = false;

// 📊 1. Configurações de Capacidade (Baseadas na sua planilha de controle)
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
    
    // Fallback caso o WebSocket falhe
    setInterval(fallbackHTTP, 8000);

    // Monitor de sinal do Gateway Khomp
    setInterval(() => {
        if (Date.now() - ultimoDado > 15000) {
            setStatus("🟡 Aguardando sinal do Gateway...");
        }
    }, 5000);
}

// =======================
// PROCESSAMENTO & CONVERSÃO
// =======================

/**
 * Esta função traduz o JSON bruto do Gateway para o formato que o Dashboard entende,
 * aplicando as fórmulas de porcentagem da sua planilha.
 */
function converterDadosBrutos(payload) {
    if (payload.type === "update" && payload.dados) {
        payload = payload.dados;
    }

    const calcPct = (atual, max) => Math.min(100, Math.max(0, Math.round((atual / max) * 100)));

    return {
        reservatorios: [
            { 
                nome: "Elevador", 
                setor: "elevador", 
                current_liters: payload.Reservatorio_Elevador_current || 0, 
                percent: calcPct(payload.Reservatorio_Elevador_current, CAPACIDADES.elevador) 
            },
            { 
                nome: "Osmose", 
                setor: "osmose", 
                current_liters: payload.Reservatorio_Osmose_current || 0, 
                percent: calcPct(payload.Reservatorio_Osmose_current, CAPACIDADES.osmose) 
            },
            { 
                nome: "Cme", 
                setor: "cme", 
                current_liters: payload.Reservatorio_CME_current || 0, 
                percent: calcPct(payload.Reservatorio_CME_current, CAPACIDADES.cme) 
            },
            { 
                nome: "Abrandada", 
                setor: "abrandada", 
                current_liters: payload.Agua_Abrandada_current || payload.Reservatorio_Agua_Abrandada_current || 0, 
                percent: calcPct(payload.Agua_Abrandada_current || payload.Reservatorio_Agua_Abrandada_current, CAPACIDADES.abrandada) 
            },
            { 
                nome: "Lavanderia", 
                setor: "lavanderia", 
                current_liters: payload.Reservatorio_lavanderia_current || 0, 
                percent: calcPct(payload.Reservatorio_lavanderia_current, CAPACIDADES.lavanderia) 
            }
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
    const dadosProcessados = converterDadosBrutos(payload);
    scheduleRender(dadosProcessados);
}

// =======================
// RENDERIZAÇÃO OTIMIZADA
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
    const elHora = document.getElementById("hora");
    if (elHora) elHora.innerText = data.lastUpdate;

    renderReservatorios(data.reservatorios);
    renderBombas(data.bombas);
    renderPressoes(data.pressoes);
    atualizarKPIs(data);
}

/**
 * 💧 Atualiza Reservatórios sem recriar o HTML
 */
function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor}`;
        let el = document.getElementById(id);
        const [cor1, cor2] = corNivel(r.percent);

        // Se o card não existe, cria a estrutura inicial
        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio";
            el.innerHTML = `
                <h2>${r.nome}</h2>
                <div class="tanque">
                    <div class="escala"><span></span><span></span><span></span><span></span><span></span></div>
                    <div class="agua"></div>
                </div>
                <div class="info">
                    <div class="valor"></div>
                    <div class="litros"></div>
                </div>`;
            area.appendChild(el);
        }

        // Atualização Cirúrgica (Evita o pisca-pisca)
        const divAgua = el.querySelector(".agua");
        const divValor = el.querySelector(".valor");
        const divLitros = el.querySelector(".litros");

        divAgua.style.height = `${r.percent}%`;
        divAgua.style.background = `linear-gradient(180deg, ${cor1}, ${cor2})`;
        divValor.innerText = `${r.percent}%`;
        divLitros.innerText = `${formatar(r.current_liters)} L`;
    });
}

/**
 * ⚙️ Atualiza Bombas
 */
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

/**
 * 📈 Atualiza Pressões
 */
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
// AUXILIARES & COMUNICAÇÃO
// =======================

function conectarWS() {
    if (ws) ws.close();
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);

    ws.onopen = () => setStatus("🟢 Monitoramento em tempo real");
    ws.onmessage = (msg) => {
        try { processarPayload(JSON.parse(msg.data)); } catch (e) { console.error("Erro no parse do WebSocket"); }
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

function setStatus(txt) {
    const el = document.getElementById("statusSistema");
    if (el) el.innerText = txt;
}

function formatar(n) {
    return Number(n || 0).toLocaleString("pt-BR");
}

function corNivel(p) {
    if (p >= 70) return ["#00ff88", "#00c853"]; // Verde
    if (p >= 40) return ["#ffd600", "#ff8f00"]; // Amarelo
    return ["#ff1744", "#b71c1c"]; // Vermelho
}

function atualizarKPIs(data) {
    const elCritico = document.getElementById("kpiCritico");
    const elAtivas = document.getElementById("bombasAtivas");
    if (elCritico) elCritico.innerText = data.reservatorios.filter(r => r.percent < 30).length;
    if (elAtivas) elAtivas.innerText = data.bombas.filter(b => b.estado === "ligada").length;
}
