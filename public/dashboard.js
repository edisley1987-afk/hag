/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão OTIMIZADA com cálculos de Consumo e Alertas Visuais
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
    if (elHora) elHora.innerText = data.lastUpdate || new Date().toLocaleTimeString("pt-BR");

    renderReservatorios(data.reservatorios || []);
    renderBombas(data.bombas || []);
    renderPressoes(data.pressoes || []);
    atualizarKPIs(data);
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

        const agua = el.querySelector(".agua");
        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");

        // Atualização visual suave
        agua.style.height = `${Math.min(100, Math.max(0, r.percent))}%`;
        agua.style.background = `linear-gradient(180deg, ${cor1}, ${cor2})`;
        
        valor.innerText = `${r.percent}%`;
        litros.innerText = `${formatar(r.current_liters)} L`;

        // Alerta visual no card se estiver crítico
        if (r.percent < 25) el.classList.add('alerta');
        else el.classList.remove('alerta');
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
            el.innerHTML = `
                <h2></h2>
                <div class="status-icon"></div>
                <div class="valor"></div>
                <div class="ciclos"></div>
            `;
            area.appendChild(el);
        }

        el.className = `card bomba ${desconhecido ? "stale" : ligada ? "ligada ativa" : "desligada"}`;
        
        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".status-icon").innerHTML = desconhecido ? "⚪" : ligada ? "🟢" : "🔴";
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
        const pValor = Math.max(0, Number(p.pressao || 0)).toFixed(2);
        el.querySelector(".valor-pressao").innerText = `${pValor} bar`;
    });
}

// =======================
// KPIs (CONSUMO E ALERTAS)
// =======================

function atualizarKPIs(data) {
    // Referências dos elementos do cabeçalho
    const elCritico = document.getElementById("kpiCritico");
    const elAtivas = document.getElementById("bombasAtivas");
    const elElevador = document.getElementById("kpiElevador");
    const elLavanderia = document.getElementById("kpiLavanderia");
    const elOsmose = document.getElementById("kpiOsmose");

    // 1. Atualizar Consumo (Se vier do Backend)
    if (elElevador) elElevador.innerText = `${formatar(data.consumoElevador || 0)} L`;
    if (elLavanderia) elLavanderia.innerText = `${formatar(data.consumoLavanderia || 0)} L`;
    if (elOsmose) elOsmose.innerText = `${formatar(data.consumoOsmose || 0)} L`;

    // 2. Lógica de Críticos
    if (elCritico) {
        const totalCriticos = (data.reservatorios || []).filter(r => r.percent < 30).length;
        elCritico.innerText = totalCriticos;
        
        // Ativa animação CSS se houver erro
        const box = elCritico.closest('.kpi-box');
        if (totalCriticos > 0) {
            box.classList.add('critico'); // Usa a classe do seu CSS
            box.classList.add('piscando');
        } else {
            box.classList.remove('critico', 'piscando');
        }
    }

    // 3. Bombas Ativas
    if (elAtivas) {
        elAtivas.innerText = (data.bombas || []).filter(b => b.estado === "ligada").length;
    }
}

// =======================
// CONEXÃO & UTILITÁRIOS
// =======================

function conectarWS() {
    if (ws) ws.close();
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);

    ws.onopen = () => setStatus("🟢 Tempo real conectado");
    ws.onmessage = (msg) => {
        try { processarPayload(JSON.parse(msg.data)); } 
        catch (e) { console.error("Erro WS:", e); }
    };
    ws.onclose = () => {
        setStatus("🔴 Reconectando...");
        setTimeout(conectarWS, reconnectDelay);
    };
}

async function fallbackHTTP() {
    try {
        const res = await fetch(API + "?t=" + Date.now());
        if (!res.ok) throw new Error();
        const data = await res.json();
        processarPayload(data);
    } catch (err) {
        if (!ws || ws.readyState !== 1) setStatus("🔴 Erro de comunicação");
    }
}

function setStatus(txt) {
    const el = document.getElementById("statusSistema");
    if (el) el.innerText = txt;
}

function formatar(n) {
    return Number(n || 0).toLocaleString("pt-BR");
}

function corNivel(p) {
    if (p >= 70) return ["#00ff88", "#00c853"];
    if (p >= 35) return ["#ffd600", "#ff8f00"];
    return ["#ff1744", "#b71c1c"];
}
