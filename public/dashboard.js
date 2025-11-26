// ==================== CONFIG ======================
const API_URL = "/api/dashboard"; 
const INTERVALO_ATUALIZACAO = 5000; // 5s

// Carrega cache salvo sem apagar quando falhar conexão
let cache = JSON.parse(localStorage.getItem("HAG_CACHE_DASH")) || null;


// ==================== ATUALIZADOR ======================
async function atualizar(){
    try{
        const r = await fetch(API_URL,{cache:"no-store"});
        if(!r.ok) throw 0;

        const dados = await r.json();

        cache = dados;
        localStorage.setItem("HAG_CACHE_DASH",JSON.stringify(dados));

        render(dados);

    }catch{
        console.warn("Sem atualização, usando último valor salvo");
        if(cache) render(cache);
    }
}

setInterval(atualizar,INTERVALO_ATUALIZACAO);
atualizar();


// ======================== RENDER GERAL ========================
function render(dados){
    renderReservatorios(dados.reservatorios);
    renderPressoes(dados.pressoes);
    renderBombas(dados.bombas);
}



// ===============================================================
//  RESERVATÓRIOS + botão HISTÓRICO + trava/manutenção 31%
// ===============================================================
function renderReservatorios(lista){
    const box = document.getElementById("reservatoriosContainer");
    box.innerHTML = "";

    lista.forEach(r=>{

        let manut = localStorage.getItem(`manut_${r.setor}`)=="1";

        // Se estava em manutenção e agora passou 31% → libera automático
        if(manut && r.percent >=31){
            localStorage.setItem(`manut_${r.setor}`,"0");
            manut=false;
        }

        let cor = manut ? "#888" : (r.percent<30 ? "#d63838" : "#0e9c57");

        const card = document.createElement("div");
        card.className="card-reservatorio";
        card.style.borderColor = cor;

        card.innerHTML = `
            <h3>${r.nome}</h3>

            <div class="grafico" style="background:${cor}22">
                 <b>${r.percent}%</b><br>${r.current_liters} L
            </div>

            ${(!manut && r.percent<30) ? `<div class='alerta'>⚠ Nível abaixo de 30%</div>` : ""}

            <label>
                <input type="checkbox" ${manut?"checked":""}
                onclick="toggleManut('${r.setor}')"> Em manutenção
            </label><br>

            Capacidade: ${r.capacidade} L<br><br>

            <button class="btnHistorico"
                onclick="location.href='historico.html?setor=${r.setor}'">
                📊 Ver histórico
            </button>
        `;

        box.appendChild(card);
    });
}

function toggleManut(id){
    const atual = localStorage.getItem(`manut_${id}`)=="1";
    localStorage.setItem(`manut_${id}`, atual?"0":"1");
    if(cache) renderReservatorios(cache.reservatorios);
}



// ===============================================================
//  PRESSÕES
// ===============================================================
function renderPressoes(lista){
    const box = document.getElementById("pressoesContainer");
    box.innerHTML="";

    lista.forEach(p=>{
        box.innerHTML+= `
        <div class="card-pressao">
            <h3>${p.nome}</h3>
            <b>${p.pressao}</b><br>bar
        </div>`;
    });
}



// ===============================================================
//  BOMBAS
// ===============================================================
function renderBombas(lista){
    const box = document.getElementById("bombasContainer");
    box.innerHTML ="";

    lista.forEach(b=>{
        box.innerHTML+= `
        <div class="card-bomba">
              <h3>${b.nome}</h3>
              Status: <b>${b.estado}</b><br>
              Ciclos: ${b.ciclo ?? "--"}<br>
        </div>`;
    });
}
