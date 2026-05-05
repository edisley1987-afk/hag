<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>HAG - Sistema de Monitoramento Hídrico 3D</title>
  <style>
/* ==========================================================
   CSS PROFISSIONAL - HAG DASHBOARD 3D INDUSTRIAL
   ========================================================== */

/* ================== RESET E LAYOUT GERAL ================== */
* { 
  box-sizing: border-box; 
  margin: 0; 
  padding: 0; 
}

body {
  font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: radial-gradient(ellipse at top, #0d1f33 0%, #061120 100%);
  color: #e0f7ff;
  min-height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  letter-spacing: 0.2px;
}

body.sem-sinal { 
  opacity: 0.6; 
  filter: grayscale(0.3); 
}

/* ================== HEADER ================== */
header {
  background: rgba(10, 26, 42, 0.85);
  backdrop-filter: blur(15px);
  padding: 22px 30px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
  position: sticky;
  top: 0;
  z-index: 100;
}

.cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  max-width: 1800px;
  margin: 0 auto;
}

.cabecalho h1 {
  font-size: 28px;
  background: linear-gradient(135deg, #00e5ff 0%, #40d4ff 50%, #80e0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 900;
  letter-spacing: 1px;
  text-shadow: 0 4px 20px rgba(0,229,255,0.3);
}

.subtitulo { 
  color: #8aa5c7; 
  font-size: 14px; 
  font-weight: 500;
}

.status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #8aa5c7;
  font-size: 14px;
  font-weight: 600;
}

.status-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #00ff88;
  box-shadow: 0 0 15px #00ff88, 0 0 30px rgba(0,255,136,0.5);
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
 0%, 100% { box-shadow: 0 0 15px #00ff88, 0 0 30px rgba(0,255,136,0.5); }
 50% { box-shadow: 0 0 25px #00ff88, 0 0 45px rgba(0,255,136,0.7); }
}

.btn-historico {
  background: linear-gradient(135deg, #123d66 0%, #1b5a99 100%);
  color: #e0f7ff;
  padding: 12px 24px;
  border-radius: 12px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.12);
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}

.btn-historico:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(27,90,153,0.5);
  border-color: rgba(0,229,255,0.4);
}

#statusSistema {
  max-width: 1800px;
  margin: 18px auto 0;
  padding: 14px 24px;
  background: rgba(10, 26, 42, 0.7);
  border-radius: 12px;
  font-size: 14px;
  color: #8aa5c7;
  border: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(8px);
  font-weight: 500;
}

.header-info {
  max-width: 1800px;
  margin: 12px auto 0;
  color: #8aa5c7;
  font-size: 14px;
  font-weight: 500;
}

/* ================== KPIs ================== */
.kpis-container { 
  max-width: 1800px; 
  margin: 20px auto 0; 
  padding: 0 30px;
  width: 100%;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr));
  gap: 18px;
  overflow-x: auto;
  padding-bottom: 5px;
}

.kpi {
  background: linear-gradient(135deg, rgba(15, 35, 60, 0.8) 0%, rgba(8, 20, 35, 0.95) 100%);
  padding: 18px 15px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  text-align: center;
  backdrop-filter: blur(12px);
  transition: all 0.35s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  position: relative;
  overflow: hidden;
  min-width: 140px;
}

.kpi::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.6), transparent);
}

.kpi:hover { 
  transform: translateY(-5px); 
  border-color: rgba(0,229,255,0.35); 
  box-shadow: 0 15px 35px rgba(0,229,255,0.25);
}

.kpi span {
  display: block;
  font-size: 11px;
  color: #8aa5c7;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  font-weight: 700;
}

.kpi strong {
  font-size: 28px;
  background: linear-gradient(135deg, #00e5ff 0%, #40d4ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 900;
  text-shadow: 0 4px 15px rgba(0,229,255,0.3);
}

/* ================== SEÇÕES ================== */
main {
  flex: 1;
  max-width: 1800px;
  margin: 20px auto 40px;
  padding: 0 30px;
  width: 100%;
}

.secao {
  margin-bottom: 50px;
}

.titulo-area {
  font-size: 24px;
  color: #00e5ff;
  margin-bottom: 25px;
  border-left: 5px solid #00e5ff;
  padding-left: 18px;
  text-shadow: 0 0 25px rgba(0,229,255,0.4);
  font-weight: 800;
  letter-spacing: 0.5px;
}

/* ================== GRIDS LADO A LADO ================== */
.grid-reservatorios,
.grid-bombas, 
.grid-pressoes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 35px;
  width: 100%;
}

