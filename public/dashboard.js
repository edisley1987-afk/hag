let grafico = null;
let ultimaLeitura = null;
let consumoHora = 0;

// COR
function corNivel(p){
  if(p>70) return "#22c55e";
  if(p>40) return "#eab308";
  return "#ef4444";
}

// GRÁFICO
function criarGrafico(){
  const ctx = document.getElementById("graficoUTIChart");
  if(!ctx) return;

  grafico = new Chart(ctx,{
    type:"bar",
    data:{labels:[],datasets:[{data:[]}]},
    options:{responsive:true}
  });
}

// IA
function atualizarIA(consumo,nivel){
  const el = document.getElementById("previsaoIA");
  if(!el) return;

  if(!ultimaLeitura){
    el.innerText="Coletando dados...";
    return;
  }

  if(nivel<30) el.innerText="🚨 Crítico";
  else if(consumo<1500) el.innerText="✔ Normal";
  else el.innerText="⚠ Alto consumo";
}

// RESERVATÓRIOS
function renderReservatorios(lista){

  const c = document.getElementById("reservatoriosContainer");
  if(!c) return;

  c.innerHTML="";

  lista.forEach(r=>{

    const p = Math.round(r.percent || 0);

    const div = document.createElement("div");
    div.className="card-reservatorio";

    if(p<=30) div.classList.add("nv-critico");
    else if(p<=60) div.classList.add("nv-alerta");
    else div.classList.add("nv-normal");

    div.innerHTML=`
      <h4>${r.nome}</h4>
      <div class="tanque-visu">
        <div class="nivel-agua" style="height:${p}%; background:${corNivel(p)}"></div>
      </div>
      <div>${p}%</div>
      <div>${r.current_liters} L</div>
    `;

    c.appendChild(div);
  });
}

// UPDATE
async function atualizar(){

  try{
    const r = await fetch("/api/dashboard");
    const d = await r.json();

    renderReservatorios(d.reservatorios);

    const elev = d.reservatorios.find(x=>x.setor==="elevador");

    if(elev){
      atualizarIA(consumoHora,elev.percent);
    }

    document.getElementById("lastUpdate").innerText =
      "Atualizado " + new Date().toLocaleTimeString();

  }catch(e){
    document.getElementById("statusSistema").innerText="🔴 Sem comunicação";
  }
}

// INIT
window.onload=()=>{
  criarGrafico();
  setInterval(atualizar,5000);
  atualizar();
};
