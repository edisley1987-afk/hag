/**
 * =========================================================
 * HAG SCADA V6.1 - HARDENED REAL (PRODUÇÃO)
 * =========================================================
 */

import express from "express";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import cors from "cors";
import compression from "compression";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import http from "http";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.API_TOKEN || "HAG_SECURE_123";

const DATA_DIR = path.join(__dirname, "data");

const FILES = {
  DATA: path.join(DATA_DIR, "readings.json"),
  HIST: path.join(DATA_DIR, "historico.json"),
  ALERTA: path.join(DATA_DIR, "alerta.json"),
  AUDIT: path.join(DATA_DIR, "audit.log"),
  CONSUMO: path.join(DATA_DIR, "consumo_state.json")
};

const DATA_TIMEOUT = 120000;
const MAX_ITEMS = 200;
const BODY_LIMIT = "200kb";

const BOMBA_ON_DELAY = 3000;
const BOMBA_OFF_DELAY = 5000;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ================= IO =================
async function read(file, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function write(file, data) {
  try {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erro escrita:", e.message);
  }
}

// ================= AUDIT =================
async function audit(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    await fs.appendFile(FILES.AUDIT, line);

    const stat = await fs.stat(FILES.AUDIT).catch(() => null);
    if (stat && stat.size > 1024 * 1024) {
      try {
        await fs.rename(FILES.AUDIT, FILES.AUDIT + ".old");
      } catch {
        // fallback se estiver em uso
        await fs.writeFile(FILES.AUDIT, "");
      }
    }
  } catch {}
}

// ================= SENSORES =================
const SENSORES = await read(
  path.join(DATA_DIR, "sensores.json"),
  {
    Reservatorio_Elevador_current:{ leituraVazio:0.00517, leituraCheio:0.010247, capacidade:20000, altura:1.45 },
    Reservatorio_Osmose_current:{ leituraVazio:0.00505, leituraCheio:0.006973, capacidade:200, altura:1 },
    Reservatorio_CME_current:{ leituraVazio:0.004088, leituraCheio:0.00537, capacidade:1000, altura:0.45 },
    Reservatorio_Agua_Abrandada_current:{ leituraVazio:0.004048, leituraCheio:0.004929, capacidade:9000, altura:0.6 },
    Reservatorio_lavanderia_current:{ leituraVazio:0.006012, leituraCheio:0.011623, capacidade:10000, altura:1.45 },

    Pressao_Saida_Osmose_current:{ tipo:"pressao" },
    Pressao_Retorno_Osmose_current:{ tipo:"pressao" },
    Pressao_Saida_CME_current:{ tipo:"pressao" },

    Bomba_01_binary:{ tipo:"bomba" },
    Ciclos_Bomba_01_counter:{ tipo:"ciclo" },
    Bomba_02_binary:{ tipo:"bomba" },
    Ciclos_Bomba_02_counter:{ tipo:"ciclo" },
    Bomba_Osmose_binary:{ tipo:"bomba" },
    Ciclos_Bomba_Osmose_counter:{ tipo:"ciclo" }
  }
);

// ================= MEM =================
const MEM = {};
const MEM_BOMBA = {};

// ================= CONSUMO PERSISTENTE =================
let CONSUMO_STATE = await read(FILES.CONSUMO, {
  ultimoNivel: null,
  ultimoTs: 0
});

// ================= WS =================
const wss = new WebSocketServer({ server });
const clients = new Set();
const lastType = {};

wss.on("connection", ws=>{
  clients.add(ws);
  ws.on("close", ()=>clients.delete(ws));
});

function broadcast(type, data){
  const now = Date.now();
  if(now - (lastType[type]||0) < 200) return;

  lastType[type] = now;
  const msg = JSON.stringify({type,...data});

  clients.forEach(c=>{
    try{
      if(c.readyState===1) c.send(msg);
    }catch{
      clients.delete(c);
    }
  });
}

// ================= AUTH =================
function auth(req,res,next){
  if(req.headers["x-api-key"] !== TOKEN){
    return res.status(401).json({erro:"unauthorized"});
  }
  next();
}

// ================= PAYLOAD =================
function normalize(body){
  let arr = [];

  if(body?.data && Array.isArray(body.data)){
    arr = body.data;
  } else if(typeof body === "object"){
    arr = Object.entries(body).map(([k,v])=>({ref:k,value:v}));
  }

  return arr.slice(0, MAX_ITEMS).map(i=>({
    ref:i.ref || i.key,
    value:i.value,
    time:i.time || Date.now()
  }));
}

// ================= NIVEL =================
function calcNivel(ref, val){
  const s = SENSORES[ref];
  if(!s?.capacidade) return {p:0,l:0,h:0};

  let p = (val - s.leituraVazio)/(s.leituraCheio - s.leituraVazio);
  p = Math.max(0,Math.min(1,p));

  if(MEM[ref]===undefined) MEM[ref]=p;

  let f = MEM[ref]*0.85 + p*0.15;
  if(Math.abs(f-MEM[ref]) < 0.01) f = MEM[ref];

  MEM[ref]=f;

  return {
    p:f,
    l:Math.round(f*s.capacidade),
    h:Math.round(f*s.altura*100)
  };
}

