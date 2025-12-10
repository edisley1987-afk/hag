// ========================= CONFIG =========================
const API = "/api/dashboard";

// Manutenção salva
let manutencao = JSON.parse(localStorage.getItem("manutencao")) || {};

// Últimas leituras em caso de falha de API
let ultimasLeituras = {};

// === Alertas ===
let alertaAtivo = {};                 // alerta <=40%
let alertaSemAtualizacao = {};        // timeout > 10 minutos
let bipIntervalos = {};               // intervalos de timeout
let alertaNivel31 = {};               // alerta <31%
let bipNivelIntervalo = {};           // bip para nivel <31%
let alertaReservatoriosCriticos = []; // painel superior

// ========================= LOOP PRINCIPAL =========================
async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw 0;

        const dados = await r.json();

        // Guardar timestamp por setor
        if (dados.reservatorios) {
            dados.reservatorios.forEach(rsv => {
                ultimasLeituras[rsv.setor] = {
                    ...rsv,
                    timestamp: dados.lastUpdate
                };
            });
        }
        if (dados.pressoes) {
            dados.pressoes.forEach(p => {
                ultimasLeituras[p.setor] = {
                    ...ultimasLeituras[p.setor],
                    pressao: p.pressao,
                    timestamp: dados.lastUpdate
                };
            });
        }
        if (dados.bombas) {
            dados.bombas.forEach((b, i) => {
                const setor = `bomba${i + 1}`;
                ultimasLeituras[setor] = {
                    ...ultimasLeituras[setor],
                    ...b,
                    timestamp: dados.lastUpdate
                };
            });
        }

        render(dados);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date().toLocaleTimeString();

    } catch (e) {
        console.error("Erro ao atualizar dados:", e);

        document.getElementById("lastUpdate").textContent = "Erro ao atualizar…";

        render({
            reservatorios: Object.values(ultimasLeituras).filter(r => r.capacidade),
            pressoes: Object.values(ultimasLeituras).filter(p => p.pressao !== undefined),
            bombas: [
                ultimasLeituras["bomba1"] || {},
                ultimasLeituras["bomba2"] || {}
            ]
        });
    }
}

setInterval(atualizar, 5000);
atualizar();

// ========================= SOM =========================
function bipCurto() {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.12);
}

// ========================= CONTROLLER =========================
function render(d) {
    renderReservatorios(d.reservatorios);
    renderPressao(d.pressoes);
    renderBombas(d.bombas);
}

// ========================= ALERTA DE NÍVEL BAIXO (<=40%) =========================
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

// ========================= PAINEL DE CRÍTICOS (<31%) =========================
function atualizarPainelCriticos() {
    const box = document.getElementById("painel-criticos");
    if (!box) return;

    if (alertaReservatoriosCriticos.length === 0) {
        box.style.display = "none";
        return;
    }

    box.style.display = "block";
    box.innerHTML =
        `🚨 Reservatórios críticos (<31%): <b>${alertaReservatoriosCriticos.join(", ")}</b>`;
}

// Notificação (WhatsApp/Telegram - futura API)
function enviarNotificacaoCritica(setor, percent) {
    console.log(`⚠ ENVIAR ALERTA: ${setor} crítico (${percent}%)`);
    // Depois ativamos seu backend:
    // fetch("/api/alerta", {...})
}

// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
    const box = document.getElementById("reservatoriosContainer");
    const frag = document.createDocumentFragment();

    let alertas40 = [];
    const agora = Date.now();

    alertaReservatoriosCriticos = [];

    lista.forEach(r => {

        const percent = r.percent || 0;

        const card = document.createElement("div");
        card.className = "card-reservatorio";

        // COR DO ESTADO
        if (percent <= 30) card.classList.add("nv-critico");
        else if (percent <= 60) card.classList.add("nv-alerta");
        else if (percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        // ======= ALERTA CRÍTICO <31% =======
        if (percent < 31 && manutencao[r.setor] !== true) {

            // Painel topo
            if (!alertaReservatoriosCriticos.includes(r.nome)) {
                alertaReservatoriosCriticos.push(r.nome);
            }

            // Piscar em vermelho
            card.classList.add("piscar-31");

            // Bip repetido
            if (!alertaNivel31[r.setor]) {
                alertaNivel31[r.setor] = true;

                bipNivelIntervalo[r.setor] = setInterval(() => bipCurto(), 3000);

                enviarNotificacaoCritica(r.nome, percent);
            }

        } else {
            // parar bip se saiu do crítico
            alertaNivel31[r.setor] = false;

            if (bipNivelIntervalo[r.setor]) {
                clearInterval(bipNivelIntervalo[r.setor]);
                delete bipNivelIntervalo[r.setor];
            }
        }

        // ======= ALERTA <=40% (visuais e bip único) =======
        if (percent <= 40 && manutencao[r.setor] !== true) {
            if (!alertaAtivo[r.setor]) {
                bipCurto();
                alertaAtivo[r.setor] = true;
            }
            alertas40.push(`${r.nome} (${percent}%)`);
        } else {
            alertaAtivo[r.setor] = false;
        }

        // ======= ALERTA >10 minutos sem atualização =======
        let msgTimeout = "";
        if (r.timestamp) {
            const diffMin = (agora - new Date(r.timestamp).getTime()) / 60000;

            if (diffMin > 10) {
                msgTimeout =
                    `<div class="msg-sem-atualizacao">⚠ Sem atualização há mais de 10 minutos</div>`;

                // bip contínuo
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

        // ========================= HTML DO CARD =========================
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
                    <div class="liters-text">${r.current_liters} L</div>
                </div>
            </div>

            ${msgMan}
            ${msgTimeout}

            <button onclick="abrirHistorico('${r.setor}')">📊 Histórico</button>
            <p>Capacidade: ${r.capacidade} L</p>
        `;

        frag.appendChild(card);
    });

    box.innerHTML = "";
    box.appendChild(frag);

    exibirAlertaNivel(alertas40);
    atualizarPainelCriticos();
}

// ========================= MANUTENÇÃO =========================
function toggleManutencao(setor) {
    manutencao[setor] = !manutencao[setor];
    localStorage.setItem("manutencao", JSON.stringify(manutencao));
}
function abrirHistorico(setor) {
    location.href = `/historico.html?setor=${setor}`;
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
        if (span && p.pressao !== undefined) span.textContent = p.pressao.toFixed(2);
    });
}

// ========================= BOMBAS =========================
function renderBombas(lista) {
    lista.forEach((b, i) => {
        const id = `bomba${i + 1}`;
        const el = document.getElementById(id);

        if (!el) return;

        const ligada = b.estado_num === 1;

        el.classList.toggle("bomba-ligada", ligada);
        el.classList.toggle("bomba-desligada", !ligada);

        document.getElementById(`b${i + 1}Status`).textContent = b.estado || "--";
        document.getElementById(`b${i + 1}Ciclos`).textContent = b.ciclo || 0;
    });
}
