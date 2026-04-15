// =========================
// SENSOR ENGINE HAG v2
// =========================

const cache = {};
const calib = {};

// -------------------------
// FILTRO ANTI-RUÍDO
// -------------------------
export function filtrarRuido(ref, valor) {
  if (!cache[ref]) {
    cache[ref] = valor;
    return valor;
  }

  const filtrado = (valor * 0.35) + (cache[ref] * 0.65);
  cache[ref] = filtrado;

  return filtrado;
}

// -------------------------
// AUTO CALIBRAÇÃO
// -------------------------
export function autoCalibrar(ref, valor, vazio, cheio) {
  if (!calib[ref]) {
    calib[ref] = { min: valor, max: valor };
  }

  calib[ref].min = Math.min(calib[ref].min, valor);
  calib[ref].max = Math.max(calib[ref].max, valor);

  const range = calib[ref].max - calib[ref].min;

  if (range < 0.0005) {
    return { vazio, cheio };
  }

  return {
    vazio: calib[ref].min,
    cheio: calib[ref].max
  };
}

// -------------------------
// DETECÇÃO DE SATURAÇÃO
// -------------------------
export function sensorSaturado(ref, valor, vazio, cheio) {
  const range = cheio - vazio;
  const margem = range * 0.03;

  const noTopo = valor >= (cheio - margem);
  const travado = Math.abs(valor - cheio) < margem;

  return noTopo && travado;
}

// -------------------------
// FUNÇÃO PRINCIPAL
// -------------------------
export function calcularPercentualSeguro(ref, valor, sensor) {
  const filtrado = filtrarRuido(ref, valor);

  let vazio = sensor.leituraVazio;
  let cheio = sensor.leituraCheio;

  const auto = autoCalibrar(ref, filtrado, vazio, cheio);
  vazio = auto.vazio;
  cheio = auto.cheio;

  const range = cheio - vazio;
  if (range <= 0) return 0;

  let percent = (filtrado - vazio) / range;

  if (sensorSaturado(ref, filtrado, vazio, cheio)) {
    percent = 0.97; // trava anti-100% falso
  }

  percent = Math.max(0, Math.min(1, percent));

  return percent * 100;
}
