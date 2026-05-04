/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão FINAL ESTÁVEL - CORRIGIDA
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
    fallbackHTTP();
    conectarWS();
    setInterval(fallbackHTTP, 8000);

    setInterval(() => {
        if (Date.now() - ultimoDado > 15000) {
            setStatus("🟡 Aguardando sinal do Gateway...");
            document.body.classList.add("sem-sinal");
            atualizarStatusVisual("Sem sinal");
        } else {
            document.body.classList.remove("sem-sinal");
            atualizarStatusVisual("Tempo real conectado");
        }
    }, 5000);
}

// =======================
// PROCESSAMENTO
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
    const elHora = document.getElementById("hora");
    if (elHora) elHora.innerText = data.lastUpdate || "--:--";

    renderReservatorios(data.reservatorios || []);
    renderBombas(data.bombas || []);
    renderPressoes(data.pressoes || []);
    atualizarKPIs(data);
}

// =======================
// RESERVATÓRIOS 3D
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
        }

        const agua = el.querySelector(".agua");
        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");

        const nivel = Math.min(100, Math.max(0, r.percent));
        const nivelSuavizado = Math.round(nivel);

        if (agua.dataset.nivel != nivelSuavizado) {
            agua.style.height = `${nivelSuavizado}%`;
            agua.dataset.nivel = nivelSuavizado;
        }

        agua.className = "agua"; 
        if (nivel >= 95) agua.classList.add("nivel-cheio");
        else if (nivel >= 70) agua.classList.add("nivel-alto");
        else if (nivel >= 40) agua.classList.add("nivel-medio");
        else if (nivel >= 20) agua.classList.add("nivel-baixo");
        else agua.classList.add("nivel-critico");

        if (nivel < 20) el.classList.add("alerta");
        else el.classList.remove("alerta");

        valor.innerText = `${nivelSuavizado}%`;
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
        const desconhecido = b.estado === "desconhecido";
        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card bomba";
            el.innerHTML = `<h2></h2><div class="status-icon"></div><div class="valor"></div><div class="ciclos"></div>`;
            area.appendChild(el);
        }
        el.className = `card bomba ${desconhecido ? "stale" : ligada ? "ligada" : "desligada"}`;
        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".status-icon").innerText = desconhecido ? "⚪" : ligada ? "🟢" : "🔴";
        el.querySelector(".valor").innerText = desconhecido ? "SEM DADOS" : ligada ? "EM OPERAÇÃO" : "INATIVA";
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
            el.innerHTML = `<h2></h2><div class="valor-pressao"></div>`;
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
        atualizarStatusVisual("Reconectando...");
        setTimeout(conectarWS, reconnectDelay); 
    };
}

// =======================
// FALLBACK HTTP
// =======================
async function fallbackHTTP() {
    try {
        const res = await fetch(API + "?t=" + Date.now());
        if (!res.ok) throw new Error("Erro HTTP");
        const data = await res.json();
        processarPayload(data);
    } catch (err) {
        if (!ws || ws.readyState !== 1) {
            setStatus("🔴 Erro de comunicação");
            atualizarStatusVisual("Desconectado");
        }
    }
}

function setStatus(txt) {
    const el = document.getElementById("statusSistema");
    if (el) el.innerText = txt;
}

function formatar(n) { 
    return Number(n || 0).toLocaleString("pt-BR"); 
}

function atualizarKPIs(data) {
    const elCritico = document.getElementById("kpiCritico");
    const elAtivas = document.getElementById("bombasAtivas");
    const elElevador = document.getElementById("kpiElevador");
    const elLavanderia = document.getElementById("kpiLavanderia");
    const elOsmose = document.getElementById("kpiOsmose");
    
    if (elCritico) elCritico.innerText = (data.reservatorios || []).filter(r => r.percent < 30).length;
    if (elAtivas) elAtivas.innerText = (data.bombas || []).filter(b => b.estado === "ligada").length;
    if (elElevador) elElevador.innerText = `${formatar(data.kpis?.elevador_hoje)} L`;
    if (elLavanderia) elLavanderia.innerText = `${formatar(data.kpis?.lavanderia_hoje)} L`;
    if (elOsmose) elOsmose.innerText = `${formatar(data.kpis?.osmose_hoje)} L`;
}
