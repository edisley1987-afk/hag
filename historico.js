// ===============================
// 📊 HISTÓRICO PROFISSIONAL HAG (V4)
// ===============================

const API_URL = window.location.origin + "/historico";

let grafico = null;


// ===============================
// 🚀 CARREGAR HISTÓRICO
// ===============================
async function carregarHistorico() {

  const container = document.getElementById("historico");
  const ctx = document.getElementById("graficoHistorico");

  container.innerHTML = "⏳ Carregando histórico...";

  try {

    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao buscar histórico");

    let dados = await res.json();

    if (!dados || !dados.length) {
      container.innerHTML = "📭 Nenhum dado encontrado";
      return;
    }

    // ===============================
    // 🔄 ORDENAR
    // ===============================
    dados.sort((a,b)=> a.timestamp - b.timestamp);


    // ===============================
    // 📊 CONSUMO
    // ===============================
    let consumoElevador = 0;
    let consumoLavanderia = 0;
    let consumoOsmose = 0;

    const ultimoNivel = {};


    // ===============================
    // 📋 TABELA
    // ===============================
    let html = `
      <table class="tabela-historico">
        <thead>
          <tr>
            <th>Data</th>
            <th>Reservatório</th>
            <th>Nível (%)</th>
            <th>Volume (L)</th>
          </tr>
        </thead>
        <tbody>
    `;


    // ===============================
    // 📈 GRÁFICO
    // ===============================
    const datasets = {};


    dados.forEach(p => {

      const dataFormatada = new Date(p.timestamp).toLocaleString("pt-BR");
      const volume = Number(p.valor || 0);
      const percent = Number(p.percent || 0);

      // ===============================
      // 📊 CONSUMO INTELIGENTE
      // ===============================
      if(ultimoNivel[p.reservatorio] !== undefined){

        const diferenca = ultimoNivel[p.reservatorio] - volume;

        // ignora ruído e reset
        if(diferenca > 1 && diferenca < 1000){

          if(p.reservatorio === "elevador")
            consumoElevador += diferenca;

          if(p.reservatorio === "lavanderia")
            consumoLavanderia += diferenca;

          if(p.reservatorio === "osmose")
            consumoOsmose += diferenca;
        }
      }

      ultimoNivel[p.reservatorio] = volume;


      // ===============================
      // 📋 TABELA
      // ===============================
      html += `
        <tr>
          <td>${dataFormatada}</td>
          <td>${formatarNome(p.reservatorio)}</td>
          <td class="${percent < 20 ? 'nivel-critico':''}">
            ${percent.toFixed(1)}%
          </td>
          <td>${formatarNumero(volume)} L</td>
        </tr>
      `;


      // ===============================
      // 📈 GRÁFICO
      // ===============================
      if (!datasets[p.reservatorio]) {
        datasets[p.reservatorio] = [];
      }

      datasets[p.reservatorio].push({
        x: new Date(p.timestamp),
        y: percent
      });

    });


    html += "</tbody></table>";
    container.innerHTML = html;


    // ===============================
    // 📊 MOSTRAR CONSUMO
    // ===============================
    setText("consumoElevador", consumoElevador);
    setText("consumoLavanderia", consumoLavanderia);
    setText("consumoOsmose", consumoOsmose);

    setText("consumoTotal",
      consumoElevador + consumoLavanderia + consumoOsmose
    );


    // ===============================
    // 📊 RESET GRÁFICO
    // ===============================
    if (grafico) grafico.destroy();


    // ===============================
    // 🎨 CORES
    // ===============================
    const cores = [
      "#00e5ff",
      "#00ff88",
      "#ffd600",
      "#ff9800",
      "#b388ff",
      "#ff5252"
    ];


    // ===============================
    // 📈 CRIAR GRÁFICO
    // ===============================
    grafico = new Chart(ctx, {

      type: "line",

      data: {
        datasets: Object.entries(datasets).map(([nome, valores], index) => ({

          label: formatarNome(nome),

          data: valores.sort((a,b)=>a.x-b.x),

          borderColor: cores[index % cores.length],
          backgroundColor: cores[index % cores.length],

          tension: 0.3,
          borderWidth: 2,
          pointRadius: 1,
          fill:false

        }))
      },

      options: {

        parsing:false,
        responsive:true,
        maintainAspectRatio:false,

        plugins: {
          legend:{ position:"bottom" },
          title:{
            display:true,
            text:"📊 Histórico de Nível (%)"
          }
        },

        scales:{
          x:{
            type:"time",
            time:{ unit:"hour" }
          },
          y:{
            beginAtZero:true,
            max:100
          }
        }
      }
    });


    // ===============================
    // ⏰ HORA
    // ===============================
    const elHora = document.getElementById("horaHistorico");
    if(elHora) elHora.innerText = new Date().toLocaleTimeString("pt-BR");


  } catch (err) {

    container.innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
    console.error(err);

  }

}


// ===============================
// 🔧 UTIL
// ===============================
function formatarNome(nome){
  return nome
    .replace(/_/g," ")
    .replace(/reservatorio/gi,"Reservatório")
    .replace(/agua/gi,"Água")
    .trim();
}

function formatarNumero(n){
  return Number(n || 0).toLocaleString("pt-BR");
}

function setText(id, valor){
  const el = document.getElementById(id);
  if(el) el.innerText = formatarNumero(valor) + " L";
}


// ===============================
// 🔄 AUTO REFRESH
// ===============================
setInterval(carregarHistorico, 60000);


// ===============================
// 🚀 START
// ===============================
carregarHistorico();
