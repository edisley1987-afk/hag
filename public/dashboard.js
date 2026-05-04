/**
 * Dashboard HAG 3D - Hospital Arnaldo Gavazza
 * Versão 2.0 - Profissional SCADA
 * Autor: Sistema HAG
 */

const API = "/api/dashboard";
let ws = null;
let reconnectDelay = 3000;
let maxReconnectDelay = 30000;
let ultimoDado = Date.now();
let renderPending = false;
let cacheDados = new Map();

// =======================
// INIT
// =======================
document.addEventListener("DOMContentLoaded", init);

function init() {
    console.log("%c HAG Dashboard v2.0 - Sistema Iniciado", "color: #00e5ff; font-weight: bold; font-size: 14px;");
    fallbackHTTP();
    conectarWS();
    setInterval(fallbackHTTP, 8000);
    iniciarMonitoramentoSinal();
}

// =======================
// MONITORAMENTO DE SINAL
// =======================
function iniciarMonitoramentoSinal() {
    setInterval(() => {
        const tempoSemSinal = Date.now() - ultimoDado;
        if (tempoSemSinal > 15000) {
            setStatus("🟡 Aguardando sinal do Gateway...", "warning");
            document.body.classList.add("sem-sinal");
            atualizarStatusVisual("Sem sinal");
        } else {
            document.body.classList.remove("sem-sinal");
            if (ws && ws.readyState === WebSocket.OPEN) {
                atualizarStatusVisual("Tempo real conectado");
            }
        }
    }, 5000);
}

// =======================
// PROCESSAMENTO DE DADOS
// =======================
function processarPayload(payload) {
    if (!payload) return;
    if (payload.type === "update" && payload.dados) {
        payload = payload.dados;
    }
    ultimoDado = Date.now();
    scheduleRender(payload);
}

// =======================
// RENDER OTIMIZADO COM RAF
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
    
    const elHora = document.getElementById("hora");
    if (elHora) elHora.innerText = data.lastUpdate || "--:--";

    renderReservatorios(data.reservatorios || []);
    renderBombas(data.bombas || []);
    renderPressoes(data.pressoes || []);
    atualizarKPIs(data);
}

