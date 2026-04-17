const API="/api/dashboard";

let grafico;

let ultimoNivel=null;
let horaAtual=null;
let consumoHora=0;

function iniciarGrafico(){

const ctx=document.getElementById("graficoUTIChart");

grafico=new Chart(ctx,{

type:"bar",

data:{
labels:[],
datasets:[{

label:"Consumo por Hora (L)",

data:[],

backgroundColor:"#00ffd0"

}]
},

options:{

responsive:true,

maintainAspectRatio:false

}

});

}

function atualizarGrafico(nivel){

const agora=new Date();

const hora=agora.getHours();

if(ultimoNivel!==null){

let consumo=ultimoNivel-nivel;

if(consumo<0) consumo=0;

consumoHora+=consumo;

}

if(horaAtual===null) horaAtual=hora;

if(hora!==horaAtual){

grafico.data.labels.push(`${horaAtual}:00`);

grafico.data.datasets[0].data.push(consumoHora);

if(grafico.data.labels.length>24){

grafico.data.labels.shift();
grafico.data.datasets[0].data.shift();

}

grafico.update();

horaAtual=hora;

consumoHora=0;

}

ultimoNivel=nivel;

}

function atualizarIA(consumo){

const el=document.getElementById("previsaoIA");

if(consumo<5000)
el.textContent="Consumo normal";

if(consumo>5000)
el.textContent="Consumo elevado";

if(consumo>8000)
el.textContent="Possível vazamento";

}

function calcularAutonomia(nivel,consumo){

const el=document.getElementById("autonomiaReservatorio");

if(consumo<=0){

el.textContent="Consumo baixo";

return;

}

let horas=nivel/consumo;

el.textContent=horas.toFixed(1)+" horas";

}

function renderReservatorios(lista){

const box=document.getElementById("reservatoriosContainer");

box.innerHTML="";

lista.forEach(r=>{

const card=document.createElement("div");

card.className="card-reservatorio";

card.innerHTML=`

<h3>${r.nome}</h3>

<div class="tanque-visu">

<div class="nivel-agua" style="height:${r.percent}%"></div>

<div class="overlay-info">

<div class="percent-text">${Math.round(r.percent)}%</div>

<div>${r.current_liters} L</div>

</div>

</div>

`;

box.appendChild(card);

});

}

function renderBombas(lista){

const mapa={

"Bomba 01":["bomba1","b1Status","b1Ciclos"],

"Bomba 02":["bomba2","b2Status","b2Ciclos"],

"Bomba Osmose":["bomba3","b3Status","b3Ciclos"]

};

lista.forEach(b=>{

const ref=mapa[b.nome];

if(!ref) return;

const card=document.getElementById(ref[0]);

const status=document.getElementById(ref[1]);

const ciclos=document.getElementById(ref[2]);

const ligada=b.estado==="ligada";

status.textContent=b.estado;

ciclos.textContent=b.ciclo;

card.classList.toggle("bomba-ligada",ligada);

card.classList.toggle("bomba-desligada",!ligada);

});

}

function verificarNivel(lista){

const alerta=document.getElementById("alerta-nivelbaixo");

const baixo=lista.some(r=>r.percent<50);

alerta.style.display=baixo?"block":"none";

}

async function atualizar(){

const r=await fetch(API);

const dados=await r.json();

renderReservatorios(dados.reservatorios);

renderBombas(dados.bombas);

verificarNivel(dados.reservatorios);

const elevador=dados.reservatorios.find(r=>r.setor==="elevador");

if(elevador){

atualizarGrafico(elevador.current_liters);

atualizarIA(elevador.current_liters);

calcularAutonomia(elevador.current_liters,consumoHora);

}

}

setInterval(atualizar,5000);

document.addEventListener("DOMContentLoaded",()=>{

iniciarGrafico();

atualizar();

});
