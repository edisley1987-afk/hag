// ===============================
// VARIÁVEIS GLOBAIS
// ===============================

let grafico = null;
let horaAtual = null;
let consumoHora = 0;

window.ultimaLeitura = null;


// ===============================
// DEFINIR COR DO NÍVEL
// ===============================

function corNivel(percent){

if(percent >= 100)
return "#2196f3"; // azul

if(percent > 70)
return "#22c55e"; // verde

if(percent > 40)
return "#eab308"; // amarelo

return "#ef4444"; // vermelho

}


// ===============================
// CRIAR GRÁFICO
// ===============================

function criarGrafico(){

const ctx = document.getElementById("graficoConsumo");

if(!ctx) return;

grafico = new Chart(ctx, {

type: "bar",

data: {

labels: [],

datasets: [{
label: "Consumo (L/h)",
data: [],
backgroundColor: "#22c55e",
borderColor: "#22c55e",
borderWidth: 1
}]

},

options: {

responsive: true,

maintainAspectRatio: false,

plugins: {
legend: {
labels:{
color:"#fff"
}
}
},

scales: {

x:{
ticks:{color:"#fff"}
},

y:{
beginAtZero:true,
ticks:{color:"#fff"}
}

}

}

});

}


// ===============================
// ATUALIZAR COR DO GRÁFICO
// ===============================

function atualizarCorGrafico(percent){

if(!grafico) return;

const cor = corNivel(percent);

grafico.data.datasets[0].backgroundColor = cor;
grafico.data.datasets[0].borderColor = cor;

grafico.update();

}


// ===============================
// CALCULAR CONSUMO
// ===============================

function atualizarGrafico(nivelAtual){

const agora = Date.now();

if(!window.ultimaLeitura){

window.ultimaLeitura = {
nivel:nivelAtual,
tempo:agora
};

return;

}

const diferencaNivel = window.ultimaLeitura.nivel - nivelAtual;

const diferencaTempo = (agora - window.ultimaLeitura.tempo)/1000;

if(diferencaTempo <= 0) return;

let consumoPorSegundo = diferencaNivel / diferencaTempo;

if(consumoPorSegundo < 0) consumoPorSegundo = 0;

consumoHora = consumoPorSegundo * 3600;

window.ultimaLeitura = {
nivel:nivelAtual,
tempo:agora
};


// atualizar gráfico por hora

const hora = new Date().getHours();

if(horaAtual === null) horaAtual = hora;

if(hora !== horaAtual){

grafico.data.labels.push(`${horaAtual}:00`);
grafico.data.datasets[0].data.push(Math.round(consumoHora));

if(grafico.data.labels.length > 24){

grafico.data.labels.shift();
grafico.data.datasets[0].data.shift();

}

grafico.update();

horaAtual = hora;

}

}


// ===============================
// IA DE CONSUMO
// ===============================

function atualizarIA(consumo,nivel){

const el = document.getElementById("previsaoIA");

if(!el) return;

if(consumo === 0){

el.textContent="Coletando dados...";
return;

}

if(nivel < 40){

el.textContent="🔴 Nível crítico no reservatório";
return;

}

if(consumo < 1500){

el.textContent="✔ Consumo normal";
return;

}

if(consumo < 4000){

el.textContent="⚠ Consumo elevado";
return;

}

el.textContent="🚨 Possível vazamento";

}


// ===============================
// ATUALIZAR DADOS DO DASHBOARD
// ===============================

async function atualizar(){

try{

const resposta = await fetch("/api/status");

const data = await resposta.json();


// ----------------------------
// RESERVATÓRIO PRINCIPAL
// ----------------------------

const elevador = data.reservatorios.find(r=>r.setor==="elevador");

if(elevador){

const nivel = elevador.percent;

document.getElementById("nivelElevador").innerText = nivel.toFixed(1)+"%";

document.getElementById("litrosElevador").innerText =
elevador.current_liters+" / "+elevador.capacidade+" L";


atualizarGrafico(elevador.current_liters);

atualizarCorGrafico(nivel);

atualizarIA(consumoHora,nivel);

}


// ----------------------------
// PRESSÕES
// ----------------------------

if(data.pressoes){

data.pressoes.forEach(p=>{

const el = document.getElementById(p.setor);

if(el)
el.innerText = p.pressao.toFixed(2)+" bar";

});

}


// ----------------------------
// BOMBAS
// ----------------------------

if(data.bombas){

data.bombas.forEach(b=>{

const el = document.getElementById(b.nome.replace(" ","").toLowerCase());

if(el){

el.innerText = b.estado;

el.style.color = b.estado==="ligada" ? "#22c55e" : "#ef4444";

}

});

}

}
catch(e){

console.error("Erro ao atualizar",e);

}

}


// ===============================
// INICIALIZAÇÃO
// ===============================

window.onload = ()=>{

criarGrafico();

setInterval(atualizar,5000);

atualizar();

};
