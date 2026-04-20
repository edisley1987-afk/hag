const API = "/api/dashboard";

let ws;
let reconnectDelay = 3000;
let ultimoDado = Date.now();

init();

function init(){
  conectarWS();

  // fallback sempre ativo
  setInterval(fallbackHTTP, 8000);

  // monitor de travamento
  setInterval(() => {
    if (Date.now() - ultimoDado > 10000) {
      setStatus("🟡 Sem atualização");
    }
  }, 5000);
}

// =======================
// 🔌 WEBSOCKET
// =======================
function conectarWS(){

  const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocolo}//${location.host}`);

  ws.onopen = () =>{
    console.log("WS conectado");
    setStatus("🟢 Tempo real conectado");
  }

  ws.onmessage = (msg)=>{

    try{
      ultimoDado = Date.now();

      const payload = JSON.parse(msg.data);

      // trata todos os tipos
      if (payload.type === "init" || payload.type === "update" || payload.type === "heartbeat") {
        montarEstrutura(payload.dados);
        return;
      }

      if(payload.dados){
        montarEstrutura(payload.dados);
        return;
      }

      if(payload.reservatorios){
        atualizarTela(payload);
      }

    }catch(e){
      console.log("Erro WS:", e);
    }

  }

  ws.onclose = ()=>{
    console.log("WS desconectado");
    setStatus("🔴 Reconectando...");
    setTimeout(conectarWS, reconnectDelay);
  }

  ws.onerror = ()=>{
    ws.close();
  }

}

// =======================
// 🌐 FALLBACK HTTP
// =======================
async function fallbackHTTP(){

  try{
    const res = await fetch(API + "?ts=" + Date.now());
    const data = await res.json();

    atualizarTela(data);

  }catch(e){
    setStatus("🔴 Sem conexão");
  }

}

// =======================
// 🔄 CONVERSÃO DE DADOS
// =======================
function montarEstrutura(dados){

  if(!dados) return;

  const estrutura = {

    reservatorios:[
      {
        nome:"Reservatório Elevador",
        percent:dados["Reservatorio_Elevador_current_percent"] || 0,
        current_liters:dados["Reservatorio_Elevador_current"] || 0
      },
      {
        nome:"Reservatório Osmose",
        percent:dados["Reservatorio_Osmose_current_percent"] || 0,
        current_liters:dados["Reservatorio_Osmose_current"] || 0
      },
      {
        nome:"Reservatório CME",
        percent:dados["Reservatorio_CME_current_percent"] || 0,
        current_liters:dados["Reservatorio_CME_current"] || 0
      },
      {
        nome:"Água Abrandada",
        percent:dados["Reservatorio_Agua_Abrandada_current_percent"] || 0,
        current_liters:dados["Reservatorio_Agua_Abrandada_current"] || 0
      },
      {
        nome:"Lavanderia",
        percent:dados["Reservatorio_lavanderia_current_percent"] || 0,
        current_liters:dados["Reservatorio_lavanderia_current"] || 0
      }
    ],

    bombas:[
      {
        nome:"Bomba 01",
        estado:dados["Bomba_01_binary"] === 1 ? "ligada" : "desligada",
        ciclo:dados["Ciclos_Bomba_01_counter"] || 0
      },
      {
        nome:"Bomba 02",
        estado:dados["Bomba_02_binary"] === 1 ? "ligada" : "desligada",
        ciclo:dados["Ciclos_Bomba_02_counter"] || 0
      },
      {
        nome:"Bomba Osmose",
        estado:dados["Bomba_Osmose_binary"] === 1 ? "ligada" : "desligada",
        ciclo:dados["Ciclos_Bomba_Osmose_counter"] || 0
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

// =======================
// 🎨 ATUALIZA UI
// =======================
function atualizarTela(data){

  // hora segura
  const elHora = document.getElementById("hora");
  if(elHora){
    elHora.innerText = new Date().toLocaleTimeString("pt-BR");
  }

  renderReservatorios(data.reservatorios || []);
  renderBombas(data.bombas || []);
  renderPressoes(data.pressoes || []);

}

// =======================
// 💧 RESERVATÓRIOS
// =======================
function renderReservatorios(lista){

  const area = document.getElementById("areaReservatorios");
  if(!area) return;

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
        <span></span><span></span><span></span><span></span><span></span>
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

// =======================
// 🔄 BOMBAS
// =======================
function renderBombas(lista){

  const area = document.getElementById("areaBombas");
  if(!area) return;

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

// =======================
// ⚙️ PRESSÕES
// =======================
function renderPressoes(lista){

  const area=document.getElementById("areaPressoes");
  if(!area) return;

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

// =======================
// 🧮 FORMATOS
// =======================
function formatar(n){
  return Number(n||0).toLocaleString("pt-BR");
}

function formatarPressao(p){
  if(p===null||p===undefined) return "--";
  return Number(p).toFixed(2)+" bar";
}

// =======================
// 📡 STATUS
// =======================
function setStatus(txt){
  const el=document.getElementById("statusSistema");
  if(el) el.innerText=txt;
}
