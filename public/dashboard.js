const API_URL = "/api/dados"; 
const INTERVALO_ATUALIZACAO = 5000;

// ====== CAPACIDADES FIXAS ======
const limites = {
    elevador:20000,
    osmose:200,
    cme:1000,
    lavanderia:10000,
    abrandada:9000
};

// ========= CARREGA CACHE =========
let cache = JSON.parse(localStorage.getItem("HAG_CACHE")) || {};

// =================================================
async function atualizar(){
    try{
        const r = await fetch(API_URL,{cache:"no-store"});
        if(!r.ok) throw "sem resposta";
        const dados = await r.json();

        cache = dados;
        localStorage.setItem("HAG_CACHE",JSON.stringify(dados));

        render(dados);
    }catch{
        console.warn("Sem atualização, usando último valor salvo");
        render(cache);
    }
}
setInterval(atualizar,INTERVALO_ATUALIZACAO);
atualizar();

// =================================================
//   RENDER GERAL
// =================================================
function render(d){
    renderReservatorios(d);
    renderPessoas(d);
    renderBombas(d);
}

// =================================================
//   RESERVATÓRIOS
// =================================================
function renderReservatorios(d){

    const box = document.getElementById("reservatoriosContainer");
    box.innerHTML="";

    const lista = [
        ["Reservatório Elevador","Reservatorio_Elevador_current","elevador"],
        ["Reservatório Osmose","Reservatorio_Osmose_current","osmose"],
        ["Reservatório CME","Reservatorio_CME_current","cme"],
        ["Água Abrandada","Reservatorio_Agua_Abrandada_current","abrandada"],
        ["Lavanderia","Reservatorio_lavanderia_current","lavanderia"]
    ];

    lista.forEach(([nome,key,id])=>{

        const atual = d[key] ?? 0;
        const cap = limites[id];
        const nivel = ((atual/cap)*100).toFixed(0);

        const manut = localStorage.getItem(`manut_${id}`)=="1";

        // remove manutenção automática quando passa de 31%
        let mostrarManut = manut;
        if(manut && nivel>=31){
            localStorage.setItem(`manut_${id}`,"0");
            mostrarManut=false;
        }

        let cor = nivel<30 ? "#e34c4c" : "#1ca46d";
        if(mostrarManut) cor="#9c9c9c";

        const card=document.createElement("div");
        card.className="card-reservatorio";
        card.style.borderColor=cor;
        
        card.innerHTML=`
            <h3>${nome}</h3>

            <div class="grafico" style="background:${cor}22">
               <b>${nivel}%</b><br>${atual} L
            </div>

            ${(!mostrarManut && nivel<30)? `<div class='alerta'>⚠ Nível < 30%</div>`:""}

            <label>
              <input type="checkbox" ${mostrarManut?"checked":""}
                onclick="toggleManut('${id}')"> Em manutenção
            </label><br>

            Capacidade: ${cap}L
        `;

        box.appendChild(card);
    });
}

function toggleManut(nome){
    const atual = localStorage.getItem(`manut_${nome}`)=="1";
    localStorage.setItem(`manut_${nome}`, atual?"0":"1");
    renderReservatorios(cache);
}

// =================================================
//   PRESSÕES
// =================================================
function renderPessoas(d){
    document.getElementById("pressoesContainer").innerHTML=`
      ${cardPressao("Pressão Saída Osmose",d.Pressao_Saida_Osmose_current)}
      ${cardPressao("Pressão Retorno Osmose",d.Pressao_Retorno_Osmose_current)}
      ${cardPressao("Pressão Saída CME",d.Pressao_Saida_CME_current)}
    `;
}

function cardPressao(nome,val="--"){
    return `<div class="card-pressao"><h3>${nome}</h3><b>${val}</b><br>bar</div>`;
}

// =================================================
//   BOMBAS
// =================================================
function renderBombas(d){
    const box=document.getElementById("bombasContainer");
    box.innerHTML=`
       ${cardBomba("Bomba 01",d.Bomba_01_binary,d.Ciclos_Bomba_01_counter)}
       ${cardBomba("Bomba 02",d.Bomba_02_binary,d.Ciclos_Bomba_02_counter)}
    `;
}

function cardBomba(nome,on,ciclos){
    return `
    <div class="card-bomba">
        <h3>${nome}</h3>
        Status: <b>${on==1?"Ligada":"Desligada"}</b><br>
        Ciclos: ${ciclos ?? "--"}<br>
    </div>`;
}
