// =========================================================
// 🧠 SENSOR ENGINE INTELIGENTE – HAG v2
// =========================================================

const memoria = {}; // memória viva por sensor

// ---------------- FILTRO DE RUÍDO (industrial) ----------------
function filtrarRuido(ref, valor) {
  if (!memoria[ref]) memoria[ref] = { historico: [] };

  const hist = memoria[ref].historico;

  hist.push(valor);
  if (hist.length > 10) hist.shift();

  const media = hist.reduce((a, b) => a + b, 0) / hist.length;

  return media;
}

// ---------------- AUTO CALIBRAÇÃO ----------------
function autoCalibrar(ref, valor, vazio, cheio) {
  if (!memoria[ref]) memoria[ref] = {};

  const m = memoria[ref];

  if (!m.vazio) m.vazio = vazio;
  if (!m.cheio) m.cheio = cheio;

  // 📉 aprende vazio (devagar)
  if (valor < m.vazio) {
    m.vazio = valor;
  }

  // 📈 aprende cheio (devagar e com segurança)
  if (valor > m.cheio && valor < cheio * 1.2) {
    m.cheio = valor;
  }

  return {
    vazio: m.vazio,
    cheio: m.cheio
  };
}

// ---------------- DETECÇÃO DE SENSOR COM PROBLEMA ----------------
function sensorForaDaCurva(valor, vazio, cheio) {
  // muito abaixo ou muito acima → erro
  if (valor < vazio * 0.8) return true;
  if (valor > cheio * 1.3) return true;
  return false;
}

// ---------------- DETECÇÃO DE SENSOR TRAVADO ----------------
function sensorTravado(ref, valor) {
  if (!memoria[ref]) memoria[ref] = {};

  const m = memoria[ref];

  if (m.ultimoValor === valor) {
    m.contadorTravado = (m.contadorTravado || 0) + 1;
  } else {
    m.contadorTravado = 0;
  }

  m.ultimoValor = valor;

  return m.contadorTravado > 20; // ~20 leituras iguais
}

// ---------------- FUNÇÃO PRINCIPAL ----------------
export function calcularPercentualSeguro(ref, valor, sensor) {
  const filtrado = filtrarRuido(ref, valor);

  let { leituraVazio: vazio, leituraCheio: cheio } = sensor;

  // auto calibração ativa
  const auto = autoCalibrar(ref, filtrado, vazio, cheio);
  vazio = auto.vazio;
  cheio = auto.cheio;

  const range = cheio - vazio;

  if (range <= 0) return 0;

  let percent = (filtrado - vazio) / range;

  // 🚨 sensor fora da curva
  if (sensorForaDaCurva(filtrado, vazio, cheio)) {
    console.warn(`⚠️ Sensor fora da curva: ${ref}`);
    percent = 0;
  }

  // 🚨 sensor travado
  if (sensorTravado(ref, filtrado)) {
    console.warn(`⚠️ Sensor travado: ${ref}`);
  }

  // 🚫 trava anti 100% falso
  if (percent >= 1) percent = 0.97;

  percent = Math.max(0, Math.min(1, percent));

  return percent * 100;
}