/* ================== RESERVATÓRIOS 3D CANVAS ================== */
.card.reservatorio {
  background: linear-gradient(135deg, rgba(15, 35, 60, 0.85) 0%, rgba(8, 20, 35, 0.95) 100%);
  border-radius: 20px;
  padding: 32px 26px 36px;
  border: 1px solid rgba(0, 229, 255, 0.15);
  box-shadow: 
    0 25px 50px rgba(0,0,0,0.65),
    0 10px 25px rgba(0,0,0,0.45),
    inset 0 1px 0 rgba(255,255,255,0.05);
  backdrop-filter: blur(15px);
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  position: relative;
  overflow: hidden;
}

.card.reservatorio:hover {
  transform: translateY(-12px);
  border-color: rgba(0, 229, 255, 0.4);
  box-shadow: 
    0 35px 70px rgba(0,0,0,0.75),
    0 18px 40px rgba(0, 229, 255, 0.3),
    inset 0 1px 0 rgba(255,255,255,0.1);
}

.card.reservatorio.alerta {
  border-color: #ff3d00;
  animation: alerta-pulse 2s infinite;
}

@keyframes alerta-pulse {
 0%, 100% { box-shadow: 0 25px 50px rgba(255, 61, 0, 0.45), 0 10px 25px rgba(255, 61, 0, 0.25); }
 50% { box-shadow: 0 35px 70px rgba(255, 61, 0, 0.65), 0 15px 35px rgba(255, 61, 0, 0.45); }
}

.card.reservatorio h2 {
  color: #e0f7ff;
  font-size: 19px;
  margin: 0 0 25px 0;
  text-align: center;
  font-weight: 800;
  letter-spacing: 1px;
  text-shadow: 0 3px 15px rgba(0,0,0,0.9);
}

/* ================== TANQUE CILÍNDRICO CANVAS ================== */
.tanque {
  position: relative;
  width: 200px;
  height: 260px;
  margin: 30px auto;
  background: 
    radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 40%),
    linear-gradient(95deg, 
      #0a1a2a 0%, 
      #1a3a5a 15%, 
      #3a6b9e 35%, 
      #4a7fb5 50%, 
      #3a6b9e 65%, 
      #1a3a5a 85%, 
      #0a1a2a 100%);
  border-radius: 0 0 70px 70px;
  border: 3px solid rgba(160, 200, 240, 0.4);
  box-shadow: 
    inset -40px 0 80px rgba(0,0,0,0.9),
    inset 40px 0 80px rgba(255,255,255,0.08),
    inset 0 -50px 80px rgba(0,0,0,0.95),
    0 20px 50px rgba(0,0,0,0.6);
  overflow: hidden;
  transform: perspective(800px) rotateX(2deg);
}

.tanque::before {
  content: "";
  position: absolute;
  top: -25px;
  left: -5px;
  width: calc(100% + 10px);
  height: 50px;
  background: radial-gradient(ellipse at center, #8bb8e8 0%, #3a5f85 55%, #1a2f45 100%);
  border-radius: 50%;
  border: 4px solid #9cc8f0;
  box-shadow: 
    0 -12px 30px rgba(0,0,0,0.98),
    inset 0 8px 15px rgba(255,255,255,0.4),
    inset 0 -5px 10px rgba(0,0,0,0.7);
  z-index: 10;
  pointer-events: none;
}

.canvas-agua {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 0 0 68px 68px;
  z-index: 1;
}

/* Escala de nível lateral */
.escala {
  position: absolute;
  right: -58px;
  top: 25px;
  height: 80%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #7aa8cc;
  font-size: 12px;
  font-weight: 700;
  text-shadow: 2px 2px 6px rgba(0,0,0,0.95);
  z-index: 8;
  letter-spacing: 0.8px;
  pointer-events: none;
}

.escala span {
  position: relative;
  padding-right: 10px;
}

.escala span::before {
  content: "";
  position: absolute;
  right: 0;
  top: 50%;
  width: 18px;
  height: 2px;
  background: linear-gradient(90deg, #4a7fa8, transparent);
  transform: translateY(-50%);
}

/* ================== INFO DO RESERVATÓRIO ================== */
.info {
  text-align: center;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.info .valor {
  font-size: 42px;
  font-weight: 900;
  background: linear-gradient(135deg, #00e5ff 0%, #40d4ff 50%, #80e0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 5px 30px rgba(0,229,255,0.55);
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.85));
  line-height: 1;
}

.info .litros {
  font-size: 16px;
  color: #a8c8e8;
  margin-top: 12px;
  font-weight: 600;
  text-shadow: 1px 1px 6px rgba(0,0,0,0.95);
  letter-spacing: 0.8px;
}

/* ================== BOMBAS E PRESSÕES ================== */
.card {
  background: linear-gradient(135deg, rgba(15, 35, 60, 0.8) 0%, rgba(8, 20, 35, 0.95) 100%);
  padding: 26px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 15px 40px rgba(0,0,0,0.55);
  backdrop-filter: blur(12px);
  transition: all 0.35s cubic-bezier(0.23, 1, 0.32, 1);
  position: relative;
  overflow: hidden;
}

.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.4), transparent);
}

