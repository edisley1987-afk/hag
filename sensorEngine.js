// sensorEngine.js – NÍVEL HARD

const memoria = {}; // guarda histórico por sensor

export function calcularNivelInteligente(ref, leitura, sensor) {
  if (!memoria[ref]) {
    memoria[ref] = {
      historico: [],
      vazioAuto: sensor.leituraVazio,
      cheioAuto: sensor.leituraCheio
    };
  }
  const mem = memoria[ref];

  // ================================
  // 1. FILTRO ANTI-RUÍDO (média móvel)
  // ================================
  mem.historico.push(leitura);
  if (mem.historico.length > 10) mem.historico.shift();

  const leituraFiltrada =
    mem.historico.reduce((a, b) => a + b, 0) / mem.historico.length;

  // ================================
  // 2. AUTO CALIBRAÇÃO
  // ================================
  if (leituraFiltrada < mem.vazioAuto) mem.vazioAuto = leituraFiltrada;
  if (leituraFiltrada > mem.cheioAuto) mem.cheioAuto = leituraFiltrada;

  // evita range inválido
  const range = mem.cheioAuto - mem.vazioAuto;
  if (range <= 0.0001) return { percent: 0, litros: 0 };

  // ================================
  // 3. CÁLCULO BASE
  // ================================
  let percent =
    ((leituraFiltrada - mem.vazioAuto) / range) * 100;

  // ================================
  // 4. CURVA NÃO LINEAR (correção real)
  // ================================
  percent = percent * 1.04 - 1.5;

  percent = Math.max(0, Math.min(100, percent));

  // ================================
  // 5. LITROS
  // ================================
  let litros = (percent / 100) * sensor.capacidade;

  // ================================
  // 6. DETECÇÃO DE ERRO
  // ================================
  let erro = null;

  if (leitura < 0.003 || leitura > 0.02) {
    erro = "Leitura fora do padrão (4-20mA)";
  }

  if (mem.historico.length >= 5) {
    const variacao =
      Math.max(...mem.historico) - Math.min(...mem.historico);

    if (variacao < 0.00001) {
      erro = "Sensor travado";
    }
  }

  return {
    percent: Number(percent.toFixed(1)),
    litros: Math.round(litros),
    erro
  };
}
