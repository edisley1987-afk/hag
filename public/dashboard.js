// ========================= CONFIG =========================
const API = "/api/dashboard";

async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw 0;

        const dados = await r.json();        
        const convertido = converterDados(dados);

        render(convertido);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date().toLocaleTimeString();

    } catch (e) {
        console.error("Erro ao atualizar dados:", e);
        document.getElementById("lastUpdate").textContent =
            "Erro ao atualizar…";
    }
}

setInterval(atualizar, 5000);
atualizar();


// ========================= CONVERSOR =========================
// Converte o objeto bruto do servidor → formato usado no HTML
function converterDados(d) {

    // ----- RESERVATÓRIOS -----
    const reservatorios = [
        {
            nome: "Reservatório Elevador",
            current_liters: d.Reservatorio_Elevador_current,
            capacidade: 20000,
            percent: Math.round((d.Reservatorio_Elevador_current / 20000) * 100),
            setor: "elevador"
        },
        {
            nome: "Reservatório Osmose",
            current_liters: d.Reservatorio_Osmose_current,
            capacidade: 200,
            percent: Math.round((d.Reservatorio_Osmose_current / 200) * 100),
            setor: "osmose"
        },
        {
            nome: "Reservatório CME",
            current_liters: d.Reservatorio_CME_current,
            capacidade: 1000,
            percent: Math.round((d.Reservatorio_CME_current / 1000) * 100),
            setor: "cme"
        },
        {
            nome: "Água Abrandada",
            current_liters: d.Reservatorio_Agua_Abrandada_current,
            capacidade: 9000,
            percent: Math.round((d.Reservatorio_Agua_Abrandada_current / 9000) * 100),
            setor: "abrandada"
        },
        {
            nome: "Lavanderia",
            current_liters: d.Reservatorio_lavanderia_current,
            capacidade: 10000,
            percent: Math.round((d.Reservatorio_lavanderia_current / 10000) * 100),
            setor: "lavanderia"
        }
    ];

    // ----- PRESSÕES -----
    const pressoes = [
        { nome: "Pressão Saída Osmose", pressao: d.Pressao_Saida_Osmose_current },
        { nome: "Pressão Retorno Osmose", pressao: d.Pressao_Retorno_Osmose_current },
        { nome: "Pressão Saída CME", pressao: d.Pressao_Saida_CME_current }
    ];

    // ----- BOMBAS -----
    const bombas = [
        {
            nome: "Bomba 01",
            estado: d.Bomba_02_binary === 1 ? "LIGADA" : "DESLIGADA",  // invertidas
            ciclo: d.Ciclos_Bomba_02_counter
        },
        {
            nome: "Bomba 02",
            estado: d.Bomba_01_binary === 1 ? "LIGADA" : "DESLIGADA",
            ciclo: d.Ciclos_Bomba_01_counter
        }
    ];

    return { reservatorios, pressoes, bombas };
}


// ========================= RENDER =========================
function render(d) {
    renderReservatorios(d.reservatorios);
    renderPressao(d.pressoes);
    renderBombas(d.bombas);
}


// ========================= RESERVATÓRIOS =========================
function renderReservatorios(lista) {
    const box = document.getElementById("reservatoriosContainer");
    box.innerHTML = "";

    lista.forEach(r => {
        const card = document.createElement("div");
        card.className = "card-reservatorio";

        if (r.percent <= 30) card.classList.add("nv-critico");
        else if (r.percent <= 60) card.classList.add("nv-alerta");
        else if (r.percent <= 90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        card.innerHTML = `
            <h3>${r.nome}</h3>

            <div class="tanque-visu">
                <div class="nivel-agua" style="height:${r.percent}%"></div>
                <div class="overlay-info">
                    <div class="percent-text">${r.percent}%</div>
                    <div class="liters-text">${r.current_liters} L</div>
                </div>
            </div>

            <button onclick="abrirHistorico('${r.setor}')">📊 Histórico</button>
            <p>Capacidade: ${r.capacidade} L</p>
        `;

        box.appendChild(card);
    });
}

function abrirHistorico(setor) {
    location.href = `/historico.html?setor=${setor}`;
}


// ========================= PRESSÕES =========================
function renderPressao(lista) {
    const mapa = {
        "Pressão Saída Osmose": "pSaidaOsmose",
        "Pressão Retorno Osmose": "pRetornoOsmose",
        "Pressão Saída CME": "pSaidaCME"
    };

    lista.forEach(p => {
        const id = mapa[p.nome];
        const span = document.getElementById(id);
        if (span) span.textContent = p.pressao.toFixed(2);
    });
}


// ========================= BOMBAS =========================
function renderBombas(lista) {
    lista.forEach((b, i) => {
        const id = `bomba${i + 1}`;
        const el = document.getElementById(id);

        if (!el) return;

        const ligada = b.estado === "LIGADA";

        el.classList.toggle("bomba-ligada", ligada);
        el.classList.toggle("bomba-desligada", !ligada);

        document.getElementById(`b${i + 1}Status`).textContent = b.estado;
        document.getElementById(`b${i + 1}Ciclos`).textContent = b.ciclo;
    });
}