.card:hover { 
  transform: translateY(-8px); 
  border-color: rgba(0,229,255,0.35); 
  box-shadow: 0 25px 50px rgba(0,229,255,0.25);
}

.card.bomba h2, .card h2 {
  font-size: 17px;
  color: #e0f7ff;
  margin-bottom: 18px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.card.bomba.ligada { 
  border-color: #00c853; 
  box-shadow: 0 0 35px rgba(0,200,83,0.45), 0 15px 40px rgba(0,0,0,0.55); 
}
.card.bomba.desligada { 
  border-color: #555; 
  opacity: 0.65; 
}
.card.bomba.stale { 
  opacity: 0.45; 
  filter: grayscale(0.6); 
}

.status-icon {
  font-size: 44px;
  text-align: center;
  margin: 18px 0;
  filter: drop-shadow(0 5px 15px rgba(0,0,0,0.85));
}

.valor {
  font-size: 22px;
  font-weight: 800;
  color: #00e5ff;
  text-align: center;
  text-shadow: 0 3px 15px rgba(0,229,255,0.4);
  letter-spacing: 0.5px;
}

.ciclos, .valor-pressao {
  font-size: 15px;
  color: #8aa5c7;
  text-align: center;
  margin-top: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* ================== FOOTER ================== */
footer {
  text-align: center;
  padding: 35px 30px;
  color: #5a7a9a;
  font-size: 13px;
  border-top: 1px solid rgba(255,255,255,0.08);
  margin-top: auto;
  background: rgba(10, 26, 42, 0.6);
  backdrop-filter: blur(15px);
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* ================== RESPONSIVO ================== */
@media (max-width: 1200px) {
  .kpis {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }
}

@media (max-width: 768px) {
  .tanque { 
    width: 160px; 
    height: 220px; 
  }
  .kpis {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
    gap: 12px;
  }
  .kpi strong {
    font-size: 22px;
  }
  .kpi span {
    font-size: 10px;
    letter-spacing: 0.8px;
  }
  .grid-reservatorios,
  .grid-bombas,
  .grid-pressoes { 
    grid-template-columns: 1fr;
    gap: 25px;
  }
  .cabecalho h1 {
    font-size: 22px;
  }
}
  </style>
</head>
<body>
  <header>
    <div class="cabecalho">
      <div>
        <h1>HAG - Sistema Hídrico 3D</h1>
        <div class="subtitulo">Hospital Arnaldo Gavazza • Monitoramento em Tempo Real</div>
      </div>
      <div class="status">
        <div class="status-dot"></div>
        <span id="statusTexto">Conectando...</span>
      </div>
      <a href="/historico-view" class="btn-historico">📊 Histórico</a>
    </div>
    <div id="statusSistema">🟢 Sistema inicializado - Aguardando dados</div>
    <div class="header-info">
      Última atualização: <span id="hora">--:--</span>
    </div>
  </header>

  <div class="kpis-container">
    <div class="kpis">
      <div class="kpi">
        <span>Reservatórios Críticos</span>
        <strong id="kpiCritico">0</strong>
      </div>
      <div class="kpi">
        <span>Bombas Ativas</span>
        <strong id="bombasAtivas">0</strong>
      </div>
      <div class="kpi">
        <span>Elevador Hoje</span>
        <strong id="kpiElevador">0 L</strong>
      </div>
      <div class="kpi">
        <span>Lavanderia Hoje</span>
        <strong id="kpiLavanderia">0 L</strong>
      </div>
      <div class="kpi">
        <span>Osmose Hoje</span>
        <strong id="kpiOsmose">0 L</strong>
      </div>
    </div>
  </div>

  <main>
    <section class="secao">
      <h2 class="titulo-area">Reservatórios</h2>
      <div class="grid-reservatorios" id="areaReservatorios"></div>
    </section>

    <section class="secao">
      <h2 class="titulo-area">Bombas</h2>
      <div class="grid-bombas" id="areaBombas"></div>
    </section>

    <section class="secao">
      <h2 class="titulo-area">Pressões</h2>
      <div class="grid-pressoes" id="areaPressoes"></div>
    </section>
  </main>

  <footer>
    HAG - Hospital Arnaldo Gavazza © 2026 | Sistema de Monitoramento Hídrico 3D v3.0
  </footer>

  <script>
/**
 * Dashboard HAG 3D - Hospital Arnaldo Gavazza
 * Versão 3.0 - Canvas Realista
 */

const API = "/api/dashboard";
let ws = null;
let reconnectDelay = 3000;
let maxReconnectDelay = 30000;
let ultimoDado = Date.now();
let renderPending = false;
let cacheDados = new Map();

// ======================= CLASSE CANVAS ÁGUA REALISTA =======================
class AguaCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width = 200;
    this.height = canvas.height = 260;
    
    this.nivel = 0; // 0 a 1
    this.nivelTarget = 0;
    this.ondas = [];
    this.particulas = [];
    this.time = 0;
    
    for (let i = 0; i < 3; i++) {
      this.ondas.push({
        amplitude: 8 + i * 3,
        frequency: 0.02 + i * 0.005,
        phase: i * Math.PI / 3,
        speed: 0.05 + i * 0.01
      });
    }
    
    this.animate();
  }
  
  setNivel(nivel) {
    this.nivelTarget = Math.min(1, Math.max(0, nivel / 100));
  }
  
  animate() {
    this.time += 0.016;
    this.nivel += (this.nivelTarget - this.nivel) * 0.08;
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    const yAgua = this.height * (1 - this.nivel);
    this.desenharAgua(yAgua);
    this.desenharOnda(yAgua);
    this.desenharParticulas(yAgua);
    this.desenharReflexo(yAgua);
    
    requestAnimationFrame(() => this.animate());
  }
  
  desenharAgua(yAgua) {
    const grad = this.ctx.createLinearGradient(0, yAgua, 0, this.height);
    
    if (this.nivel > 0.95) {
      grad.addColorStop(0, 'rgba(0, 200, 100, 0.9)');
      grad.addColorStop(1, 'rgba(0, 120, 60, 1)');
    } else if (this.nivel > 0.7) {
      grad.addColorStop(0, 'rgba(64, 196, 255, 0.9)');
      grad.addColorStop(1, 'rgba(0, 80, 160, 1)');
    } else if (this.nivel > 0.4) {
      grad.addColorStop(0, 'rgba(0, 221, 255, 0.9)');
      grad.addColorStop(1, 'rgba(0, 60, 120, 1)');
    } else if (this.nivel > 0.2) {
      grad.addColorStop(0, 'rgba(255, 193, 7, 0.9)');
      grad.addColorStop(1, 'rgba(200, 120, 0, 1)');
    } else {
      grad.addColorStop(0, 'rgba(255, 61, 0, 0.9)');
      grad.addColorStop(1, 'rgba(150, 0, 0, 1)');
    }
    
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.moveTo(0, yAgua);
    this.ctx.lineTo(0, this.height);
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(this.width, yAgua);
    this.ctx.arc(this.width/2, this.height, this.width/2, 0, Math.PI);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.fillStyle = 'rgba(0, 40, 100, 0.4)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, yAgua);
    this.ctx.lineTo(0, this.height);
    this.ctx.lineTo(this.width * 0.3, this.height);
    this.ctx.lineTo(this.width * 0.3, yAgua);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  desenharOnda(yAgua) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    for (let x = 0; x <= this.width; x += 2) {
      let y = yAgua;
      this.ondas.forEach(onda => {
        y += Math.sin(x * onda.frequency + this.time * onda.speed + onda.phase) * onda.amplitude * this.nivel;
      });
      
      const distanciaBorda = Math.min(x, this.width - x);
      const fatorMenisco = Math.max(0, 1 - distanciaBorda / 40);
      y -= fatorMenisco * 12;
      
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    
    this.ctx.stroke();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineTo(this.width, yAgua + 15);
    this.ctx.lineTo(0, yAgua + 15);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  desenharParticulas(yAgua) {
    if (Math.random() < 0.15 && this.nivel > 0.1) {
      this.particulas.push({
        x: 30 + Math.random() * 140,
        y: this.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -2 - Math.random() * 1.5,
        size: 2 + Math.random() * 3,
        alpha: 1,
        life: 100
      });
    }
    
    this.particulas = this.particulas.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.life--;
      p.alpha = p.life / 100;
      
      if (p.y > yAgua && p.y < this.height) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.8})`;
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(p.x - p.size/3, p.y - p.size/3, p.size/2, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        this.ctx.fill();
      }
      
      return p.life > 0 && p.y < this.height + 20;
    });
  }
  
  desenharReflexo(yAgua) {
    const grad = this.ctx.createLinearGradient(0, yAgua - 10, 0, yAgua + 10);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, yAgua - 10, this.width, 20);
  }
}

// ======================= INIT =======================
document.addEventListener("DOMContentLoaded", init);

function init() {
    console.log("%c HAG Dashboard v3.0 - Sistema Iniciado", "color: #00e5ff; font-weight: bold; font-size: 14px;");
    fallbackHTTP();
    conectarWS();
    setInterval(fallbackHTTP, 8000);
    iniciarMonitoramentoSinal();
}

// ======================= MONITORAMENTO DE SINAL =======================
function iniciarMonitoramentoSinal() {
    setInterval(() => {
        const tempoSemSinal = Date.now() - ultimoDado;
        if (tempoSemSinal > 15000) {
            setStatus("🟡 Aguardando sinal do Gateway...", "warning");
            document.body.classList.add("sem-sinal");
            atualizarStatusVisual("Sem sinal");
        } else {
            document.body.classList.remove("sem-sinal");
            if (ws && ws.readyState === WebSocket.OPEN) {
                atualizarStatusVisual("Tempo real conectado");
            }
        }
    }, 5000);
}

// ======================= PROCESSAMENTO DE DADOS =======================
function processarPayload(payload) {
    if (!payload) return;
    if (payload.type === "update" && payload.dados) {
        payload = payload.dados;
    }
    ultimoDado = Date.now();
    scheduleRender(payload);
}

// ======================= RENDER OTIMIZADO COM RAF =======================
function scheduleRender(data) {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
        atualizarUI(data);
        renderPending = false;
    });
}

function atualizarUI(data) {
    if (!data) return;
    const elHora = document.getElementById("hora");
    if (elHora) elHora.innerText = data.lastUpdate || "--:--";
    renderReservatorios(data.reservatorios || []);
    renderBombas(data.bombas || []);
    renderPressoes(data.pressoes || []);
    atualizarKPIs(data);
}

// ======================= RESERVATÓRIOS CANVAS =======================
function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor}`;
        let el = cacheDados.get(id);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card reservatorio";
            el.innerHTML = `
                <h2>${r.nome}</h2>
                <div class="tanque">
                  <canvas class="canvas-agua"></canvas>
                  <div class="escala">
                      <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                  </div>
                </div>
                <div class="info">
                    <div class="valor">0%</div>
                    <div class="litros">0 L</div>
                </div>
            `;
            area.appendChild(el);
            cacheDados.set(id, el);
            
            const canvas = el.querySelector('.canvas-agua');
            el.canvasAgua = new AguaCanvas(canvas);
        }

        const valor = el.querySelector(".valor");
        const litros = el.querySelector(".litros");
        const nivel = Math.min(100, Math.max(0, Number(r.percent) || 0));
        const nivelSuavizado = Math.round(nivel * 10) / 10;

        if (el.canvasAgua) {
          el.canvasAgua.setNivel(nivelSuavizado);
        }

        el.classList.toggle("alerta", nivel < 20);
        valor.innerText = `${nivelSuavizado.toFixed(1)}%`;
        litros.innerText = `${formatar(r.current_liters)} L`;
    });
}

