const API = "/api/dashboard";

let ws;
let reconnectDelay = 3000;
let ultimoUpdate = 0;

init();

function init(){
  conectarWS();
  setInterval(fallbackHTTP,8000);
}

function conectarWS(){

  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";

  ws = new WebSocket(`${protocolo}//${location.host}`);

  ws.onopen = () =>{
    setStatus("🟢 Tempo real conectado");
  }

  ws.onmessage = (msg)=>{

    try{

      const payload = JSON.parse(msg.data);

      if(payload.dados && !payload.reservatorios){
        montarEstrutura(payload.dados);
      }
      else if(payload.reservatorios){
        atualizarTela(payload);
      }

    }catch(e){
      console.log(e);
    }

  }

  ws.onclose = ()=>{
    setStatus("🔴 Reconectando...");
    setTimeout(conectarWS,reconnectDelay);
  }

}

async function fallbackHTTP(){

  if(ws && ws.readyState === 1) return;

  try{

    const res = await fetch(API);
    const data = await res.json();

    atualizarTela(data);

  }catch(e){
    setStatus("🔴 Sem conexão");
  }

}

function montarEstrutura(dados){

  const estrutura = {

    reservatorios:[

      {
        nome:"Reservatório Elevador",
        percent:dados["Reservatorio_Elevador_current_percent"],
        current_liters:dados["Reservatorio_Elevador_current"]
      },

      {
        nome:"Reservatório Osmose",
        percent:dados["Reservatorio_Osmose_current_percent"],
        current_liters:dados["Reservatorio_Osmose_current"]
      },

      {
        nome:"Reservatório CME",
        percent:dados["Reservatorio_CME_current_percent"],
        current_liters:dados["Reservatorio_CME_current"]
      },

      {
        nome:"Água Abrandada",
        percent:dados["Reservatorio_Agua_Abrandada_current_percent"],
        current_liters:dados["Reservatorio_Agua_Abrandada_current"]
      },

      {
        nome:"Lavanderia",
        percent:dados["Reservatorio_lavanderia_current_percent"],
        current_liters:dados["Reservatorio_lavanderia_current"]
      }

    ],

    bombas:[

      {
        nome:"Bomba 01",
        estado:dados["Bomba_01_binary"] === 1 ? "ligada" : "desligada",
        ciclo:dados["Ciclos_Bomba_01_counter"]
      },

      {
        nome:"Bomba 02",
        estado:dados["Bomba_02_binary"] === 1 ? "ligada" : "desligada",
        ciclo:dados["Ciclos_Bomba_02_counter"]
      },

      {
        nome:"Bomba Osmose",
        estado:dados["Bomba_Osmose_binary"] === 1 ? "ligada" : "desligada",
        ciclo:dados["Ciclos_Bomba_Osmose_counter"]
      }

    ],

    pressoes:[

      {nome:"Pressão Saída Osmose",pressao:dados["Pressao_Saida_Osmose_current"]},
      {nome:"Pressão Retorno Osmose",pressao:dados["Pressao_Retorno_Osmose_current"]},
      {nome:"Pressão CME",pressao:dados["Pressao_Saida_CME_current"]}

    ]

  };

  atualizarTela(estrutura);

}

function atualizarTela(data){

  document.getElementById("lastUpdate").innerText =
  "Atualizado: " + new Date().toLocaleTimeString("pt-BR");

  renderReservatorios(data.reservatorios || []);
  renderBombas(data.bombas || []);
  renderPressoes(data.pressoes || []);

}

function renderReservatorios(lista){

  const area = document.getElementById("areaReservatorios");
  area.innerHTML = "";

  lista.forEach(r=>{

    const percent = Math.max(0,Math.min(100,Number(r.percent)||0));

    let cor="#22c55e";

    if(percent < 30) cor="#ff3b3b";
    else if(percent < 60) cor="#ffaa00";

    const el = document.createElement("div");

    el.className="card reservatorio";

    el.innerHTML=`

    <h2>${r.nome}</h2>

    <div class="tanque">

      <div class="escala">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div class="nivel"
      style="height:${percent}%;
      background:linear-gradient(180deg,${cor},${cor}bb)">
      </div>

    </div>

    <div class="info">
      <div class="valor">${percent.toFixed(1)}%</div>
      <div class="litros">${formatar(r.current_liters)} L</div>
    </div>

    `;

    area.appendChild(el);

  });

}

function renderBombas(lista){

  const area = document.getElementById("areaBombas");
  area.innerHTML="";

  lista.forEach(b=>{

    const ligada = b.estado==="ligada";

    const el=document.createElement("div");

    el.className="card "+(ligada?"ligada":"desligada");

    el.innerHTML=`

    <h2>${b.nome}</h2>
    <div class="valor">${ligada?"🟢 LIGADA":"🔴 DESLIGADA"}</div>
    <div>${b.ciclo||0} ciclos</div>

    `;

    area.appendChild(el);

  });

}

function renderPressoes(lista){

  const area=document.getElementById("areaPressoes");
  area.innerHTML="";

  lista.forEach(p=>{

    const el=document.createElement("div");

    el.className="card";

    el.innerHTML=`

    <h2>${p.nome}</h2>
    <div class="valor">${formatarPressao(p.pressao)}</div>

    `;

    area.appendChild(el);

  });

}

function formatar(n){
  return Number(n||0).toLocaleString("pt-BR");
}

function formatarPressao(p){
  if(p===null||p===undefined) return "--";
  return Number(p).toFixed(2)+" bar";
}

function setStatus(txt){
  const el=document.getElementById("statusSistema");
  if(el) el.innerText=txt;
}
