// ========================= CONFIG =========================
const API = "/api/dashboard";

// Manutenção salva
let manutencao = JSON.parse(localStorage.getItem("manutencao")) || {};

// Últimas leituras em caso de falha de API
let ultimasLeituras = {};

// === Alertas ===
let alertaAtivo = {};
let alertaSemAtualizacao = {};
let bipIntervalos = {};
let alertaNivel31 = {};
let bipNivelIntervalo = {};
let alertaReservatoriosCriticos = [];


// ========================= LOOP PRINCIPAL =========================
async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw new Error("API retornou " + r.status);

        const dados = await r.json();
        const globalTs = dados.lastUpdate || new Date().toISOString();

        // RESERVATÓRIOS
        if (dados.reservatorios) {
            dados.reservatorios.forEach(rsv => {
                const ts = rsv.timestamp || globalTs;
                ultimasLeituras[rsv.setor] = {
                    ...rsv,
                    timestamp: ts
                };
            });
        }

        // PRESSÕES
        if (dados.pressoes) {
            dados.pressoes.forEach(p => {
                const ts = p.timestamp || globalTs;
                ultimasLeituras[p.setor] = {
                    ...ultimasLeituras[p.setor],
                    pressao: p.pressao,
                    timestamp: ts
                };
            });
        }

        // BOMBAS (AGORA SÃO 3)
        if (dados.bombas) {
            dados.bombas.forEach((b, i) => {
                const setor = `bomba${i + 1}`;
                const ts = b.timestamp || globalTs;
                ultimasLeituras[setor] = {
                    ...ultimasLeituras[setor],
                    ...b,
                    timestamp: ts
                };
            });
        }

        render(dados);

        const displayTs =
            globalTs === "-"
                ? new Date().toLocaleTimeString()
                : new Date(globalTs).toLocaleTimeString();

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + displayTs;

    } catch (e) {
        console.error("Erro ao atualizar dados:", e);

        document.getElementById("lastUpdate").textContent =
            "Erro ao atualizar…";

        // Fallback
        render({
            reservatorios: Object.values(ultimasLeituras).filter(r => r.capacidade),
            pressoes: Object.values(ultimasLeituras).filter(p => p.pressao !== undefined),

            // Aqui incluímos as 3 bombas
            bombas: [
                ultimasLeituras["bomba1"] || {},
                ultimasLeituras["bomba2"] || {},
                ultimasLeituras["bomba3"] || {}
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
        o.frequency.setValueAtTime(600, ctx.currentTime);
        o.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.12);
    } catch (e) {
        console.warn("bipCurto falhou:", e?.message);
    }
}


// ========================= CONTROLLER =========================
function render(d) {
    renderReservatorios(d.reservatorios || []);
    renderPressao(d.pressoes || []);
    renderBombas(d.bombas || []);
}


// ========================= ALERTA DE NÍVEL BAIXO =========================
function exibirAlertaNivel(reservatorios) {
    const box = document.getElementById("alerta-nivelbaixo");
    if (!box) return;

    if (reservatorios.length === 0) {
        box.style.display = "none";
        box.innerHTML = "";
        return;
    }

    box.style.display = "block";
    box.innerHTML = `⚠️ Reservatórios abaixo de 40%: <b>${reservatorios.join(", ")}</b>`;
}


// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
    const box = document.getElementById("reservatoriosContainer");
    const frag = document.createDocumentFragment();

    let alertas40 = [];
    const agora = Date.now();

    alertaReservatoriosCriticos = [];

    lista.forEach(r => {
        const percent = (typeof r.percent === "number") ? Math.round(r.percent) : (r.percent || 0);
        const litros = r.current_liters ?? "--";
        const capacidade = r.capacidade || (r.setor === "elevador" ? 20000 : undefined);

        const card = document.createElement("div");
        card.className = "card-reservatorio";

        if (percent <= 30) card.classList.add("nv-critico");
        else if (percent <= 60) card.classList.add("nv-alerta");
        else if (percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        const ts =
            r.timestamp ||
            (ultimasLeituras[r.setor] && ultimasLeituras[r.setor].timestamp) ||
            new Date().toISOString();

        // ALERTA <31%
        if (percent < 31 && manutencao[r.setor] !== true) {
            if (!alertaReservatoriosCriticos.includes(r.nome)) {
                alertaReservatoriosCriticos.push(r.nome);
            }
            card.classList.add("piscar-31");

            if (!alertaNivel31[r.setor]) {
                alertaNivel31[r.setor] = true;
                bipNivelIntervalo[r.setor] = setInterval(() => bipCurto(), 3000);
            }
        } else {
            alertaNivel31[r.setor] = false;
            if (bipNivelIntervalo[r.setor]) {
                clearInterval(bipNivelIntervalo[r.setor]);
                delete bipNivelIntervalo[r.setor];
            }
        }

        // ALERTA <=40%
        if (percent <= 40 && manutencao[r.setor] !== true) {
            if (!alertaAtivo[r.setor]) {
                bipCurto();
                alertaAtivo[r.setor] = true;
            }
            alertas40.push(`${r.nome} (${percent}%)`);
        } else {
            alertaAtivo[r.setor] = false;
        }

        // TEMPO SEM ATUALIZAR
        let msgTimeout = "";
        if (ts) {
            const diffMin = (agora - new Date(ts).getTime()) / 60000;

            if (diffMin > 10) {
                msgTimeout = `<div class="msg-sem-atualizacao">⚠ Sem atualização há mais de 10 minutos</div>`;

                if (!alertaSemAtualizacao[r.setor]) {
                    alertaSemAtualizacao[r.setor] = true;
                    bipIntervalos[r.setor] = setInterval(() => bipCurto(), 3000);
                }
            } else {
                alertaSemAtualizacao[r.setor] = false;
                if (bipIntervalos[r.setor]) {
                    clearInterval(bipIntervalos[r.setor]);
                    delete bipIntervalos[r.setor];
                }
            }
        }

        let emManut = manutencao[r.setor] === true;
        if (percent > 41) emManut = false;
        if (emManut) card.classList.add("manutencao");
        const msgMan = emManut ? `<div class="msg-manutencao">🔧 EM MANUTENÇÃO</div>` : "";

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

            ${msgMan}
            ${msgTimeout}

            <button onclick="abrirHistorico('${r.setor}')">📊 Histórico</button>
            <p>Capacidade: ${capacidade ? capacidade + " L" : "N/A"}</p>
        `;

        frag.appendChild(card);

        ultimasLeituras[r.setor] = {
            nome: r.nome,
            percent,
            current_liters: litros,
            capacidade,
            timestamp: ts
        };
    });

    box.innerHTML = "";
    box.appendChild(frag);

    exibirAlertaNivel(alertas40);
}


// ========================= PRESSÕES =========================
function renderPressao(lista) {
    const mapa = {
        "saida_osmose": "pSaidaOsmose",
        "retorno_osmose": "pRetornoOsmose",
        "saida_cme": "pSaidaCME"
    };

    lista.forEach(p => {
        const id = mapa[p.setor];
        const span = document.getElementById(id);
        if (!span) return;

        if (p.pressao !== undefined && p.pressao !== null) {
            span.textContent = Number(p.pressao).toFixed(2);
            ultimasLeituras[p.setor] = {
                ...ultimasLeituras[p.setor],
                pressao: Number(p.pressao),
                timestamp: p.timestamp || ultimasLeituras[p.setor]?.timestamp || new Date().toISOString()
            };
        }
    });
}


// ========================= BOMBAS (AGORA COM 3 BOMBAS) =========================
function renderBombas(lista) {
    lista.forEach((b, i) => {
        const id = `bomba${i + 1}`;
        const el = document.getElementById(id);
        if (!el) return;

        const ligada =
            b.estado_num === 1 ||
            b.estado === "ligada" ||
            b.estado === 1;

        el.classList.toggle("bomba-ligada", ligada);
        el.classList.toggle("bomba-desligada", !ligada);

        // IDs no HTML
        const statusId = `b${i + 1}Status`;
        const cicloId = `b${i + 1}Ciclos`;

        if (document.getElementById(statusId)) {
            document.getElementById(statusId).textContent =
                b.estado || (ligada ? "ligada" : "desligada") || "--";
        }

        if (document.getElementById(cicloId)) {
            document.getElementById(cicloId).textContent =
                b.ciclo !== undefined ? b.ciclo : (b.ciclos || 0);
        }

        ultimasLeituras[`bomba${i + 1}`] = {
            nome: b.nome || `Bomba ${i + 1}`,
            estado_num: b.estado_num,
            estado: b.estado,
            ciclo: b.ciclo || 0,
            timestamp: b.timestamp || new Date().toISOString()
        };
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