// ======================= BOMBAS =======================
function renderBombas(lista) {
    const area = document.getElementById("areaBombas");
    if (!area) return;

    lista.forEach((b, i) => {
        const id = `bomba-${i}`;
        let el = cacheDados.get(id);
        const ligada = b.estado === "ligada";
        const desconhecido = b.estado === "desconhecido" || b.estado === undefined;

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card bomba";
            el.innerHTML = `<h2></h2><div class="status-icon"></div><div class="valor"></div><div class="ciclos"></div>`;
            area.appendChild(el);
            cacheDados.set(id, el);
        }

        el.className = `card bomba ${desconhecido ? "stale" : ligada ? "ligada" : "desligada"}`;
        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".status-icon").innerText = desconhecido ? "⚪" : ligada ? "🟢" : "🔴";
        el.querySelector(".valor").innerText = desconhecido ? "SEM DADOS" : ligada ? "EM OPERAÇÃO" : "INATIVA";
        el.querySelector(".ciclos").innerText = `${formatar(b.ciclo || 0)} ciclos`;
    });
}

// ======================= PRESSÕES =======================
function renderPressoes(lista) {
    const area = document.getElementById("areaPressoes");
    if (!area) return;

    lista.forEach((p, i) => {
        const id = `pressao-${i}`;
        let el = cacheDados.get(id);

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = "card";
            el.innerHTML = `<h2></h2><div class="valor-pressao"></div>`;
            area.appendChild(el);
            cacheDados.set(id, el);
        }

         pressao = Number(p.pressao || 0).toFixed(2);
        el.querySelector("h2").innerText = p.nome;
        el.querySelector(".valor-pressao").innerText = `${pressao} bar`;
    });
}

