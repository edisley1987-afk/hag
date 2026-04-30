/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão PROFISSIONAL com Ack, Logs, Severidade e Debounce
 */

const API = "/api/dashboard";
let ws = null;
let reconnectDelay = 3000;
let renderPending = false;
let ultimoDado = Date.now();

// Controle de Estados
const ackedAlarms = new Set(JSON.parse(localStorage.getItem('ackedAlarms') || '[]'));
const pendingAlarms = new Map(); // Para o anti-falso positivo (Delay 3s)
const alarmHistory = new Map(); // Para rastrear transições de estado

// =======================
// INIT
// =======================
init();

function init() {
    fallbackHTTP();
    conectarWS();
    setInterval(fallbackHTTP, 8000);
}

// =======================
// LÓGICA DE EVENTOS E LOGS
// =======================

function registrarLog(msg, nivel = 'info') {
    const logArea = document.getElementById("logEventos");
    if (!logArea) return;

    const div = document.createElement("div");
    div.className = `log-entry ${nivel}`;
    div.innerHTML = `<span class="time">${new Date().toLocaleTimeString()}</span> - ${msg}`;
    
    logArea.prepend(div);
    if (logArea.children.length > 50) logArea.lastChild.remove();
}

function ackAlarm(id) {
    ackedAlarms.add(id);
    localStorage.setItem('ackedAlarms', JSON.stringify([...ackedAlarms]));
    registrarLog(`Alarme em ${id} silenciado pelo operador`, 'info');
    // Força re-render para remover o alerta visual
    renderizarUI(); 
}

// =======================
// PROCESSAMENTO
// =======================

function processarPayload(payload) {
    if (!payload) return;
    const data = payload.type === "update" ? payload.dados : payload;
    
    ultimoDado = Date.now();
    
    // Processamento Anti-Falso Positivo (Debounce)
    processarAlarmes(data.reservatorios || []);
    
    scheduleRender(data);
}

function processarAlarmes(lista) {
    const agora = Date.now();
    
    lista.forEach(r => {
        const id = `res-${r.setor}`;
        const ehCritico = r.percent < 30;
        const estadoAnterior = alarmHistory.get(id);

        if (ehCritico) {
            if (!pendingAlarms.has(id)) {
                pendingAlarms.set(id, agora);
            } else if (agora - pendingAlarms.get(id) >= 3000) {
                // Alarme confirmado após 3 segundos
                if (estadoAnterior !== 'CRITICO') {
                    if (!ackedAlarms.has(id)) {
                        registrarLog(`ALERTA CRÍTICO: ${r.nome} em ${r.percent}%`, 'critico');
                    }
                    alarmHistory.set(id, 'CRITICO');
                }
            }
        } else {
            pendingAlarms.delete(id);
            if (estadoAnterior === 'CRITICO') {
                registrarLog(`Alarme em ${r.nome} normalizado.`, 'baixo');
                ackedAlarms.delete(id); // Reseta o Ack
                localStorage.setItem('ackedAlarms', JSON.stringify([...ackedAlarms]));
            }
            alarmHistory.set(id, 'NORMAL');
        }
    });
}

// =======================
// RENDERIZAÇÃO
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
    document.getElementById("hora").innerText = data.lastUpdate || new Date().toLocaleTimeString("pt-BR");
    renderReservatorios(data.reservatorios || []);
    renderBombas(data.bombas || []);
    renderPressoes(data.pressoes || []);
    atualizarKPIs(data);
}

function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor}`;
        let el = document.getElementById(id);
        const [cor1, cor2] = corNivel(r.percent);
        const ehCritico = r.percent < 30 && !ackedAlarms.has(id);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio";
            el.innerHTML = `<h2></h2><div class="tanque"><div class="agua"></div></div><div class="info"><div class="valor"></div><div class="litros"></div></div><div class="ack-zone"></div>`;
            area.appendChild(el);
        }

        el.querySelector("h2").innerText = r.nome;
        el.querySelector(".agua").style.height = `${Math.min(100, Math.max(0, r.percent))}%`;
        el.querySelector(".agua").style.background = `linear-gradient(180deg, ${cor1}, ${cor2})`;
        el.querySelector(".valor").innerText = `${r.percent}%`;
        el.querySelector(".litros").innerText = `${formatar(r.current_liters)} L`;

        // Lógica de Severidade Visual
        el.className = `card reservatorio ${ehCritico ? "critico-pulse" : ""}`;
        
        const ackZone = el.querySelector(".ack-zone");
        if (ehCritico) {
            ackZone.innerHTML = `<button onclick="ackAlarm('${id}')" class="btn-ack">🔇 SILENCIAR</button>`;
        } else {
            ackZone.innerHTML = "";
        }
    });
}

// ... [Funções renderBombas e renderPressoes permanecem iguais] ...

function atualizarKPIs(data) {
    const elCritico = document.getElementById("kpiCritico");
    if (elCritico) {
        const totalCriticos = (data.reservatorios || []).filter(r => r.percent < 30 && !ackedAlarms.has(`res-${r.setor}`)).length;
        elCritico.innerText = totalCriticos;
        elCritico.closest('.kpi-box').className = `kpi-box ${totalCriticos > 0 ? 'alerta critico-flash' : ''}`;
    }
    // ... restante dos KPIs
}

// =======================
// UTILS
// =======================
function setStatus(txt) { document.getElementById("statusSistema").innerText = txt; }
function formatar(n) { return Number(n || 0).toLocaleString("pt-BR"); }
function corNivel(p) {
    if (p >= 60) return ["#00ff88", "#00c853"]; // Normal
    if (p >= 30) return ["#ffd600", "#ff8f00"]; // Atenção
    return ["#ff1744", "#b71c1c"];              // Crítico
}

function conectarWS() {
    if (ws) ws.close();
    ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`);
    ws.onmessage = (msg) => { try { processarPayload(JSON.parse(msg.data)); } catch(e) {} };
    ws.onclose = () => setTimeout(conectarWS, reconnectDelay);
}

async function fallbackHTTP() {
    try {
        const res = await fetch(API + "?t=" + Date.now());
        const data = await res.json();
        processarPayload(data);
    } catch (err) {}
}
