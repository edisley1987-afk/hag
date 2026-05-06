/**
 * Dashboard HAG 3D - Hospital Arnaldo Gavazza
 * Versão 1.0.3 - Com efeito de água animado
 */

const API = "/api/dashboard";
let ws = null;
let reconnectDelay = 3000;
let ultimoDado = Date.now();
let renderPending = false;
let chartHistorico = null;

// ======================= INIT =======================
init();

function init() {
    carregarHistorico();
    fallbackHTTP();
    conectarWS();
    setInterval(fallbackHTTP, 8000);

    // Timeout de sinal
    setInterval(() => {
        if (Date.now() - ultimoDado > 15000) {
            atualizarStatusVisual("Sem sinal");
            document.body.classList.add("sem-sinal");
        } else {
            document.body.classList.remove("sem-sinal");
            atualizarStatusVisual("Tempo real conectado");
        }
    }, 5000);
}

// ======================= PROCESSAMENTO DE DADOS =======================
function processarPayload(payload) {
    if (!payload) return;
    if (payload.type === "update" && payload.dados) {
        payload = payload.dados;
    }
    ultimoDado = Date.now();
    scheduleRender(payload);
}

// ======================= RENDER OTIMIZADO =======================
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

// ======================= RESERVATÓRIOS 3D COM ÁGUA =======================
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
        const nivelAnterior = Number(agua.dataset.nivel || 0);

        // Animação de balanço quando o nível muda mais de 1%
        if (Math.abs(nivelSuavizado - nivelAnterior) >= 1) {
            agua.classList.add("balancando");
            setTimeout(() => agua.classList.remove("balancando"), 1300);
        }

        // Atualiza altura da água
        agua.style.height = `${nivelSuavizado}%`;
        agua.dataset.nivel = nivelSuavizado;

        // Aplica cor baseada no nível
        agua.className = "agua";
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

        // Alerta visual no card
        if (nivel < 20) {
            el.classList.add("alerta");
        } else {
            el.classList.remove("alerta");
        }

        // Atualiza valores
        valor.innerText = `${nivelSuavizado}%`;
        litros.innerText = `${formatar(r.current_liters)} L`;
    });
}

// ======================= BOMBAS =======================
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
            el.innerHTML = `
                <h2></h2>
                <div class="status-icon"></div>
                <div class="valor"></div>
                <div class="ciclos"></div>
            `;
            area.appendChild(el);
        }

        el.className = `card bomba ${desconhecido? "stale" : ligada? "ligada" : "desligada"}`;
        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".status-icon").innerText = desconhecido? "⚪" : ligada? "🟢" : "🔴";
        el.querySelector(".valor").innerText = desconhecido? "SEM DADOS" : ligada? "EM OPERAÇÃO" : "INATIVA";
        el.querySelector(".ciclos").innerText = `${b.ciclo || 0} ciclos`;
    });
}

// ======================= PRESSÕES =======================
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

// ======================= HISTÓRICO 7 DIAS =======================
async function carregarHistorico() {
    try {
        const res = await fetch("/historico", { cache: "no-store" });
        const data = await res.json();
        renderHistoricoChart(data);
    } catch (e) {
        console.error("Erro histórico:", e);
    }
}

function renderHistoricoChart(data) {
    const ctx = document.getElementById("chartHistorico");
    if (!ctx) return;

    const cores = {
        elevador: '#60a5fa',
        osmose: '#22c55e',
        cme: '#facc15',
        abrandada: '#f97316',
        lavanderia: '#a855f7'
    };

    const datasets = Object.keys(data).map(setor => ({
        label: setor.charAt(0).toUpperCase() + setor.slice(1),
        data: data[setor],
        borderWidth: 2,
        tension: 0.4,
        borderColor: cores[setor] || '#60a5fa',
        backgroundColor: cores[setor] || '#60a5fa',
        pointRadius: 2,
        pointHoverRadius: 5
    }));

    if (chartHistorico) chartHistorico.destroy();

    chartHistorico = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } },
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148,163,184,0.1)' }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { color: '#94a3b8', callback: v => v + '%' },
                    grid: { color: 'rgba(148,163,184,0.1)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#e2e8f0' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + '%';
                        }
                    }
                }
            }
        }
    });
}

// ======================= WEBSOCKET =======================
function conectarWS() {
    if (ws) ws.close();

    const protocolo = location.protocol === "https:"? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);

    ws.onopen = () => {
        console.log("🟢 WebSocket conectado");
        atualizarStatusVisual("Tempo real conectado");
    };

    ws.onmessage = (msg) => {
        try {
            processarPayload(JSON.parse(msg.data));
        } catch (e) {
            console.error("Erro WS:", e);
        }
    };

    ws.onclose = () => {
        console.log("🔴 WebSocket desconectado");
        atualizarStatusVisual("Reconectando...");
        setTimeout(conectarWS, reconnectDelay);
    };

    ws.onerror = (err) => {
        console.error("Erro WebSocket:", err);
    };
}

// ======================= FALLBACK HTTP =======================
async function fallbackHTTP() {
    try {
        const res = await fetch(API + "?t=" + Date.now(), {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        processarPayload(data);
    } catch (err) {
        if (!ws || ws.readyState!== 1) {
            atualizarStatusVisual("Desconectado");
        }
    }
}

// ======================= HELPERS =======================
function atualizarStatusVisual(texto) {
    const el = document.getElementById("statusTexto");
    const dot = document.querySelector(".status-dot");
    if (!el ||!dot) return;

    el.innerText = texto;
    if (texto.includes("Tempo real")) {
        dot.style.background = "#00ff88";
    } else if (texto.includes("Reconectando")) {
        dot.style.background = "#ffd600";
    } else {
        dot.style.background = "#ff3d00";
    }
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

    if (elCritico) {
        elCritico.innerText = (data.reservatorios || []).filter(r => r.percent < 30).length;
    }
    if (elAtivas) {
        elAtivas.innerText = (data.bombas || []).filter(b => b.estado === "ligada").length;
    }
    if (elElevador) {
        elElevador.innerText = `${formatar(data.kpis?.elevador_hoje || 0)} L`;
    }
    if (elLavanderia) {
        elLavanderia.innerText = `${formatar(data.kpis?.lavanderia_hoje || 0)} L`;
    }
    if (elOsmose) {
        elOsmose.innerText = `${formatar(data.kpis?.osmose_hoje || 0)} L`;
    }
}