// ======================= KPIs =======================
function atualizarKPIs(data) {
    const kpis = data.kpis || {};
    const elementos = {
        kpiCritico: (data.reservatorios || []).filter(r => r.percent < 30).length,
        bombasAtivas: (data.bombas || []).filter(b => b.estado === "ligada").length,
        kpiElevador: `${formatar(kpis.elevador_hoje || 0)} L`,
        kpiLavanderia: `${formatar(kpis.lavanderia_hoje || 0)} L`,
        kpiOsmose: `${formatar(kpis.osmose_hoje || 0)} L`
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = valor;
    });
}

// ======================= WEBSOCKET COM RECONEXÃO EXPONENCIAL =======================
function conectarWS() {
    if (ws) ws.close();
    
    const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocolo}//${location.host}`);
    
    ws.onopen = () => {
        console.log("%c🟢 WebSocket conectado", "color: #00ff88; font-weight: bold;");
        setStatus("🟢 Tempo real conectado", "success");
        atualizarStatusVisual("Tempo real conectado");
        reconnectDelay = 3000; // Reset delay
    };

    ws.onmessage = (msg) => { 
        try { 
            processarPayload(JSON.parse(msg.data)); 
        } catch (e) { 
            console.error("Erro ao processar mensagem WS:", e); 
        } 
    };

    ws.onclose = () => { 
        console.log("%c🔴 WebSocket desconectado", "color: #ff3d00; font-weight: bold;");
        setStatus("🔴 Reconectando...", "error"); 
        atualizarStatusVisual("Reconectando...");
        setTimeout(conectarWS, reconnectDelay); 
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay); // Backoff exponencial
    };

    ws.onerror = (err) => {
        console.error("Erro WebSocket:", err);
    };
}

