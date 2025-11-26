const API = "/api/dashboard";   // <<< URL ACERTADA
let cache = JSON.parse(localStorage.getItem("DATA_CACHE")) || {};

async function atualizar(){
    try{
        const r = await fetch(API,{cache:"no-store"});
        if(!r.ok) throw 0;
        const dados = await r.json();

        cache = dados;
        localStorage.setItem("DATA_CACHE",JSON.stringify(dados));

        render(dados);
        document.getElementById("lastUpdate").textContent = "Atualizado "+new Date().toLocaleTimeString();
    }catch{
        console.warn("Sem atualização, usando valores armazenados.");
        render(cache);
        document.getElementById("lastUpdate").textContent = "SEM SINAL — exibindo última leitura";
    }
}
setInterval(atualizar,5000);
atualizar();

/* =================== RENDER =================== */
function render(d){
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

/* BOMBAS */
function renderBombas(lista){
    const box=document.getElementById("bombasContainer");
    box.innerHTML = lista.map(b=>`
        <div class="card-bomba">
            <h3>${b.nome}</h3>
            <div class="linha">Status: <b>${b.estado}</b></div>
            <div class="linha">Ciclos: ${b.ciclo}</div>
        </div>
    `).join("");
}
