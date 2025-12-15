// ========================= CONFIG =========================
const API = "/api/dashboard";

// Manutenção salva
let manutencao = JSON.parse(localStorage.getItem("manutencao")) || {};

// Últimas leituras (fallback)
let ultimasLeituras = {};

// === Alertas ===
let alertaAtivo = {};
let alertaSemAtualizacao = {};
let bipIntervalos = {};
let alertaNivel31 = {};
let bipNivelIntervalo = {};
let alertaReservatoriosCriticos = [];


// ========================= LOOP HTTP (BASE) =========================
async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw new Error("API retornou " + r.status);

        const dados = await r.json();
        const globalTs = dados.lastUpdate || new Date().toISOString();

        // RESERVATÓRIOS
        if (dados.reservatorios) {
            dados.reservatorios.forEach(rsv => {
                ultimasLeituras[rsv.setor] = { ...rsv, timestamp: rsv.timestamp || globalTs };
            });
        }

        // PRESSÕES
        if (dados.pressoes) {
            dados.pressoes.forEach(p => {
                ultimasLeituras[p.setor] = {
                    ...ultimasLeituras[p.setor],
                    pressao: p.pressao,
                    timestamp: p.timestamp || globalTs
                };
            });
        }

        // BOMBAS (3)
        if (dados.bombas) {
            dados.bombas.forEach((b, i) => {
                ultimasLeituras[`bomba${i + 1}`] = { ...b, timestamp: b.timestamp || globalTs };
            });
        }

        render(dados);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date(globalTs).toLocaleTimeString();

    } catch (e) {
        console.error("Erro HTTP:", e);

        document.getElementById("lastUpdate").textContent = "Erro ao atualizar…";

        render({
            reservatorios: Object.values(ultimasLeituras).filter(r => r.capacidade),
            pressoes: Object.values(ultimasLeituras).filter(p => p.pressao !== undefined),
            bombas: [
                ultimasLeituras.bomba1 || {},
                ultimasLeituras.bomba2 || {},
                ultimasLeituras.bomba3 || {}
            ]
        });
    }
}

setInterval(atualizar, 5000);
atualizar();


// ========================= SOM =========================
function bipCurto() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = 600;
        o.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.12);
    } catch {}
}


// ========================= CONTROLLER =========================
function render(d) {
    renderReservatorios(d.reservatorios || []);
    renderPressao(d.pressoes || []);
    renderBombas(d.bombas || []);
}


// ========================= ALERTA DE NÍVEL =========================
function exibirAlertaNivel(lista) {
    const box = document.getElementById("alerta-nivelbaixo");
    if (!box) return;

    if (!lista.length) {
        box.style.display = "none";
        return;
    }

    box.style.display = "block";
    box.innerHTML = `⚠️ Reservatórios abaixo de 40%: <b>${lista.join(", ")}</b>`;
}


// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
    const box = document.getElementById("reservatoriosContainer");
    const frag = document.createDocumentFragment();
    let alertas40 = [];
    const agora = Date.now();

    lista.forEach(r => {
        const percent = Math.round(r.percent || 0);
        const litros = r.current_liters ?? "--";
        const ts = r.timestamp || new Date().toISOString();

        const card = document.createElement("div");
        card.className = "card-reservatorio";

        if (percent <= 30) card.classList.add("nv-critico");
        else if (percent <= 60) card.classList.add("nv-alerta");
        else if (percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        // ALERTAS
        if (percent < 31 && !manutencao[r.setor]) {
            card.classList.add("piscar-31");
            if (!alertaNivel31[r.setor]) {
                alertaNivel31[r.setor] = true;
                bipNivelIntervalo[r.setor] = setInterval(bipCurto, 3000);
            }
        } else {
            clearInterval(bipNivelIntervalo[r.setor]);
            delete alertaNivel31[r.setor];
        }

        if (percent <= 40 && !manutencao[r.setor]) {
            if (!alertaAtivo[r.setor]) bipCurto();
            alertaAtivo[r.setor] = true;
            alertas40.push(`${r.nome} (${percent}%)`);
        } else alertaAtivo[r.setor] = false;

        // TIMEOUT
        let msgTimeout = "";
        if ((agora - new Date(ts)) / 60000 > 10) {
            msgTimeout = `<div class="msg-sem-atualizacao">⚠ Sem atualização &gt; 10 min</div>`;
        }

        card.innerHTML = `
            <div class="top-bar">
                <h3>${r.nome}</h3>
                <button class="gear-btn" onclick="toggleManutencao('${r.setor}')">⚙</button>
            </div>
            <div class="tanque-visu">
                <div class="nivel-agua" style="height:${percent}%"></div>
                <div class="overlay-info">
                    <div class="percent-text">${percent}%</div>
                    <div class="liters-text">${litros} L</div>
                </div>
            </div>
            ${msgTimeout}
            <button onclick="abrirHistorico('${r.setor}')">📊 Histórico</button>
        `;

        frag.appendChild(card);
        ultimasLeituras[r.setor] = r;
    });

    box.innerHTML = "";
    box.appendChild(frag);
    exibirAlertaNivel(alertas40);
}


// ========================= PRESSÕES =========================
function renderPressao(lista) {
    const mapa = {
        saida_osmose: "pSaidaOsmose",
        retorno_osmose: "pRetornoOsmose",
        saida_cme: "pSaidaCME"
    };

    lista.forEach(p => {
        const el = document.getElementById(mapa[p.setor]);
        if (el) el.textContent = Number(p.pressao).toFixed(2);
    });
}


// ========================= BOMBAS =========================
function renderBombas(lista) {
    lista.forEach((b, i) => {
        const el = document.getElementById(`bomba${i + 1}`);
        if (!el) return;

        const ligada = b.estado_num === 1 || b.estado === 1 || b.estado === "ligada";

        el.classList.toggle("bomba-ligada", ligada);
        el.classList.toggle("bomba-desligada", !ligada);

        document.getElementById(`b${i + 1}Status`).textContent = ligada ? "Ligada" : "Desligada";
        document.getElementById(`b${i + 1}Ciclos`).textContent = b.ciclo || 0;

        ultimasLeituras[`bomba${i + 1}`] = b;
    });
}


// ========================= MANUTENÇÃO =========================
function toggleManutencao(setor) {
    manutencao[setor] = !manutencao[setor];
    localStorage.setItem("manutencao", JSON.stringify(manutencao));
}

function abrirHistorico(setor) {
    location.href = `/historico.html?setor=${setor}`;
}


// ========================= WEBSOCKET =========================
let ws;

function connectWS() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.onopen = () => console.log("✅ WS conectado");

    ws.onmessage = e => {
        try {
            const msg = JSON.parse(e.data);
            if (msg.type === "update" && msg.dados) {
                render(msg.dados);

                // Atualiza fallback
                msg.dados.reservatorios?.forEach(r => ultimasLeituras[r.setor] = r);
                msg.dados.pressoes?.forEach(p => ultimasLeituras[p.setor] = p);
                msg.dados.bombas?.forEach((b, i) => ultimasLeituras[`bomba${i + 1}`] = b);

                document.getElementById("lastUpdate").textContent =
                    "Tempo real " + new Date().toLocaleTimeString();
            }
        } catch {}
    };

    ws.onclose = () => setTimeout(connectWS, 3000);
    ws.onerror = () => ws.close();
}

connectWS();