// ======================= FALLBACK HTTP =======================
async function fallbackHTTP() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(API + "?t=" + Date.now(), {
            cache: "no-store",
            signal: controller.signal,
            headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        processarPayload(data);
    } catch (err) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            setStatus("🔴 Erro de comunicação", "error");
            atualizarStatusVisual("Desconectado");
        }
    }
}

// ======================= HELPERS =======================
function setStatus(txt, tipo = "info") {
    const el = document.getElementById("statusSistema");
    if (!el) return;
    el.innerText = txt;
    el.className = `status-${tipo}`;
}

function atualizarStatusVisual(texto) {
    const el = document.getElementById("statusTexto");
    const dot = document.querySelector(".status-dot");
    if (!el || !dot) return;
    
    el.innerText = texto;
    
    if (texto.includes("Tempo real")) {
        dot.style.background = "#00ff88";
        dot.style.boxShadow = "0 0 12px #00ff88, 0 0 24px rgba(0,255,136,0.4)";
    } else if (texto.includes("Reconectando")) {
        dot.style.background = "#ffd600";
        dot.style.boxShadow = "0 0 12px #ffd600, 0 0 24px rgba(255,214,0,0.4)";
    } else {
        dot.style.background = "#ff3d00";
        dot.style.boxShadow = "0 0 12px #ff3d00, 0 0 24px rgba(255,61,0,0.4)";
    }
}

function formatar(n) { 
    return Number(n || 0).toLocaleString("pt-BR", { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
    }); 
}

// ======================= TRATAMENTO DE ERRO GLOBAL =======================
window.addEventListener("error", (e) => {
    console.error("Erro não tratado:", e.error);
});

window.addEventListener("unhandledrejection", (e) => {
    console.error("Promise rejeitada:", e.reason);
});
 
</script>
</body>
</html>
