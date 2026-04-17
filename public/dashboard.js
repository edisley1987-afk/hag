```javascript
// ========================= CONFIG =========================
const API = "/api/dashboard";

// ========================= GRAFICO =========================
let grafico;

function iniciarGrafico(){

const ctx = document.getElementById("graficoUTIChart");

if(!ctx) return;

grafico = new Chart(ctx,{
type:"line",
data:{
labels:[],
datasets:[{
label:"Consumo Água",
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
legend:{labels:{color:"white"}}
},
scales:{
x:{ticks:{color:"white"}},
y:{ticks:{color:"white"}}
}
}
});

}

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

// ========================= IA CONSUMO =========================
function atualizarIA(consumo){

let texto="Consumo normal";

if(consumo>300){
texto="⚠ Consumo acima do normal";
}

if(consumo>600){
texto="🚨 Possível vazamento detectado";
}

const el=document.getElementById("previsaoIA");
if(el) el.textContent=texto;

}

// ========================= ESTADOS =========================
let manutencao=JSON.parse(localStorage.getItem("manutencao"))||{};

let ultimasLeituras={
reservatorios:{},
pressoes:{},
bombas:{}
};

// ========================= ALERTAS =========================
let alertaAtivo={};
let alertaNivel31={};
let bipNivelIntervalo={};

// ========================= DATA =========================
function formatarHora(ts){

const d=ts?new Date(ts):new Date();

return isNaN(d.getTime())
?new Date().toLocaleTimeString()
:d.toLocaleTimeString();

}

// ========================= AUDIO =========================
let audioCtx=null;
let audioLiberado=false;

function liberarAudio(){

if(!audioCtx){
audioCtx=new(window.AudioContext||window.webkitAudioContext)();
}

if(audioCtx.state==="suspended"){
audioCtx.resume();
}

audioLiberado=true;

document.removeEventListener("click",liberarAudio);
document.removeEventListener("touchstart",liberarAudio);

}

document.addEventListener("click",liberarAudio);
document.addEventListener("touchstart",liberarAudio);

function bipCurto(){

if(!audioLiberado||!audioCtx) return;

const o=audioCtx.createOscillator();

o.type="square";
o.frequency.value=600;

o.connect(audioCtx.destination);

o.start();
o.stop(audioCtx.currentTime+0.12);

}

// ========================= LOOP HTTP =========================
async function atualizar(){

try{

const r=await fetch(API,{cache:"no-store"});

if(!r.ok) throw new Error();

const dados=await r.json();

atualizarCacheHTTP(dados);

renderTudo();

document.getElementById("lastUpdate").textContent=
"Atualizado "+formatarHora(dados.lastUpdate);

}catch{

renderTudo();

document.getElementById("lastUpdate").textContent=
"Sem comunicação "+formatarHora();

}

}

setInterval(atualizar,5000);
atualizar();

// ========================= CACHE =========================
function atualizarCacheHTTP(d){

d?.reservatorios?.forEach(r=>
ultimasLeituras.reservatorios[r.setor]=r
);

d?.pressoes?.forEach(p=>
ultimasLeituras.pressoes[p.setor]=p
);

d?.bombas?.forEach(b=>
ultimasLeituras.bombas[b.nome]=b
);

}

// ========================= RENDER GERAL =========================
function renderTudo(){

const reservatorios=Object.values(ultimasLeituras.reservatorios);

renderReservatorios(reservatorios);
renderPressao(Object.values(ultimasLeituras.pressoes));
renderBombas(ultimasLeituras.bombas);

// dados para IA e gráfico
const elevador=reservatorios.find(r=>r.setor==="reservatorio_elevador");

if(elevador){

atualizarGrafico(elevador.current_liters);
atualizarIA(elevador.current_liters);

}

}

// ========================= RESERVATORIOS =========================
function renderReservatorios(lista){

const box=document.getElementById("reservatoriosContainer");
if(!box) return;

const frag=document.createDocumentFragment();

lista.forEach(r=>{

const percent=Math.round(r.percent||0);
const litros=r.current_liters??"--";

const card=document.createElement("div");
card.className="card-reservatorio";

card.innerHTML=`

<div class="top-bar">
<h3>${r.nome}</h3>
<button onclick="toggleManutencao('${r.setor}')">⚙</button>
</div>

<div class="tanque-visu">

<div class="nivel-agua" style="height:${percent}%"></div>

<div class="overlay-info">

<div class="percent-text">${percent}%</div>
<div class="liters-text">${litros} L</div>

</div>

</div>

<button onclick="abrirHistorico('${r.setor}')">
📊 Histórico
</button>

`;

frag.appendChild(card);

});

box.innerHTML="";
box.appendChild(frag);

}

// ========================= PRESSOES =========================
function renderPressao(lista){

const mapa={
saida_osmose:"pSaidaOsmose",
retorno_osmose:"pRetornoOsmose",
saida_cme:"pSaidaCME"
};

lista.forEach(p=>{

const el=document.getElementById(mapa[p.setor]);

if(el&&p.pressao!=null){
el.textContent=Number(p.pressao).toFixed(2);
}

});

}

// ========================= BOMBAS =========================
function renderBombas(bombas){

atualizar("Bomba 01","bomba1","b1Status","b1Ciclos");
atualizar("Bomba 02","bomba2","b2Status","b2Ciclos");
atualizar("Bomba Osmose","bomba3","b3Status","b3Ciclos");

function atualizar(nome,cardId,statusId,cicloId){

const b=bombas[nome];
if(!b) return;

const ligada=b.estado_num===1||b.estado==="ligada";

const card=document.getElementById(cardId);
if(!card) return;

card.classList.toggle("bomba-ligada",ligada);
card.classList.toggle("bomba-desligada",!ligada);

document.getElementById(statusId).textContent=
ligada?"Ligada":"Desligada";

document.getElementById(cicloId).textContent=b.ciclo??0;

}

}

// ========================= MANUTENCAO =========================
function toggleManutencao(setor){

manutencao[setor]=!manutencao[setor];

localStorage.setItem(
"manutencao",
JSON.stringify(manutencao)
);

}

function abrirHistorico(setor){

location.href=`/historico.html?setor=${setor}`;

}

// ========================= WEBSOCKET =========================
let ws;

function connectWS(){

const proto=location.protocol==="https:"?"wss":"ws";

ws=new WebSocket(`${proto}://${location.host}`);

ws.onopen=()=>{
console.log("WebSocket conectado");
};

ws.onmessage=e=>{

try{

const msg=JSON.parse(e.data);

if(msg.type==="update"||msg.type==="init"){

atualizarCacheHTTP(msg.dados);

renderTudo();

document.getElementById("lastUpdate").textContent=
"Tempo real "+formatarHora();

}

}catch{}

};

ws.onclose=()=>{
setTimeout(connectWS,3000);
};

ws.onerror=()=>ws.close();

}

connectWS();

// ========================= START =========================
document.addEventListener("DOMContentLoaded",iniciarGrafico);
```
