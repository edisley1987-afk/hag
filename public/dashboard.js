/**
 * Dashboard HAG 3D - Hospital Arnaldo Gavazza
 * Versão 4.0 - Canvas Realista + Status Dinâmico
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
    this.condensacao = []; // gotas de condensação
    this.time = 0;
    
    // 3 ondas sobrepostas para movimento orgânico
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
    this.time += 0.016; // 60fps
    this.nivel += (this.nivelTarget - this.nivel) * 0.08; // Suavização com inércia
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    const yAgua = this.height * (1 - this.nivel);
    this.desenharAgua(yAgua);
    this.desenharOnda(yAgua);
    this.desenharParticulas(yAgua);
    this.desenharCondensacao();
    this.desenharReflexo(yAgua);
    
    requestAnimationFrame(() => this.animate());
  }
  
  desenharAgua(yAgua) {
    const grad = this.ctx.createLinearGradient(0, yAgua, 0, this.height);
    
    // Cor dinâmica conforme nível
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
    
    // Corpo da água com curva inferior do cilindro
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.moveTo(0, yAgua);
    this.ctx.lineTo(0, this.height);
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(this.width, yAgua);
    this.ctx.arc(this.width/2, this.height, this.width/2, 0, Math.PI);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Sombra interna pra dar profundidade
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
      
      // Soma das 3 ondas senoidais
      this.ondas.forEach(onda => {
        y += Math.sin(x * onda.frequency + this.time * onda.speed + onda.phase) * onda.amplitude * this.nivel;
      });
      
      // Menisco nas bordas - curvatura real da água
      const distanciaBorda = Math.min(x, this.width - x);
      const fatorMenisco = Math.max(0, 1 - distanciaBorda / 40);
      y -= fatorMenisco * 12;
      
      if (x === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    
    this.ctx.stroke();
    
    // Reflexo da superfície
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineTo(this.width, yAgua + 15);
    this.ctx.lineTo(0, yAgua + 15);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  desenharParticulas(yAgua) {
    // Gera bolhas quando nível sobe
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
    
    // Anima e remove bolhas
    this.particulas = this.particulas.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02; // gravidade
      p.life--;
      p.alpha = p.life / 100;
      
      if (p.y > yAgua && p.y < this.height) {
        // Bolha principal
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.8})`;
        this.ctx.fill();
        
        // Brilho da bolha
        this.ctx.beginPath();
        this.ctx.arc(p.x - p.size/3, p.y - p.size/3, p.size/2, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        this.ctx.fill();
      }
      
      return p.life > 0 && p.y < this.height + 20;
    });
  }
  
  desenharCondensacao() {
    // Gera nova gota quando reservatório está cheio
    if (this.nivel > 0.65 && Math.random() < 0.3) {
      this.condensacao.push({
        x: 15 + Math.random() * 170,
        y: Math.random() * this.height * 0.4,
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.3,
        life: 200
      });
    }
    
    // Anima e remove gotas
    this.condensacao = this.condensacao.filter(gota => {
      gota.life--;
      gota.alpha = gota.life / 200;
      gota.y += 0.3; // gota escorrendo
      
      if (gota.y < this.height * 0.8) {
        this.ctx.beginPath();
        this.ctx.arc(gota.x, gota.y, gota.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(180, 220, 255, ${gota.alpha})`;
        this.ctx.fill();
      }
      
      return gota.life > 0 && gota.y < this.height * 0.9;
    });
  }
  
  desenharReflexo(yAgua) {
    // Reflexo especular na superfície
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
    console.log("%c HAG Dashboard v4.0 - Sistema Iniciado", "color: #00e5ff; font-weight: bold; font-size: 14px;");
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

// ======================= RESERVATÓRIOS CANVAS COM COR DINÂMICA =======================
function renderReservatorios(lista) {
    const area = document.getElementById("areaReservatorios");
    if (!area) return;

    lista.forEach(r => {
        const id = `res-${r.setor}`;
        let el = cacheDados.get(id);
        const nivel = Math.min(100, Math.max(0, Number(r.percent) || 0));
        const nivelSuavizado = Math.round(nivel * 10) / 10;

        // Define cor e status baseado no nível
        let statusClass, statusText;
        if (nivel >= 70) {
            statusClass = 'status-ok';
            statusText = 'Normal';
        } else if (nivel >= 30) {
            statusClass = 'status-warning'; 
            statusText = 'Atenção';
        } else {
            statusClass = 'status-danger';
            statusText = 'Crítico';
        }

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = `card reservatorio ${statusClass}`;
            el.innerHTML = `
                <div class="card-header">
                  <h2 class="card-title">${r.nome}</h2>
                  <div class="card-status ${statusClass}">${statusText}</div>
                </div>
                <div class="card-content">
                  <div class="tanque-container">
                    <div class="tanque">
                      <canvas class="canvas-agua"></canvas>
                      <div class="escala">
                          <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                      </div>
                    </div>
                    <div class="nivel-info">
                        <div class="nivel-valor">${nivelSuavizado.toFixed(1)}%</div>
                        <div class="nivel-litros">${formatar(r.current_liters)} L</div>
                    </div>
                  </div>
                </div>
            `;
            area.appendChild(el);
            cacheDados.set(id, el);
            
            // Inicializa Canvas
            const canvas = el.querySelector('.canvas-agua');
            el.canvasAgua = new AguaCanvas(canvas);
        } else {
            // Atualiza classe de status do card
            el.className = `card reservatorio ${statusClass}`;
            el.querySelector('.card-status').className = `card-status ${statusClass}`;
            el.querySelector('.card-status').innerText = statusText;
            
            // Atualiza textos
            el.querySelector(".nivel-valor").innerText = `${nivelSuavizado.toFixed(1)}%`;
            el.querySelector(".nivel-litros").innerText = `${formatar(r.current_liters)} L`;
            
            // Atualiza Canvas
            if (el.canvasAgua) {
              el.canvasAgua.setNivel(nivelSuavizado);
            }
        }
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
        const statusClass = desconhecido ? "stale" : ligada ? "status-ok" : "status-danger";

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = `card bomba ${statusClass}`;
            el.innerHTML = `
              <div class="card-header">
                <h2 class="card-title"></h2>
                <div class="card-status ${statusClass}"></div>
              </div>
              <div class="card-content">
                <div class="bomba-stats">
                  <div class="valor"></div>
                  <div class="ciclos"></div>
                </div>
              </div>
            `;
            area.appendChild(el);
            cacheDados.set(id, el);
        } else {
            el.className = `card bomba ${statusClass}`;
            el.querySelector(".card-status").className = `card-status ${statusClass}`;
        }

        el.querySelector("h2").innerText = b.nome;
        el.querySelector(".card-status").innerText = desconhecido ? "SEM DADOS" : ligada ? "EM OPERAÇÃO" : "INATIVA";
        el.querySelector(".valor").innerText = `Fluxo: ${b.fluxo || 0} L/min`;
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
        const pressao = Number(p.pressao || 0);
        const statusClass = pressao >= 2.5 ? 'status-ok' : pressao >= 1.5 ? 'status-warning' : 'status-danger';

        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.className = `card ${statusClass}`;
            el.innerHTML = `
              <div class="card-header">
                <h2 class="card-title"></h2>
                <div class="card-status ${statusClass}"></div>
              </div>
            `;
            area.appendChild(el);
            cacheDados.set(id, el);
        } else {
            el.className = `card ${statusClass}`;
            el.querySelector(".card-status").className = `card-status ${statusClass}`;
        }

        el.querySelector("h2").innerText = p.nome;
        el.querySelector(".card-status").innerText = `${pressao.toFixed(2)} bar`;
    });
}

// ======================= KPIs =======================
function atualizarKPIs(data) {
    const kpis = data.kpis || {};
    const criticos = (data.reservatorios || []).filter(r => r.percent < 30).length;
    const bombasAtivas = (data.bombas || []).filter(b => b.estado === "ligada").length;
    
    const elementos = {
        kpiCritico: criticos,
        bombasAtivas: bombasAtivas,
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
        reconnectDelay = 3000;
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
        reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
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