// =======================
// RESERVATÓRIOS 3D COM ÁGUA
// =======================
function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor}`;
        let el = cacheDados.get(id);

        // Cria elemento se não existir
        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio";
            el.innerHTML = `
                <h2>${r.nome}</h2>
                <div class="tanque">
                    <div class="escala">
                        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                    </div>
                    <div class="agua">
                        <div class="onda"></div>
                    </div>
                </div>
                <div class="info">
                    <div class="valor">0%</div>
                    <div class="litros">0 L</div>
                </div>
            `;
            area.appendChild(el);
            cacheDados.set(id, el);
        }

        const agua = el.querySelector(".agua");
        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");

        const nivel = Math.min(100, Math.max(0, Number(r.percent) || 0));
        const nivelSuavizado = Math.round(nivel * 10) / 10; // 1 casa decimal
        const nivelAnterior = Number(agua.dataset.nivel || 0);

        // Animação de balanço quando há mudança significativa
        if (Math.abs(nivelSuavizado - nivelAnterior) >= 0.5) {
            agua.classList.add("balancando");
            setTimeout(() => agua.classList.remove("balancando"), 1300);
        }

        // Atualiza altura com transição suave
        if (agua.style.height !== `${nivelSuavizado}%`) {
            agua.style.height = `${nivelSuavizado}%`;
        }
        agua.dataset.nivel = nivelSuavizado;

        // Aplica classe de cor por nível
        agua.classList.remove("nivel-cheio", "nivel-alto", "nivel-medio", "nivel-baixo", "nivel-critico");
        if (nivel >= 95) {
            agua.classList.add("nivel-cheio");
        } else if (nivel >= 70) {
            agua.classList.add("nivel-alto");
        } else if (nivel >= 40) {
            agua.classList.add("nivel-medio");
        } else if (nivel >= 20) {
            agua.classList.add("nivel-baixo");
        } else {
            agua.classList.add("nivel-critico");
        }

        // Alerta visual no card quando nível crítico
        el.classList.toggle("alerta", nivel < 20);

        // Atualiza textos com formatação
        valor.innerText = `${nivelSuavizado.toFixed(1)}%`;
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
        let el = cacheDados.get(id);
        const ligada = b.estado === "ligada";
        const desconhecido = b.estado === "desconhecido" || b.estado === undefined;

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card bomba";
            el.innerHTML = `
                <h2></h2>
                <div class="status-icon"></div>
                <div class="valor"></div>
                <div class="ciclos"></div>
            `;
            area.appendChild(el);
            cacheDados.set(id, el);
        }

        el.className = `card bomba ${desconhecido ? "stale" : ligada ? "ligada" : "desligada"}`;
        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".status-icon").innerText = desconhecido ? "⚪" : ligada ? "🟢" : "🔴";
        el.querySelector(".valor").innerText = desconhecido ? "SEM DADOS" : ligada ? "EM OPERAÇÃO" : "INATIVA";
        el.querySelector(".ciclos").innerText = `${formatar(b.ciclo || 0)} ciclos`;
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
        let el = cacheDados.get(id);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card";
            el.innerHTML = `<h2></h2><div class="valor-pressao"></div>`;
            area.appendChild(el);
            cacheDados.set(id, el);
        }

        const pressao = Number(p.pressao || 0).toFixed(2);
        el.querySelector("h2").innerText = p.nome;
        el.querySelector(".valor-pressao").innerText = `${pressao} bar`;
    });
}

// =======================
// KPIs
// =======================
function atualizarKPIs(data) {
    const kpis = data.kpis || {};
    const elementos = {
        kpiCritico: (data.reservatorios || []).filter(r => r.percent < 30).length,
        bombasAtivas: (data.bombas || []).filter(b => b.estado === "ligada").length,
        kpiElevador: `${formatar(kpis.elevador_hoje || 0)} L`,
        kpiLavanderia: `${formatar(kpis.lavanderia_hoje || 0)} L`,
        kpiOsmose: `${formatar(kpis.osmose_hoje || 0)} L`
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = valor;
    });
}

// =======================
// WEBSOCKET COM RECONEXÃO EXPONENCIAL
// =======================
function conectarWS() {
    if (ws) ws.close();
    
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);
    
    ws.onopen = () => {
        console.log("%c🟢 WebSocket conectado", "color: #00ff88; font-weight: bold;");
        setStatus("🟢 Tempo real conectado", "success");
        atualizarStatusVisual("Tempo real conectado");
        reconnectDelay = 3000; // Reset delay
    };

    ws.onmessage = (msg) => { 
        try { 
            processarPayload(JSON.parse(msg.data)); 
        } catch (e) { 
            console.error("Erro ao processar mensagem WS:", e); 
        } 
    };

    ws.onclose = () => { 
        console.log("%c🔴 WebSocket desconectado", "color: #ff3d00; font-weight: bold;");
        setStatus("🔴 Reconectando...", "error"); 
        atualizarStatusVisual("Reconectando...");
        setTimeout(conectarWS, reconnectDelay); 
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay); // Backoff exponencial
    };

    ws.onerror = (err) => {
        console.error("Erro WebSocket:", err);
    };
}

// =======================
// FALLBACK HTTP
// =======================
async function fallbackHTTP() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(API + "?t=" + Date.now(), {
            cache: "no-store",
            signal: controller.signal,
            headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        processarPayload(data);
    } catch (err) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            setStatus("🔴 Erro de comunicação", "error");
            atualizarStatusVisual("Desconectado");
        }
    }
}

// =======================
// HELPERS
// =======================
function setStatus(txt, tipo = "info") {
    const el = document.getElementById("statusSistema");
    if (!el) return;
    
    el.innerText = txt;
    el.className = `status-${tipo}`;
}

function atualizarStatusVisual(texto) {
    const el = document.getElementById("statusTexto");
    const dot = document.querySelector(".status-dot");
    if (!el || !dot) return;
    
    el.innerText = texto;
    
    if (texto.includes("Tempo real")) {
        dot.style.background = "#00ff88";
        dot.style.boxShadow = "0 0 12px #00ff88, 0 0 24px rgba(0,255,136,0.4)";
    } else if (texto.includes("Reconectando")) {
        dot.style.background = "#ffd600";
        dot.style.boxShadow = "0 0 12px #ffd600, 0 0 24px rgba(255,214,0,0.4)";
    } else {
        dot.style.background = "#ff3d00";
        dot.style.boxShadow = "0 0 12px #ff3d00, 0 0 24px rgba(255,61,0,0.4)";
    }
}

function formatar(n) { 
    return Number(n || 0).toLocaleString("pt-BR", { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
    }); 
}

// =======================
// TRATAMENTO DE ERRO GLOBAL
// =======================
window.addEventListener("error", (e) => {
    console.error("Erro não tratado:", e.error);
});

window.addEventListener("unhandledrejection", (e) => {
    console.error("Promise rejeitada:", e.reason);
});
