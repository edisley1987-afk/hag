const memoria = {};

export function calcularNivelInteligente(ref, leitura, sensor) {
  if (!memoria[ref]) {
    memoria[ref] = {
      historico: [],
      vazioAuto: sensor.leituraVazio,
      cheioAuto: sensor.leituraCheio,
      _resetado: false
    };
  }

  const mem = memoria[ref];

  // 1. FILTRO
  mem.historico.push(leitura);
  if (mem.historico.length > 10) mem.historico.shift();

  const leituraFiltrada =
    mem.historico.reduce((a, b) => a + b, 0) / mem.historico.length;

  // 2. AUTO CALIBRAÇÃO (CORRIGIDA)
  if (leituraFiltrada < sensor.leituraVazio) {
    mem.vazioAuto = leituraFiltrada;
  }

  if (leituraFiltrada > sensor.leituraCheio) {
    mem.cheioAuto = leituraFiltrada;
  }

  let range = mem.cheioAuto - mem.vazioAuto;

  // 🔴 PROTEÇÃO
  if (range <= 0) {
    console.warn("⚠️ Range inválido, resetando calibração", ref);

    mem.vazioAuto = sensor.leituraVazio;
    mem.cheioAuto = sensor.leituraCheio;

    range = mem.cheioAuto - mem.vazioAuto;
  }

  // RESET CONTROLADO
  if (range < 0.0005) {
    if (!mem._resetado) {
      mem.vazioAuto = sensor.leituraVazio;
      mem.cheioAuto = sensor.leituraCheio;
      mem._resetado = true;
    }
    range = mem.cheioAuto - mem.vazioAuto;
  } else {
    mem._resetado = false;
  }

  // 3. CÁLCULO
  let percent =
    ((leituraFiltrada - mem.vazioAuto) / range) * 100;

  // 🧠 ANTI-ZERO (AGORA NO LUGAR CERTO)
  if (percent === 0 && leituraFiltrada > sensor.leituraVazio) {
    percent =
      ((leituraFiltrada - sensor.leituraVazio) /
        (sensor.leituraCheio - sensor.leituraVazio)) *
      100;
  }

  // CORREÇÃO
  if (percent > 10) {
    percent = percent * 1.02;
  }

  // LIMITES
  percent = Math.max(0, Math.min(100, percent));

  if (leituraFiltrada < mem.vazioAuto) {
    percent = 0;
  }

  // LITROS
  const litros = (percent / 100) * sensor.capacidade;

  // ERROS
  let erro = null;

  if (
    leitura < sensor.leituraVazio - 0.002 ||
    leitura > sensor.leituraCheio + 0.002
  ) {
    erro = "Leitura fora da faixa esperada";
  }

  if (mem.historico.length >= 5) {
    const variacao =
      Math.max(...mem.historico) - Math.min(...mem.historico);

    if (variacao < 0.00001) {
      erro = "Sensor travado";
    }
  }

  // DEBUG
  console.log("DEBUG SENSOR", {
    ref,
    leitura,
    leituraFiltrada,
    vazio: mem.vazioAuto,
    cheio: mem.cheioAuto,
    range,
    percent
  });

  return {
    percent: Number(percent.toFixed(1)),
    litros: Math.round(litros),
    erro
  };
}
