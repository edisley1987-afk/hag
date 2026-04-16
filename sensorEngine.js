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

  // 2. AUTO CALIBRAÇÃO
  const AJUSTE_LENTO = 0.001;

  if (leituraFiltrada < mem.vazioAuto) {
    mem.vazioAuto += (leituraFiltrada - mem.vazioAuto) * AJUSTE_LENTO;
  }

  if (leituraFiltrada > mem.cheioAuto) {
    mem.cheioAuto += (leituraFiltrada - mem.cheioAuto) * AJUSTE_LENTO;
  }

  let range = mem.cheioAuto - mem.vazioAuto;

  // 🔴 PROTEÇÃO CRÍTICA
  if (range <= 0) {
    console.warn("⚠️ Range inválido, resetando calibração", ref);

    mem.vazioAuto = sensor.leituraVazio;
    mem.cheioAuto = sensor.leituraCheio;

    range = mem.cheioAuto - mem.vazioAuto;
  }

  // 3. RESET CONTROLADO
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

  // 4. CÁLCULO
  let percent =
    ((leituraFiltrada - mem.vazioAuto) / range) * 100;

  // 5. CORREÇÃO
  if (percent > 10) {
    percent = percent * 1.02;
  }

  // 6. LIMITES
  percent = Math.max(0, Math.min(100, percent));

  if (leituraFiltrada < mem.vazioAuto) {
    percent = 0;
  }

  // 7. LITROS
  const litros = (percent / 100) * sensor.capacidade;

  // 8. ERROS
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
