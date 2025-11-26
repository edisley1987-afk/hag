const API = "/api/dashboard";   // <<< URL ACERTADA
let cache = JSON.parse(localStorage.getItem("DATA_CACHE")) || {};

let tempoLigada = JSON.parse(localStorage.getItem("TEMPO_BOMBAS")) || {};
let tempoDesligada = JSON.parse(localStorage.getItem("TEMPO_DESLIGADAS")) || {};
let ultimaMudanca = JSON.parse(localStorage.getItem("ULTIMA_MUDANCA")) || {};
let ultimoEstado = JSON.parse(localStorage.getItem("ULTIMO_ESTADO")) || {};
let ultimoCiclo = JSON.parse(localStorage.getItem("ULTIMO_CICLO")) || {};

async function atualizar(){
    try{
        const r = await fetch(API,{cache:"no-store"});
        if(!r.ok) throw 0;
        const dados = await r.json();

        cache = dados;
        localStorage.setItem("DATA_CACHE",JSON.stringify(dados));

        processarBombas(dados.bombas);  
        render(dados);

        document.getElementById("lastUpdate").textContent =
            "Atualizado " + new Date().toLocaleTimeString();

    }catch{
        console.warn("Sem atualização, usando valores armazenados.");

        processarBombas(cache.bombas || []);
        render(cache);

        document.getElementById("lastUpdate").textContent =
            "SEM SINAL — exibindo última leitura";
    }
}
setInterval(atualizar,5000);
atualizar();

/* =================== RENDER =================== */
function render(d){
    if(!d) return;
    renderReservatorios(d.reservatorios);
    renderPressao(d.pressoes);
    renderBombas(d.bombas);
}

/* RESERVATÓRIOS */
function renderReservatorios(lista){
    const box=document.getElementById("reservatoriosContainer");
    box.innerHTML="";

    lista.forEach(r=>{
        const card=document.createElement("div");
        card.className="card-reservatorio";

        if(r.percent<=30) card.classList.add("nv-critico");
        else if(r.percent<=60) card.classList.add("nv-alerta");
        else if(r.percent<=90) card.classList.add("nv-normal");
        else card.classList.add("nv-cheio");

        card.innerHTML=`
        <h3>${r.nome}</h3>

        <div class="tanque-visu">
            <div class="nivel-agua" style="height:${r.percent}%"></div>
            <div class="overlay-info">
                <div class="percent-text">${r.percent}%</div>
                <div class="liters-text">${r.current_liters} L</div>
            </div>
        </div>

        <div class="alerta-msg">⚠ Nível abaixo de 30%</div>

        <button onclick="abrirHistorico('${r.setor}')" 
            style="width:100%;padding:9px;border:none;border-radius:8px;
            background:#0f7a5b;color:white;font-weight:bold;margin-top:5px;">
            📊 Histórico
        </button>

        <p style="margin-top:8px;font-size:13px;color:#444">
            Capacidade: ${r.capacidade} L
        </p>
        `;

        box.appendChild(card);
    });
}

function abrirHistorico(x){
    location.href = `/historico.html?setor=${x}`;
}

/* PRESSÕES */
function renderPressao(lista){
    const box=document.getElementById("pressoesContainer");
    box.innerHTML = lista.map(p=>`
        <div class="card-pressao">
            <h3>${p.nome}</h3>
            <div class="pressao-valor">${p.pressao}</div>
            <div class="pressao-unidade">bar</div>
        </div>
    `).join("");
}

/* ===================== BOMBAS ===================== */
function normalizarEstado(estado){
    if(!estado) return "";
    return estado.toString().trim().toUpperCase();
}

function processarBombas(bombas){
    bombas.forEach(b => {
        const nome = b.nome;
        const estadoAtual = normalizarEstado(b.estado);
        const agora = Date.now();

        if(!(nome in tempoLigada)) tempoLigada[nome] = 0;
        if(!(nome in tempoDesligada)) tempoDesligada[nome] = 0;
        if(!(nome in ultimaMudanca)) ultimaMudanca[nome] = agora;
        if(!(nome in ultimoEstado)) ultimoEstado[nome] = estadoAtual;
        if(!(nome in ultimoCiclo)) ultimoCiclo[nome] = { ligado: 0, desligado: 0 };

        const passou = (agora - ultimaMudanca[nome]) / 1000;

        if(estadoAtual !== ultimoEstado[nome]){

            if(ultimoEstado[nome] === "LIGADA"){
                ultimoCiclo[nome].ligado = passou;
            } else {
                ultimoCiclo[nome].desligado = passou;
            }
            ultimoEstado[nome] = estadoAtual;
            ultimaMudanca[nome] = agora;
        }

        if(estadoAtual === "LIGADA"){
            tempoLigada[nome] += passou;
        } else {
            tempoDesligada[nome] += passou;
        }

        ultimaMudanca[nome] = agora;
    });

    localStorage.setItem("TEMPO_BOMBAS", JSON.stringify(tempoLigada));
    localStorage.setItem("TEMPO_DESLIGADAS", JSON.stringify(tempoDesligada));
    localStorage.setItem("ULTIMA_MUDANCA", JSON.stringify(ultimaMudanca));
    localStorage.setItem("ULTIMO_ESTADO", JSON.stringify(ultimoEstado));
    localStorage.setItem("ULTIMO_CICLO", JSON.stringify(ultimoCiclo));
}

function renderBombas(lista){
    const box=document.getElementById("bombasContainer");

    const ciclos = lista.map(b => b.ciclo);
    const alertaCiclos = !ciclos.every(v => v === ciclos[0]);

    box.innerHTML = lista.map(b => {

        const nome = b.nome;
        const estado = normalizarEstado(b.estado);

        let tLig = ultimoCiclo[nome]?.ligado || 0;
        let tDes = ultimoCiclo[nome]?.desligado || 0;

        const minL = Math.floor(tLig / 60);
        const segL = Math.floor(tLig % 60);

        const minD = Math.floor(tDes / 60);
        const segD = Math.floor(tDes % 60);

        return `
        <div class="card-bomba"
             style="${ estado === "LIGADA" 
                ? 'background:#28a745;color:white;border:2px solid #1e7e34;' 
                : '' }">

            <h3>${b.nome}</h3>
            <div class="linha">Status: <b>${b.estado}</b></div>
            <div class="linha">Ciclos: ${b.ciclo}</div>

            <div class="linha">Último ciclo ligada: ${minL}m ${segL}s</div>
            <div class="linha">Último ciclo desligada: ${minD}m ${segD}s</div>

            ${alertaCiclos ? 
                `<div style="margin-top:8px;padding:6px;background:#ff4444;color:white;
                border-radius:6px;font-weight:bold;text-align:center;">
                    ⚠ Diferença de ciclos detectada
                </div>` 
            : ""}
        </div>
        `;
    }).join("");
}
