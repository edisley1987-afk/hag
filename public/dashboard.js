// === dashboard.js ===
card.classList.add('sem-dados');
return;
}


const perc = Math.round(Math.max(0, Math.min(100, (valor / cfg.capacidade) * 100)));
percentEl.textContent = perc + '%';
litersEl.textContent = valor.toLocaleString() + ' L';
if(nivelInterno) {
nivelInterno.style.height = perc + '%';
// cor do preenchimento conforme nível
if(perc < 30) nivelInterno.style.background = 'linear-gradient(to top, #e74c3c, #ff8c00)';
else if(perc < 70) nivelInterno.style.background = 'linear-gradient(to top, #f1c40f, #f39c12)';
else nivelInterno.style.background = 'linear-gradient(to top, #3498db, #2ecc71)';
}


// define status para borda
if(perc < 30) card.dataset.status = 'baixo';
else if(perc < 70) card.dataset.status = 'medio';
else card.dataset.status = 'alto';


card.classList.remove('sem-dados');
});


// Atualiza pressões
Object.keys(PRESSOES).forEach(key => {
const card = document.getElementById(key);
if(!card) return;
const el = card.querySelector('.percent');
const v = dados[key];
if(typeof v !== 'number' || isNaN(v)) el.textContent = '-- bar';
else el.textContent = v.toFixed(2) + ' bar';
});


// Atualiza texto última atualização
const last = document.getElementById('lastUpdate');
if(last){
const dt = new Date(dados.timestamp || Date.now());
last.textContent = 'Última atualização: ' + dt.toLocaleString('pt-BR');
}


}catch(err){
console.error('Erro ao buscar leituras:', err);
}
}


// Exibe 0% após tempo sem atualizações (fallback visual)
setInterval(()=>{
const diff = Date.now() - ultimaLeitura;
if(diff > 4 * 60 * 1000){ // 4 minutos sem dados → mostra sem-dados
document.querySelectorAll('.card').forEach(c=>{
if(c.classList.contains('pressao')) return;
c.querySelector('.percent').textContent = '--%';
const lit = c.querySelector('.liters'); if(lit) lit.textContent = '-- L';
const n = c.querySelector('.nivelInterno'); if(n) n.style.height = '0%';
c.classList.add('sem-dados');
});
}
}, 10000);


// Inicialização
window.addEventListener('DOMContentLoaded', ()=>{
criarCards();
atualizarLeituras();
setInterval(atualizarLeituras, UPDATE_INTERVAL);
});


// Abrir histórico (global)
window.abrirHistorico = function(reservatorioId){
window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