// ================= BOMBA =================
function procBomba(ref,val,db){
  const anterior = db[ref] ?? val;
  const ts = db[ref+"_ts"] ? new Date(db[ref+"_ts"]).getTime() : 0;
  const agora = Date.now();

  if(!MEM_BOMBA[ref]) MEM_BOMBA[ref]=anterior;

  if(val !== anterior){
    const delay = val ? BOMBA_ON_DELAY : BOMBA_OFF_DELAY;
    if(agora - ts > delay){
      MEM_BOMBA[ref] = val;
      audit(`BOMBA ${ref} -> ${val}`);
    }
  }

  return MEM_BOMBA[ref];
}

// ================= PROCESSAMENTO =================
async function processar(arr){
  const db = await read(FILES.DATA);

  for(const item of arr){
    const ref = item.ref;
    let val = Number(item.value)||0;

    const tsAtual = new Date(item.time).getTime();
    const tsOld = db[ref+"_ts"] ? new Date(db[ref+"_ts"]).getTime() : 0;

    if(tsAtual < tsOld) continue;

    const tipo = SENSORES[ref]?.tipo;

    if(tipo === "pressao"){
      val = ((val - 0.004)/0.016)*20;
    }

    if(tipo === "bomba"){
      val = procBomba(ref,val,db);
    }

    const nivel = calcNivel(ref,val);

    db[ref] = val;
    db[ref+"_percent"] = nivel.p;
    db[ref+"_litros"] = nivel.l;
    db[ref+"_altura"] = nivel.h;
    db[ref+"_ts"] = new Date().toISOString();
  }

  // FAIL SAFE
  const agora = Date.now();
  Object.keys(db).forEach(k=>{
    if(k.endsWith("_ts")){
      const ref = k.replace("_ts","");
      const ts = new Date(db[k]).getTime();
      db[ref+"_stale"] = (agora - ts > DATA_TIMEOUT);
    }
  });

  db.timestamp = new Date().toISOString();

  await write(FILES.DATA, db);
  return db;
}

// ================= CONSUMO =================
async function consumo(db){
  const atual = db["Reservatorio_Osmose_current"];
  const agora = Date.now();

  if(CONSUMO_STATE.ultimoNivel === null){
    CONSUMO_STATE.ultimoNivel = atual;
    CONSUMO_STATE.ultimoTs = agora;
    await write(FILES.CONSUMO, CONSUMO_STATE);
    return {consumo:0, media:0};
  }

  const delta = CONSUMO_STATE.ultimoNivel - atual;
  const dt = (agora - CONSUMO_STATE.ultimoTs)/1000;

  let consumo = 0;
  if(dt > 2 && delta > 0){
    consumo = delta;
  }

  CONSUMO_STATE.ultimoNivel = atual;
  CONSUMO_STATE.ultimoTs = agora;

  await write(FILES.CONSUMO, CONSUMO_STATE);

  const hist = await read(FILES.HIST,{lista:[]});
  hist.lista.push(consumo);
  if(hist.lista.length > 60) hist.lista.shift();

  const media = hist.lista.reduce((a,b)=>a+b,0)/hist.lista.length;

  await write(FILES.HIST,hist);

  return {consumo,media};
}

// ================= ALERTAS =================
async function gerarAlertas(db,cons,media){
  const lista = [];

  if(media>0 && cons > media*2.5){
    lista.push("Consumo anormal");
  }

  if(db["Reservatorio_Osmose_current_percent"] >= 0.99){
    lista.push("Osmose cheia - bomba OFF");
    db["Bomba_Osmose_binary"] = 0;
  }

  Object.keys(db).forEach(k=>{
    if(k.endsWith("_stale") && db[k]){
      lista.push(`Sensor offline: ${k.replace("_stale","")}`);
    }
  });

  await write(FILES.ALERTA,{lista,ts:new Date().toISOString()});
  return lista;
}

// ================= ROUTES =================
app.use(cors());
app.use(compression());
app.use(express.json({limit: BODY_LIMIT}));

app.post("/iot", auth, async (req,res)=>{
  try{
    const arr = normalize(req.body);

    if(!arr.length){
      return res.status(400).json({erro:"payload vazio"});
    }

    const db = await processar(arr);
    const {consumo:cons, media} = await consumo(db);
    const lista = await gerarAlertas(db,cons,media);

    broadcast("update",{dados:db});
    if(lista.length) broadcast("alert",{lista});

    res.json({ok:true});

  }catch(e){
    res.status(500).json({erro:e.message});
  }
});

// ================= START =================
server.listen(PORT, ()=>{
  console.log(chalk.green(`🚀 SCADA V6.1 ONLINE ${PORT}`));
});
