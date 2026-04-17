// ===============================
// VARIÁVEIS GLOBAIS
// ===============================
let grafico = null;
let horaAtual = null;
let consumoHora = 0;
window.ultimaLeitura = null;


// ===============================
// COR INTELIGENTE (UTI)
// ===============================
function corNivel(percent){
  if(percent >= 100) return "#2196f3"; // cheio
  if(percent > 70) return "#22c55e";   // normal
  if(percent > 40) return "#eab308";   // alerta
  return "#ef4444";                    // crítico
}


// ===============================
// CRIAR GRÁFICO
// ===============================
function criarGrafico(){

  const ctx = document.getElementById("graficoUTIChart");
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

  if(!window.ultimaLeitura){
    el.textContent = "Coletando dados...";
    return;
  }

  if(nivel < 30){
    el.textContent="🚨 Nível crítico";
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
// RENDER RESERVATÓRIOS
// ===============================
function renderReservatorios(lista){

  const container = document.getElementById("reservatoriosContainer");
  if(!container) return;

  container.innerHTML = "";

  lista.forEach(r => {

    const percent = Math.round(r.percent || 0);
    const litros = r.current_liters ?? 0;

    const card = document.createElement("div");
    card.className = "card-reservatorio";

    if(percent <= 30) card.classList.add("nv-critico");
    else if(percent <= 60) card.classList.add("nv-alerta");
    else card.classList.add("nv-normal");

    card.innerHTML = `
      <h3>${r.nome}</h3>

      <div class="tanque-visu">
        <div class="nivel-agua" style="height:${percent}%; background:${corNivel(percent)}"></div>
      </div>

      <div class="percent-text">${percent}%</div>
      <div class="liters-text">${litros} L</div>
    `;

    container.appendChild(card);
  });

}


// ===============================
// ATUALIZAR DADOS
// ===============================
async function atualizar(){

  try{

    const resposta = await fetch("/api/dashboard");
    const data = await resposta.json();

    // ---------------- RESERVATÓRIOS ----------------
    if(data.reservatorios){

      renderReservatorios(data.reservatorios);

      const elevador = data.reservatorios.find(r=>r.setor==="elevador");

      if(elevador){
        atualizarGrafico(elevador.current_liters);
        atualizarCorGrafico(elevador.percent);
        atualizarIA(consumoHora,elevador.percent);
      }
    }

    // ---------------- PRESSÕES ----------------
    if(data.pressoes){

      const mapa = {
        saida_osmose: "pSaidaOsmose",
        retorno_osmose: "pRetornoOsmose",
        saida_cme: "pSaidaCME"
      };

      data.pressoes.forEach(p=>{
        const el = document.getElementById(mapa[p.setor]);
        if(el){
          el.innerText = p.pressao != null ? p.pressao.toFixed(2) : "--";
        }
      });

    }

    // ---------------- BOMBAS ----------------
    if(data.bombas){

      const mapa = [
        {status:"b1Status", ciclo:"b1Ciclos", card:"bomba1"},
        {status:"b2Status", ciclo:"b2Ciclos", card:"bomba2"},
        {status:"b3Status", ciclo:"b3Ciclos", card:"bomba3"}
      ];

      data.bombas.forEach((b,i)=>{

        if(!mapa[i]) return;

        const elStatus = document.getElementById(mapa[i].status);
        const elCiclo = document.getElementById(mapa[i].ciclo);
        const card = document.getElementById(mapa[i].card);

        const ligada = b.estado === "ligada" || b.estado_num === 1;

        if(elStatus){
          elStatus.innerText = ligada ? "Ligada" : "Desligada";
          elStatus.style.color = ligada ? "#22c55e" : "#ef4444";
        }

        if(elCiclo){
          elCiclo.innerText = b.ciclo ?? 0;
        }

        if(card){
          card.classList.toggle("bomba-ligada", ligada);
          card.classList.toggle("bomba-desligada", !ligada);
        }

      });

    }

    // ---------------- STATUS ----------------
    const status = document.getElementById("statusSistema");
    if(status){
      status.innerText = "🟢 Sistema Operacional";
    }

    // ---------------- HORA ----------------
    const last = document.getElementById("lastUpdate");
    if(last){
      last.innerText = "Atualizado " + new Date().toLocaleTimeString();
    }

  }
  catch(e){
    console.error("Erro ao atualizar",e);

    const status = document.getElementById("statusSistema");
    if(status){
      status.innerText = "🔴 Sem comunicação";
    }
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
