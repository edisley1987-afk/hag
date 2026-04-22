// ===============================
// 📊 HISTÓRICO PROFISSIONAL HAG (V3)
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
    // 🔄 ORDENAR POR DATA
    // ===============================
    dados.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));


    // ===============================
    // 📊 CALCULAR CONSUMO
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
    // 📈 DADOS PARA GRÁFICO
    // ===============================
    const datasets = {};



    dados.forEach(p => {

      const dataFormatada = new Date(p.timestamp).toLocaleString("pt-BR");
      const volume = Number(p.valor || 0);
      const percent = Number(p.percent || 0);

      // ===============================
      // 📊 CALCULO DE CONSUMO
      // ===============================
      if(ultimoNivel[p.reservatorio] !== undefined){

        const diferenca = ultimoNivel[p.reservatorio] - volume;

        if(diferenca > 0){

          if(p.reservatorio.toLowerCase().includes("elevador"))
            consumoElevador += diferenca;

          if(p.reservatorio.toLowerCase().includes("lavanderia"))
            consumoLavanderia += diferenca;

          if(p.reservatorio.toLowerCase().includes("osmose"))
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
    const elElevador = document.getElementById("consumoElevador");
    const elLavanderia = document.getElementById("consumoLavanderia");
    const elOsmose = document.getElementById("consumoOsmose");
    const elTotal = document.getElementById("consumoTotal");

    if(elElevador)
      elElevador.innerText = formatarNumero(consumoElevador) + " L";

    if(elLavanderia)
      elLavanderia.innerText = formatarNumero(consumoLavanderia) + " L";

    if(elOsmose)
      elOsmose.innerText = formatarNumero(consumoOsmose) + " L";

    if(elTotal)
      elTotal.innerText =
        formatarNumero(consumoElevador + consumoLavanderia + consumoOsmose) + " L";



    // ===============================
    // 📊 DESTRUIR GRÁFICO ANTIGO
    // ===============================
    if (grafico) {
      grafico.destroy();
    }


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

          legend:{
            position:"bottom"
          },

          title:{
            display:true,
            text:"📊 Histórico de Nível dos Reservatórios (%)"
          },

          tooltip:{
            callbacks:{
              label:function(context){
                return context.dataset.label + ": " +
                context.parsed.y.toFixed(1) + "%";
              }
            }
          }

        },

        scales:{

          x:{
            type:"time",
            time:{
              unit:"hour",
              tooltipFormat:"dd/MM HH:mm"
            },
            title:{
              display:true,
              text:"Tempo"
            }
          },

          y:{
            beginAtZero:true,
            max:100,
            title:{
              display:true,
              text:"Nível (%)"
            }
          }

        }

      }

    });



    // ===============================
    // ⏰ ATUALIZAR HORA
    // ===============================
    const elHora = document.getElementById("horaHistorico");

    if(elHora){
      elHora.innerText = new Date().toLocaleTimeString("pt-BR");
    }



  } catch (err) {

    container.innerHTML = `<p style="color:red;">❌ ${err.message}</p>`;
    console.error(err);

  }

}



// ===============================
// 🔧 UTILITÁRIOS
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



// ===============================
// 🔄 AUTO REFRESH
// ===============================
setInterval(carregarHistorico, 60000);



// ===============================
// 🚀 START
// ===============================
carregarHistorico();
