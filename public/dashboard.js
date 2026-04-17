// ===============================
// VARIÁVEIS GLOBAIS
// ===============================
let grafico = null;
let horaAtual = null;
let consumoHora = 0;
window.ultimaLeitura = null;


// ===============================
// COR INTELIGENTE
// ===============================
function corNivel(percent){
  if(percent >= 100) return "#2196f3";
  if(percent > 70) return "#22c55e";
  if(percent > 40) return "#eab308";
  return "#ef4444";
}


// ===============================
// GRÁFICO
// ===============================
function criarGrafico(){

  const ctx = document.getElementById("graficoUTIChart");
  if(!ctx) {
    console.warn("Canvas do gráfico não encontrado");
    return;
  }

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
// COR GRÁFICO
// ===============================
function atualizarCorGrafico(percent){
  if(!grafico) return;

  const cor = corNivel(percent);
  grafico.data.datasets[0].backgroundColor = cor;
  grafico.data.datasets[0].borderColor = cor;
  grafico.update();
}


// ===============================
// CONSUMO
// ===============================
function atualizarGrafico(nivelAtual){

  if(!grafico) return;

  const agora = Date.now();

  if(!window.ultimaLeitura){
    window.ultimaLeitura = { nivel:nivelAtual, tempo:agora };
    return;
  }

  const diffNivel = window.ultimaLeitura.nivel - nivelAtual;
  const diffTempo = (agora - window.ultimaLeitura.tempo)/1000;

  if(diffTempo <= 0) return;

  let consumoSeg = diffNivel / diffTempo;
  if(consumoSeg < 0) consumoSeg = 0;

  consumoHora = consumoSeg * 3600;

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
// IA
// ===============================
function atualizarIA(consumo,nivel){

  const el = document.getElementById("previsaoIA");
  if(!el) return;

  if(nivel < 30){
    el.textContent = "🚨 Nível crítico";
  }
  else if(consumo < 1500){
    el.textContent = "✔ Consumo normal";
  }
  else if(consumo < 4000){
    el.textContent = "⚠ Consumo elevado";
  }
  else{
    el.textContent = "🚨 Possível vazamento";
  }
}


// ===============================
// RESERVATÓRIOS
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
        <div class="nivel-agua"
          style="height:${percent}%; background:${corNivel(percent)}">
        </div>
      </div>

      <div>${percent}%</div>
      <div>${litros} L</div>
    `;

    container.appendChild(card);
  });
}


// ===============================
// UPDATE PRINCIPAL
// ===============================
async function atualizar(){

  try{

    const resposta = await fetch("/api/dashboard");

    if(!resposta.ok){
      throw new Error("API não respondeu");
    }

    const data = await resposta.json();

    // RESERVATÓRIOS
    if(data.reservatorios){
      renderReservatorios(data.reservatorios);

      const elevador = data.reservatorios.find(r=>r.setor==="elevador");

      if(elevador){
        atualizarGrafico(elevador.current_liters);
        atualizarCorGrafico(elevador.percent);
        atualizarIA(consumoHora,elevador.percent);
      }
    }

    // PRESSÃO
    if(data.pressoes){
      const mapa = {
        saida_osmose: "pSaidaOsmose",
        retorno_osmose: "pRetornoOsmose",
        saida_cme: "pSaidaCME"
      };

      data.pressoes.forEach(p=>{
        const el = document.getElementById(mapa[p.setor]);
        if(el) el.innerText = p.pressao?.toFixed(2) ?? "--";
      });
    }

    // BOMBAS
    if(data.bombas){

      data.bombas.forEach((b,i)=>{

        const ids = [
          {s:"b1Status", c:"b1Ciclos", card:"bomba1"},
          {s:"b2Status", c:"b2Ciclos", card:"bomba2"},
          {s:"b3Status", c:"b3Ciclos", card:"bomba3"}
        ];

        if(!ids[i]) return;

        const ligada = b.estado === "ligada";

        const elStatus = document.getElementById(ids[i].s);
        const elCiclo = document.getElementById(ids[i].c);
        const card = document.getElementById(ids[i].card);

        if(elStatus){
          elStatus.innerText = ligada ? "Ligada" : "Desligada";
          elStatus.style.color = ligada ? "#22c55e" : "#ef4444";
        }

        if(elCiclo) elCiclo.innerText = b.ciclo ?? 0;

        if(card){
          card.classList.toggle("bomba-ligada", ligada);
          card.classList.toggle("bomba-desligada", !ligada);
        }
      });
    }

    // STATUS
    const status = document.getElementById("statusSistema");
    if(status) status.innerText = "🟢 Sistema Operacional";

    const last = document.getElementById("lastUpdate");
    if(last) last.innerText = new Date().toLocaleTimeString();

  }
  catch(err){
    console.error(err);

    const status = document.getElementById("statusSistema");
    if(status) status.innerText = "🔴 Sem comunicação";
  }
}


// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  criarGrafico();
  atualizar();
  setInterval(atualizar, 5000);
});
