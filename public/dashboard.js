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

// ================= CONSUMO =================

function atualizarGrafico(nivel){

const agora=new Date();
const hora=agora.getHours();

if(ultimoNivel!==null){

let consumo=ultimoNivel-nivel;

if(consumo<0) consumo=0;

consumoHora+=consumo;

}

if(horaAtual===null)
horaAtual=hora;

if(hora!==horaAtual){

grafico.data.labels.push(`${horaAtual}:00`);

grafico.data.datasets[0].data.push(Math.round(consumoHora));

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

// ================= IA =================

function atualizarIA(consumo,nivel){

const el=document.getElementById("previsaoIA");

if(consumo===0){

el.textContent="Coletando dados...";
return;

}

const hora=new Date().getHours();

if(nivel<40){

el.textContent="🔴 Nível crítico no reservatório";
return;

}

if(hora<=5 && consumo>500){

el.textContent="🌙 Consumo anormal madrugada";
return;

}

if(consumo<500){

el.textContent="✔ Consumo normal";
return;

}

if(consumo<2000){

el.textContent="⚠ Consumo elevado";
return;

}

el.textContent="🚨 Possível vazamento";

}

// ================= AUTONOMIA =================

function calcularAutonomia(nivel){

const el=document.getElementById("autonomiaReservatorio");

if(consumoHora<=0){

el.textContent="Consumo baixo";
return;

}

let horas=nivel/consumoHora;

el.textContent=horas.toFixed(1)+" horas";

}

// ================= RESERVATORIOS =================

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

// ================= BOMBAS =================

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

const ligada=b.estado==="ligada"||b.estado_num===1;

status.textContent=ligada?"Ligada":"Desligada";

ciclos.textContent=b.ciclo;

card.classList.toggle("bomba-ligada",ligada);

card.classList.toggle("bomba-desligada",!ligada);

});

}

// ================= ALERTA =================

function verificarNivel(lista){

const alerta=document.getElementById("alerta-nivelbaixo");

const baixo=lista.some(r=>r.percent<50);

alerta.style.display=baixo?"block":"none";

}

// ================= STATUS =================

function statusOnline(){

const el=document.getElementById("statusSistema");

el.classList.remove("status-offline");

el.textContent="Online "+new Date().toLocaleTimeString();

}

function statusOffline(){

const el=document.getElementById("statusSistema");

el.classList.add("status-offline");

el.textContent="Sem comunicação "+new Date().toLocaleTimeString();

}

// ================= ATUALIZAR =================

async function atualizar(){

try{

const r=await fetch(API,{cache:"no-store"});

const dados=await r.json();

statusOnline();

renderReservatorios(dados.reservatorios);

renderBombas(dados.bombas);

verificarNivel(dados.reservatorios);

const elevador=dados.reservatorios.find(r=>r.setor==="elevador");

if(elevador){

atualizarGrafico(elevador.current_liters);

atualizarIA(consumoHora,elevador.percent);

calcularAutonomia(elevador.current_liters);

}

}catch{

statusOffline();

}

}

setInterval(atualizar,5000);

document.addEventListener("DOMContentLoaded",()=>{

iniciarGrafico();

atualizar();

});
