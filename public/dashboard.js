// ======================= CONFIGURAÇÃO =======================

const SENSOR_CONFIG = {
  "Reservatorio_Elevador_current": {
    nome: "Reservatório Elevador",
    capacidade: 20000,
    leituraVazio: 0.004168,
    leituraCheio: 0.008056
  },
  "Reservatorio_Osmose_current": {
    nome: "Reservatório Osmose",
    capacidade: 200,
    leituraVazio: 0.00505,
    leituraCheio: 0.006533
  },
  "Reservatorio_CME_current": {
    nome: "Reservatório CME",
    capacidade: 1000,
    leituraVazio: 0.004088,
    leituraCheio: 0.004408
  },
  "Reservatorio_Abrandada_current": {
    nome: "Água Abrandada",
    capacidade: 9000,
    leituraVazio: 0.004008,
    leituraCheio: 0.004929
  }
};

let historico = JSON.parse(localStorage.getItem("historicoReservatorios")) || {};

// ======================= FUNÇÕES AUXILIARES =======================

function dataHoje() {
  return new Date().toISOString().split("T")[0];
}

function atualizarHistorico(ref, litros) {
  const dia = dataHoje();
  if (!historico[dia]) historico[dia] = {};
  if (!historico[dia][ref]) historico[dia][ref] = { min: litros, max: litros };
  else {
    historico[dia][ref].min = Math.min(historico[dia][ref].min, litros);
    historico[dia][ref].max = Math.max(historico[dia][ref].max, litros);
  }
  localStorage.setItem("historicoReservatorios", JSON.stringify(historico));
}

// ======================= DASHBOARD PRINCIPAL =======================

async function atualizarDashboard() {
  try {
    const res = await fetch("/dados");
    const dados = await res.json();

    if (!dados || Object.keys(dados).length === 0) {
      console.warn("Nenhum dado recebido do servidor.");
      return;
    }

    document.getElementById("lastUpdate").textContent =
      "Última atualização: " + new Date(dados.timestamp).toLocaleString();

    const ctxs = {
      "Reservatório Elevador": document.getElementById("relogioElevador")?.getContext("2d"),
      "Reservatório Osmose": document.getElementById("relogioOsmose")?.getContext("2d"),
      "Reservatório CME": document.getElementById("relogioCME")?.getContext("2d"),
      "Água Abrandada": document.getElementById("relogioAbrandada")?.getContext("2d"),
    };

    Object.entries(SENSOR_CONFIG).forEach(([ref, cfg]) => {
      const leitura = dados[ref] ?? cfg.leituraVazio;
      let proporcao = (leitura - cfg.leituraVazio) / (cfg.leituraCheio - cfg.leituraVazio);
      proporcao = Math.max(0, Math.min(1, proporcao));
      const litros = cfg.capacidade * proporcao;
      const porcent = proporcao * 100;

      atualizarHistorico(ref, litros);

      let cor = "#00c9a7";
      if (porcent < 30) cor = "#e53935";
      else if (porcent < 50) cor = "#fbc02d";

      const idBase = cfg.nome.toLowerCase().split(" ")[1];
      const valorEl = document.getElementById(idBase + "Valor");
      const percentEl = document.getElementById(idBase + "Percent");

      if (valorEl && percentEl) {
        valorEl.textContent = `${litros.toFixed(0)} L`;
        percentEl.innerHTML = `<span style="color:${cor}; font-weight:bold">${porcent.toFixed(1)}%</span>`;
      }

      desenharGauge(ctxs[cfg.nome], porcent, cor, cfg.nome);
    });
  } catch (err) {
    console.error("Erro ao atualizar dashboard:", err);
  }
}

// ======================= GAUGE =======================

function desenharGauge(ctx, porcent, cor, nome) {
  if (!ctx) return;
  const chartExistente = Chart.getChart(ctx);
  if (chartExistente) chartExistente.destroy();

  new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [porcent, 100 - porcent],
          backgroundColor: [cor, "#333"],
          borderWidth: 0,
          cutout: "80%",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false },
        title: {
          display: true,
          text: nome,
          color: "#fff",
          font: { size: 14 },
        },
      },
    },
  });
}

// ======================= RELÓGIO =======================

function atualizarRelogio() {
  const agora = new Date();
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  const segundos = String(agora.getSeconds()).padStart(2, "0");
  const clockEl = document.getElementById("clock");
  if (clockEl) clockEl.textContent = `${horas}:${minutos}:${segundos}`;
}
setInterval(atualizarRelogio, 1000);
atualizarRelogio();

// ======================= MODAL DE HISTÓRICO =======================

function abrirHistorico() {
  const dia = dataHoje();
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h2>📊 Histórico de Níveis (${dia})</h2>
      <table>
        <thead>
          <tr>
            <th>Reservatório</th>
            <th>Mínimo (L)</th>
            <th>Máximo (L)</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(SENSOR_CONFIG)
            .map(([ref, cfg]) => {
              const hist = historico[dia]?.[ref];
              if (!hist)
                return `<tr><td>${cfg.nome}</td><td>—</td><td>—</td></tr>`;
              return `<tr><td>${cfg.nome}</td><td>${hist.min.toFixed(0)}</td><td>${hist.max.toFixed(0)}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
      <button id="fecharModal">Fechar</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("fecharModal").onclick = () => modal.remove();
}

// ======================= INICIALIZAÇÃO =======================

document.addEventListener("DOMContentLoaded", () => {
  const botaoHistorico = document.createElement("button");
  botaoHistorico.textContent = "📈 Ver Histórico";
  botaoHistorico.className = "btn-historico";
  botaoHistorico.onclick = abrirHistorico;
  document.querySelector("header").appendChild(botaoHistorico);

  atualizarDashboard();
  setInterval(atualizarDashboard, 10000);
});
