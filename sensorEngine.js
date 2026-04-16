// sensorEngine.js – NÍVEL HARD (VERSÃO ESTÁVEL PRODUÇÃO)

const memoria = {}; // estado por sensor

export function calcularNivelInteligente(ref, leitura, sensor) {
  // ================================
  // 0. INIT MEMÓRIA
  // ================================
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
  // 2. AUTO CALIBRAÇÃO SEGURA
  // ================================
  // ajusta apenas dentro de limites seguros
  if (
    leituraFiltrada < mem.vazioAuto &&
    leituraFiltrada > sensor.leituraVazio - 0.001
  ) {
    mem.vazioAuto = leituraFiltrada;
  }

  if (
    leituraFiltrada > mem.cheioAuto &&
    leituraFiltrada < sensor.leituraCheio + 0.001
  ) {
    mem.cheioAuto = leituraFiltrada;
  }

  // ================================
  // 3. RANGE PROTEGIDO
  // ================================
  let range = mem.cheioAuto - mem.vazioAuto;

  if (range < 0.0005) {
    range = sensor.leituraCheio - sensor.leituraVazio;
  }

  if (range <= 0) {
    return {
      percent: 0,
      litros: 0,
      erro: "Range inválido"
    };
  }

  // ================================
  // 4. CÁLCULO BASE
  // ================================
  let percent =
    ((leituraFiltrada - mem.vazioAuto) / range) * 100;

  // ================================
  // 5. CORREÇÃO NÃO LINEAR (leve)
  // ================================
  if (percent > 10) {
    percent = percent * 1.02;
  }

  // ================================
  // 6. LIMITES
  // ================================
  percent = Math.max(0, Math.min(100, percent));

  // proteção extra (não deixa negativo)
  if (leituraFiltrada < mem.vazioAuto) {
    percent = 0;
  }

  // ================================
  // 7. LITROS
  // ================================
  const litros = (percent / 100) * sensor.capacidade;

  // ================================
  // 8. DETECÇÃO DE ERROS
  // ================================
  let erro = null;

  // validação baseada no sensor (não fixa!)
  if (
    leitura < sensor.leituraVazio - 0.002 ||
    leitura > sensor.leituraCheio + 0.002
  ) {
    erro = "Leitura fora da faixa esperada";
  }

  // sensor travado
  if (mem.historico.length >= 5) {
    const variacao =
      Math.max(...mem.historico) - Math.min(...mem.historico);

    if (variacao < 0.00001) {
      erro = "Sensor travado";
    }
  }

  // ================================
  // 9. DEBUG (IMPORTANTE)
  // ================================
  console.log("DEBUG SENSOR", {
    ref,
    leitura,
    leituraFiltrada,
    vazio: mem.vazioAuto,
    cheio: mem.cheioAuto,
    range,
    percent
  });

  // ================================
  // 10. RESULTADO FINAL
  // ================================
  return {
    percent: Number(percent.toFixed(1)),
    litros: Math.round(litros),
    erro
  };
}
