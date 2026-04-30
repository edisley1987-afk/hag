/**
 * Dashboard HAG - Hospital Arnaldo Gavazza
 * Versão FINAL ESTÁVEL (com suporte a estado desconhecido das bombas)
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
    // 🚀 carrega imediatamente
    fallbackHTTP();

    conectarWS();

    // fallback a cada 8s
    setInterval(fallbackHTTP, 8000);

    // monitor de comunicação
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

    // trata websocket
    if (payload.type === "update" && payload.dados) {
        payload = payload.dados;
    }

    ultimoDado = Date.now();

    // usa backend direto
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
    if (elHora) elHora.innerText = data.lastUpdate || "-";

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
        
        // --- LÓGICA DE CLASSE ---
        // Determina a classe com base na porcentagem
        let classeBorda = '';
        if (r.percent >= 70) classeBorda = 'border-alto';
        else if (r.percent >= 40) classeBorda = 'border-medio';
        else if (r.percent >= 20) classeBorda = 'border-baixo';
        else classeBorda = 'border-critico';

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio"; // A classe será aplicada aqui

            el.innerHTML = `
                <h2>${r.nome}</h2>
                <div class="tanque">...</div>
                <div class="info">...</div>
            `;
            area.appendChild(el);
        }

        // --- ATUALIZAÇÃO ---
        // Atualiza as classes do elemento (remove as antigas e adiciona a nova)
        el.className = `card reservatorio ${classeBorda}`;

        // Restante do seu código de renderização...
        const agua = el.querySelector(".agua");
        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");

        agua.style.height = `${Math.min(100, Math.max(0, r.percent))}%`;
        agua.style.background = `linear-gradient(180deg, ${cor1}, ${cor2})`;

        valor.innerText = `${r.percent}%`;
        litros.innerText = `${formatar(r.current_liters)} L`;
    });
}

// =======================
// BOMBAS (COM FAIL-SAFE VISUAL)
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

        el.className = `card bomba ${
            desconhecido ? "stale" : ligada ? "ligada" : "desligada"
        }`;

        el.querySelector("h2").innerText = b.nome;

        el.querySelector(".status-icon").innerText =
            desconhecido ? "⚪" : ligada ? "🟢" : "🔴";

        el.querySelector(".valor").innerText =
            desconhecido ? "SEM DADOS" : ligada ? "EM OPERAÇÃO" : "INATIVA";

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
        el.querySelector(".valor-pressao").innerText =
            `${Number(p.pressao || 0).toFixed(2)} bar`;
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
        const res = await fetch(API + "?t=" + Date.now());

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
    if (p >= 70) return ["#00ff88", "#00c853"];
    if (p >= 40) return ["#ffd600", "#ff8f00"];
    return ["#ff1744", "#b71c1c"];
}

function atualizarKPIs(data) {
    const elCritico = document.getElementById("kpiCritico");
    const elAtivas = document.getElementById("bombasAtivas");

    if (elCritico) {
        elCritico.innerText =
            (data.reservatorios || []).filter(r => r.percent < 30).length;
    }

    if (elAtivas) {
        elAtivas.innerText =
            (data.bombas || []).filter(b => b.estado === "ligada").length;
    }
}
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Dashboard HAG</title>
    <link rel="stylesheet" href="style.css"> 
</head>
<body>
    
    <div id="areaReservatorios"></div>

    <script>
        // Todo o seu código JS (dashboard.js) vem aqui dentro
        // Sem tags HTML no meio!
        
        function atualizarKPIs(data) {
             // ... seu código original ...
        }

        // Função de bordas que você queria adicionar:
        function atualizarBordas() {
            const cards = document.querySelectorAll('.card.reservatorio');
            cards.forEach(card => {
                const valorTexto = card.querySelector('.valor').innerText;
                const porcentagem = parseInt(valorTexto);

                card.classList.remove('border-alto', 'border-medio', 'border-baixo', 'border-critico');

                if (porcentagem >= 70) card.classList.add('border-alto');
                else if (porcentagem >= 40) card.classList.add('border-medio');
                else if (porcentagem >= 20) card.classList.add('border-baixo');
                else card.classList.add('border-critico');
            });
        }
    </script>
</body>
</html>
