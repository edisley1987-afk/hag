// ================================ CONFIG ================================
const API = "/api/dashboard";

let cache = JSON.parse(localStorage.getItem("DATA_CACHE")) || {};
let tempoLigada = JSON.parse(localStorage.getItem("TEMPO_BOMBAS")) || {};
let tempoDesligada = JSON.parse(localStorage.getItem("TEMPO_DESLIGADAS")) || {};
let ultimaMudanca = JSON.parse(localStorage.getItem("ULTIMA_MUDANCA")) || {};
let ultimoEstado = JSON.parse(localStorage.getItem("ULTIMO_ESTADO")) || {};
let ultimoCiclo = JSON.parse(localStorage.getItem("ULTIMO_CICLO")) || {};

async function atualizar() {
    try {
        const r = await fetch(API, { cache: "no-store" });
        if (!r.ok) throw 0;
        const dados = await r.json();
        cache = dados;

        localStorage.setItem("DATA_CACHE", JSON.stringify(dados));

        processarBombas(dados.bombas);
        render(dados);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date().toLocaleTimeString();

    } catch {
        console.warn("⚠ Sem atualização — usando cache local.");
        processarBombas(cache.bombas || []);
        render(cache);

        document.getElementById("lastUpdate").textContent =
            "SEM SINAL — exibindo última leitura";
    }
}

setInterval(atualizar, 5000);
atualizar();


// ================================ RENDER =================================
function render(d) {
    if (!d) return;
    renderReservatorios(d.reservatorios);
    renderPressao(d.pressoes);
    renderBombas(d.bombas);
}


// ========================== RESERVATÓRIOS ===============================
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


// ============================= 🟡 PRESSÕES =================================
function renderPressao(lista) {
    const pressaoMap = {
        "Pressão Saída Osmose": "pSaidaOsmose",
        "Pressão Retorno Osmose": "pRetornoOsmose",
        "Pressão Saída CME": "pSaidaCME"
    };

    lista.forEach(p => {
        const id = pressaoMap[p.nome];
        if (!id) return console.warn("Pressão não mapeada →", p.nome);

        const el = document.getElementById(id);
        if (el) el.textContent = p.pressao.toFixed(2);
    });
}


// ============================== 🔥 BOMBAS ==================================
function normalizarEstado(e) {
    return e?.toString().trim().toUpperCase();
}

/*
    🔧 Correção aplicada aqui:
    Os nomes do gateway estavam invertidos:
    - Bomba_01 no gateway = Bomba 02 no site
    - Bomba_02 no gateway = Bomba 01 no site
*/
function corrigirOrdemBombas(lista) {
    if (lista.length === 2) {
        return [
            lista[1], // Bomba 02 REAL → mostrar como Bomba 01
            lista[0]  // Bomba 01 REAL → mostrar como Bomba 02
        ];
    }
    return lista;
}

function processarBombas(listaOriginal) {

    const lista = corrigirOrdemBombas(listaOriginal);

    lista.forEach(b => {
        const nome = b.nome;
        const estado = normalizarEstado(b.estado);
        const agora = Date.now();

        if (!(nome in tempoLigada)) tempoLigada[nome] = 0;
        if (!(nome in tempoDesligada)) tempoDesligada[nome] = 0;
        if (!(nome in ultimaMudanca)) ultimaMudanca[nome] = agora;
        if (!(nome in ultimoEstado)) ultimoEstado[nome] = estado;
        if (!(nome in ultimoCiclo)) ultimoCiclo[nome] = { ligado: 0, desligado: 0 };

        const passou = (agora - ultimaMudanca[nome]) / 1000;

        if (estado !== ultimoEstado[nome]) {
            if (ultimoEstado[nome] === "LIGADA") ultimoCiclo[nome].ligado = passou;
            else ultimoCiclo[nome].desligado = passou;

            ultimoEstado[nome] = estado;
            ultimaMudanca[nome] = agora;
        }

        if (estado === "LIGADA") tempoLigada[nome] += passou;
        else tempoDesligada[nome] += passou;

        ultimaMudanca[nome] = agora;
    });

    localStorage.setItem("TEMPO_BOMBAS", JSON.stringify(tempoLigada));
    localStorage.setItem("TEMPO_DESLIGADAS", JSON.stringify(tempoDesligada));
    localStorage.setItem("ULTIMA_MUDANCA", JSON.stringify(ultimaMudanca));
    localStorage.setItem("ULTIMO_ESTADO", JSON.stringify(ultimoEstado));
    localStorage.setItem("ULTIMO_CICLO", JSON.stringify(ultimoCiclo));
}

function renderBombas(listaOriginal) {
    const lista = corrigirOrdemBombas(listaOriginal);

    lista.forEach((b, i) => {
        const id = `bomba${i + 1}`;
        const el = document.getElementById(id);
        if (!el) return;

        const estado = normalizarEstado(b.estado);
        el.classList.toggle("bomba-ligada", estado === "LIGADA");
        el.classList.toggle("bomba-desligada", estado !== "LIGADA");

        document.getElementById(`b${i+1}Status`).textContent = estado;
        document.getElementById(`b${i+1}Ciclos`).textContent = b.ciclo;
    });
}
