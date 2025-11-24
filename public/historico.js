// historico.js - Dashboard PRO (multigraf: linha + barras)
// Busca dados em /historico/24h/:reservatorio (usa nomes: elevador, osmose, cme, abrandada)

const API_BASE = window.location.origin;
const CHART_CANVAS_ID = "histChart";
let chart = null;

// mapping between short names and server param
const MAPPING = {
  "elevador": "Reservatorio_Elevador_current",
  "osmose": "Reservatorio_Osmose_current",
  "cme": "Reservatorio_CME_current",
  "abrandada": "Reservatorio_Agua_Abrandada_current"
};

// UI
const select = document.getElementById("reservatorioSelect");
const btnRefresh = document.getElementById("btnRefresh");
const btnExport = document.getElementById("btnExport");
const btnBack = document.getElementById("btnBack");
const lastUpdateEl = document.getElementById("lastUpdate");

// stats
const statMin = document.getElementById("statMin");
const statMax = document.getElementById("statMax");
const statAvg = document.getElementById("statAvg");
const statLast = document.getElementById("statLast");
const statConsumo = document.getElementById("statConsumo");
const tableBody = document.querySelector("#pontosTable tbody");
const titleEl = document.getElementById("histTitle");
const subEl = document.getElementById("subTitle");

// init
function q(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// allow opening historico.html?reservatorio=Reservatorio_Elevador_current or ?reservatorio=elevador
function resolveShortName(param){
  if(!param) return 'elevador';
  param = String(param).toLowerCase();
  if(param in MAPPING) return param;
  // try remove _current and prefixes/suffixes
  const s = param.replace(/_?current|reservatorio|reservatorio_|reservatorio-|reservatorio/gi, "").replace(/[^a-z]/gi, "");
  if(s === 'elevador' || s === 'osmose' || s === 'cme' || s.startsWith('abr')) return s === 'abr' ? 'abrandada' : s;
  // fallback
  return 'elevador';
}

function atualizarTitulo(short){
  // nice title
  const nome = {
    elevador: "Reservatório Elevador",
    osmose: "Reservatório Osmose",
    cme: "Reservatório CME",
    abrandada: "Água Abrandada"
  }[short] || short;
  titleEl.textContent = `Histórico — ${nome}`;
  subEl.textContent = "Últimas 24 horas";
}

// fetch data from /historico/24h/:reservatorio
async function fetch24h(short){
  try {
    const resp = await fetch(`${API_BASE}/historico/24h/${short}`);
    if(!resp.ok) throw new Error("Erro na API");
    const data = await resp.json();
    return data; // array of { reservatorio, timestamp, valor }
  } catch(err){
    console.error("Erro buscando histórico 24h:", err);
    return [];
  }
}

function buildDatasets(points){
  // points: array sorted by timestamp asc
  // build labels and values
  const labels = points.map(p => {
    const d = new Date(p.timestamp);
    return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  });
  const values = points.map(p => p.valor);

  // compute consumption bars = decrease between consecutive points (prev - curr)
  const consumo = [];
  for(let i=0;i<values.length;i++){
    if(i===0) consumo.push(0);
    else {
      const delta = values[i-1] - values[i]; // positive if decreased (consumed)
      consumo.push(delta > 0 ? Number(delta.toFixed(2)) : 0);
    }
  }

  return { labels, values, consumo };
}

function calcStats(values){
  if(!values || values.length===0) return { min:'--', max:'--', avg:'--', last:'--', consumoTotal:'--' };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a,b)=>a+b,0)/values.length;
  const last = values[values.length-1];
  // consumo total = primeiro - last (if positive)
  const consumoTotal = (values.length>1)? Math.max(0, values[0]-values[values.length-1]) : 0;
  return {
    min: Math.round(min),
    max: Math.round(max),
    avg: Math.round(avg),
    last: Math.round(last),
    consumoTotal: Number(consumoTotal.toFixed(2))
  };
}

