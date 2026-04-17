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
  if(percent >= 100) return "#2196f3";
  if(percent > 70) return "#22c55e";
  if(percent > 40) return "#eab308";
  return "#ef4444";
}


// ===============================
// CRIAR GRÁFICO
// ===============================

function criarGrafico(){

  const ctx = document.getElementById("graficoUTIChart"); // 🔥 CORRIGIDO

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
        legend: { labels:{ color:"#fff" } }
      },
      scales: {
        x:{ ticks:{color:"#fff"} },
        y:{ beginAtZero:true, ticks:{color:"#fff"} }
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

  if(!grafico) return;

  const agora = Date.now();

  if(!window.ultimaLeitura){
    window.ultimaLeitura = { nivel:nivelAtual, tempo:agora };
    return;
  }

  const diferencaNivel = window.ultimaLeitura.nivel - nivelAtual;
  const diferencaTempo = (agora - window.ultimaLeitura.tempo)/1000;

  if(diferencaTempo <= 0) return;

  let consumoPorSegundo = diferencaNivel / diferencaTempo;
  if(consumoPorSegundo < 0) consumoPorSegundo = 0;

  consumoHora = consumoPorSegundo * 3600;

  window.ultimaLeitura = { nivel:nivelAtual, tempo:agora };

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
    el.textContent="🔴 Nível crítico";
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
// ATUALIZAR DADOS
// ===============================

async function atualizar(){

  try{

    const resposta = await fetch("/api/dashboard");

    const text = await resposta.text();

    let data;

    try{
      data = JSON.parse(text);
    }catch(e){
      console.error("Resposta não é JSON", text);
      return;
    }


    // ----------------------------
    // RESERVATÓRIO ELEVADOR
    // ----------------------------

    const elevador = data.reservatorios?.find(r=>r.setor==="elevador");

    if(elevador){

      atualizarGrafico(elevador.current_liters);
      atualizarCorGrafico(elevador.percent);
      atualizarIA(consumoHora,elevador.percent);

    }


    // ----------------------------
    // BOMBAS (CORRIGIDO)
    // ----------------------------

    if(data.bombas){

      const mapa = [
        {status:"b1Status", ciclo:"b1Ciclos"},
        {status:"b2Status", ciclo:"b2Ciclos"},
        {status:"b3Status", ciclo:"b3Ciclos"}
      ];

      data.bombas.forEach((b,i)=>{

        if(!mapa[i]) return;

        const elStatus = document.getElementById(mapa[i].status);
        const elCiclo = document.getElementById(mapa[i].ciclo);

        if(elStatus){
          elStatus.innerText = b.estado;
          elStatus.style.color = b.estado==="ligada" ? "#22c55e" : "#ef4444";
        }

        if(elCiclo){
          elCiclo.innerText = b.ciclo;
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
