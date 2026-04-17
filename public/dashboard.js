console.log("Dashboard carregado");

// ================= CONFIG =================
const API = "/api/dashboard";

let grafico;

// ================= INICIAR GRAFICO =================
function iniciarGrafico(){

const ctx = document.getElementById("graficoUTIChart");

if(!ctx) return;

grafico = new Chart(ctx,{
type:"line",

data:{
labels:[],
datasets:[{
label:"Consumo de Água",
data:[],
borderColor:"#00ffd0",
backgroundColor:"rgba(0,255,208,0.2)",
tension:0.3,
fill:true
}]
},

options:{
responsive:true,
maintainAspectRatio:false,

plugins:{
legend:{
labels:{color:"white"}
}
},

scales:{
x:{ticks:{color:"white"}},
y:{ticks:{color:"white"}}
}
}

});

}

// ================= ATUALIZAR GRAFICO =================
function atualizarGrafico(valor){

if(!grafico) return;

const hora=new Date().toLocaleTimeString();

grafico.data.labels.push(hora);
grafico.data.datasets[0].data.push(valor);

if(grafico.data.labels.length>40){

grafico.data.labels.shift();
grafico.data.datasets[0].data.shift();

}

grafico.update();

}

// ================= IA =================
function atualizarIA(consumo){

const el=document.getElementById("previsaoIA");

if(!el) return;

let texto="Consumo normal";

if(consumo>15000) texto="⚠ Consumo elevado";

if(consumo>18000) texto="🚨 Consumo muito alto";

el.textContent=texto;

}

// ================= CACHE =================
let ultimasLeituras={
reservatorios:{},
pressoes:{},
bombas:{}
};

// ================= ATUALIZAR HTTP =================
async function atualizar(){

try{

const r=await fetch(API,{cache:"no-store"});

if(!r.ok) throw new Error();

const dados=await r.json();

atualizarCache(dados);

renderTudo();

const el=document.getElementById("lastUpdate");

if(el){
el.textContent="Atualizado "+new Date().toLocaleTimeString();
}

}catch{

const el=document.getElementById("lastUpdate");

if(el){
el.textContent="Sem comunicação "+new Date().toLocaleTimeString();
}

}

}

setInterval(atualizar,5000);
atualizar();

// ================= ATUALIZAR CACHE =================
function atualizarCache(d){

if(d.reservatorios){

d.reservatorios.forEach(r=>{
ultimasLeituras.reservatorios[r.setor]=r;
});

}

if(d.pressoes){

d.pressoes.forEach(p=>{
ultimasLeituras.pressoes[p.setor]=p;
});

}

if(d.bombas){

d.bombas.forEach(b=>{
ultimasLeituras.bombas[b.nome]=b;
});

}

}

// ================= RENDER =================
function renderTudo(){

const reservatorios=Object.values(ultimasLeituras.reservatorios);

renderReservatorios(reservatorios);

renderPressao(Object.values(ultimasLeituras.pressoes));

renderBombas(ultimasLeituras.bombas);

// pegar reservatorio elevador
const elevador=reservatorios.find(r=>r.setor==="elevador");

if(elevador){

atualizarGrafico(elevador.current_liters);

atualizarIA(elevador.current_liters);

}

verificarNivelBaixo(reservatorios);

}

// ================= RESERVATORIOS =================
function renderReservatorios(lista){

const box=document.getElementById("reservatoriosContainer");

if(!box) return;

box.innerHTML="";

lista.forEach(r=>{

const percent=Math.round(r.percent||0);
const litros=r.current_liters??"--";

const card=document.createElement("div");

card.className="card-reservatorio";

card.innerHTML=`
<div class="top-bar">
<h3>${r.nome}</h3>
</div>

<div class="tanque-visu">

<div class="nivel-agua" style="height:${percent}%"></div>

<div class="overlay-info">
<div class="percent-text">${percent}%</div>
<div class="liters-text">${litros} L</div>
</div>

</div>
`;

box.appendChild(card);

});

}

// ================= PRESSAO =================
function renderPressao(lista){

const mapa={
saida_osmose:"pSaidaOsmose",
retorno_osmose:"pRetornoOsmose",
saida_cme:"pSaidaCME"
};

lista.forEach(p=>{

const el=document.getElementById(mapa[p.setor]);

if(el && p.pressao!=null){

el.textContent=Number(p.pressao).toFixed(2);

}

});

}

// ================= BOMBAS =================
function renderBombas(bombas){

atualizarBomba("Bomba 01","bomba1","b1Status","b1Ciclos");
atualizarBomba("Bomba 02","bomba2","b2Status","b2Ciclos");
atualizarBomba("Bomba Osmose","bomba3","b3Status","b3Ciclos");

function atualizarBomba(nome,cardId,statusId,cicloId){

const b=bombas[nome];

if(!b) return;

const ligada=b.estado_num===1||b.estado==="ligada";

const card=document.getElementById(cardId);

if(!card) return;

card.classList.toggle("bomba-ligada",ligada);
card.classList.toggle("bomba-desligada",!ligada);

const status=document.getElementById(statusId);

if(status){
status.textContent=ligada?"Ligada":"Desligada";
}

const ciclo=document.getElementById(cicloId);

if(ciclo){
ciclo.textContent=b.ciclo??0;
}

}

}

// ================= ALERTA =================
function verificarNivelBaixo(lista){

const alerta=document.getElementById("alerta-nivelbaixo");

if(!alerta) return;

const baixo=lista.some(r=>(r.percent||0)<=50);

alerta.style.display=baixo?"block":"none";

}

// ================= WEBSOCKET =================
let ws;

function conectarWS(){

const proto=location.protocol==="https:"?"wss":"ws";

ws=new WebSocket(proto+"://"+location.host);

ws.onmessage=function(e){

try{

const msg=JSON.parse(e.data);

if(msg.type==="update"||msg.type==="init"){

atualizarCache(msg.dados);

renderTudo();

}

}catch{}

};

ws.onclose=function(){

setTimeout(conectarWS,3000);

};

ws.onerror=function(){

ws.close();

};

}

conectarWS();

// ================= START =================
document.addEventListener("DOMContentLoaded",iniciarGrafico);