function renderTable(points, consumoArr){
  tableBody.innerHTML = "";
  for(let i=0;i<points.length;i++){
    const p = points[i];
    const tr = document.createElement("tr");
    const d = new Date(p.timestamp);
    const hora = d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit', second:undefined});
    const val = Number(p.valor).toLocaleString('pt-BR', {maximumFractionDigits:0});
    const varText = (i===0) ? "-" : (consumoArr[i] > 0 ? `-${consumoArr[i].toFixed(2)} L` : '0 L');
    tr.innerHTML = `<td>${hora}</td><td>${val}</td><td>${varText}</td>`;
    tableBody.appendChild(tr);
  }
}

function createChart(labels, values, consumo){
  const ctx = document.getElementById(CHART_CANVAS_ID).getContext('2d');

  if(chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Nível (L)',
          data: values,
          yAxisID: 'yLvl',
          tension: 0.35,
          borderColor: '#0a4fa3',
          backgroundColor: 'rgba(10,79,163,0.08)',
          pointRadius: 3,
          fill: true
        },
        {
          type: 'bar',
          label: 'Consumo (L)',
          data: consumo,
          yAxisID: 'yCons',
          backgroundColor: 'rgba(255,121,0,0.85)',
          borderRadius: 3
        }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      responsive: true,
      scales: {
        yLvl: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          ticks: { callback: v => Number(v).toLocaleString('pt-BR') }
        },
        yCons: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { callback: v => Number(v).toLocaleString('pt-BR') }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context){
              return context.dataset.label + ': ' + Number(context.parsed.y).toLocaleString('pt-BR') + (context.dataset.type === 'bar' ? ' L' : ' L');
            }
          }
        }
      }
    }
  });
}

async function carregarERenderizar(short){
  atualizarTitulo(short);
  const raw = await fetch24h(short);
  // raw is array of {reservatorio, timestamp, valor}
  raw.sort((a,b)=>a.timestamp - b.timestamp);
  // guard - if empty show message
  if(!raw.length){
    tableBody.innerHTML = `<tr><td colspan="3">Nenhum dado nas últimas 24 horas.</td></tr>`;
    if(chart) chart.destroy();
    statMin.textContent = statMax.textContent = statAvg.textContent = statLast.textContent = statConsumo.textContent = "--";
    lastUpdateEl.textContent = "Última atualização: --";
    return;
  }

  const { labels, values, consumo } = buildDatasets(raw);
  const stats = calcStats(values);

  statMin.textContent = stats.min + " L";
  statMax.textContent = stats.max + " L";
  statAvg.textContent = stats.avg + " L";
  statLast.textContent = stats.last + " L";
  statConsumo.textContent = stats.consumoTotal + " L";

  createChart(labels, values, consumo);
  renderTable(raw, consumo);

  // last update uses server time if present at last point
  const ts = raw[raw.length-1].timestamp;
  lastUpdateEl.textContent = "Última atualização: " + new Date(ts).toLocaleString('pt-BR');
}

function exportCSV(points){
  if(!points || !points.length) return;
  const rows = [['timestamp','valor']];
  points.forEach(p => rows.push([new Date(p.timestamp).toISOString(), p.valor]));
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_${select.value}_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// --- events ---
btnRefresh.addEventListener('click', ()=> {
  carregarERenderizar(select.value);
});

btnExport.addEventListener('click', async ()=> {
  // fetch again to ensure full set
  const short = select.value;
  const data = await fetch(`${API_BASE}/historico/24h/${short}`).then(r=>r.ok? r.json(): []);
  exportCSV(data);
});

// back
btnBack.addEventListener('click', ()=> window.history.back());

// on load: if query param defines reservoir, set select
window.addEventListener('DOMContentLoaded', ()=>{
  const qparam = q('reservatorio');
  const short = resolveShortName(qparam);
  select.value = short;
  carregarERenderizar(short);
});
