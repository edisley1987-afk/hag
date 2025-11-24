// =============================
// dashboard.js — COMPLETO
// =============================

// URL da API do servidor
const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000; // 5s
let ultimaLeitura = 0;


// -----------------------------
// CONFIGURAÇÃO DOS RESERVATÓRIOS
// -----------------------------
const RESERVATORIOS = {
    Reservatorio_Elevador_current: { nome: "Reservatório Elevador", capacidade: 20000 },
    Reservatorio_Osmose_current:   { nome: "Reservatório Osmose",   capacidade: 200 },
    Reservatorio_CME_current:      { nome: "Reservatório CME",      capacidade: 1000 },
    Abrandada_current:             { nome: "Água Abrandada",        capacidade: 9000 }
};


// -----------------------------
// CONFIGURAÇÃO DAS PRESSÕES
// -----------------------------
const PRESSOES = {
    Pressao_Saida_Osmose_current:  "Pressão Saída Osmose",
    Pressao_Retorno_Osmose_current:"Pressão Retorno Osmose",
    Pressao_Saida_CME_current:     "Pressão Saída CME"
};


// =============================
// CRIAÇÃO DOS CARDS DINÂMICOS
// =============================
function criarCards() {
    const container = document.getElementById("cardsContainer");
    container.innerHTML = "";

    // --- RESERVATÓRIOS ---
    Object.keys(RESERVATORIOS).forEach(id => {
        const cfg = RESERVATORIOS[id];

        const card = document.createElement("div");
        card.className = "card reservatorio";
        card.id = id;

        card.innerHTML = `
            <div class="nivel">
                <div class="nivelInterno"></div>
            </div>

            <h3>${cfg.nome}</h3>
            <p class="percent">--%</p>
            <p class="liters">-- L</p>

            <button onclick="abrirHistorico('${id.replace('_current','')}')" class="btn-hist">
                Ver Histórico
            </button>
        `;

        container.appendChild(card);
    });

    // --- PRESSÕES ---
    Object.keys(PRESSOES).forEach(id => {
        const nome = PRESSOES[id];

        const card = document.createElement("div");
        card.className = "card pressao";
        card.id = id;

        card.innerHTML = `
            <h3>${nome}</h3>
            <p class="percent">-- bar</p>
        `;

        container.appendChild(card);
    });
}


// =============================
// ATUALIZAÇÃO DAS LEITURAS
// =============================
async function atualizarLeituras() {
    try {
        const resposta = await fetch(API_URL);
        const dados = await resposta.json();

        if (!dados) return;

        ultimaLeitura = Date.now();

        // Atualiza reservatórios
        Object.keys(RESERVATORIOS).forEach(key => {
            const cfg = RESERVATORIOS[key];
            const card = document.getElementById(key);

            if (!card) return;

            const valor = dados[key];   // servidor envia *_current
            const percentEl = card.querySelector(".percent");
            const litersEl = card.querySelector(".liters");
            const nivelInterno = card.querySelector(".nivelInterno");

            if (typeof valor !== "number" || isNaN(valor)) {
                percentEl.textContent = "--%";
                litersEl.textContent = "-- L";
                nivelInterno.style.height = "0%";
                card.classList.add("sem-dados");
                return;
            }

            const perc = Math.round(Math.max(0, Math.min(100, (valor / cfg.capacidade) * 100)));

            percentEl.textContent = perc + "%";
            litersEl.textContent = valor.toLocaleString("pt-BR") + " L";
            nivelInterno.style.height = perc + "%";

            // Cores progressivas
            if (perc < 30)
                nivelInterno.style.background = "linear-gradient(to top, #e74c3c, #ff8c00)";
            else if (perc < 70)
                nivelInterno.style.background = "linear-gradient(to top, #f1c40f, #f39c12)";
            else
                nivelInterno.style.background = "linear-gradient(to top, #3498db, #2ecc71)";

            // Status
            if (perc < 30) card.dataset.status = "baixo";
            else if (perc < 70) card.dataset.status = "medio";
            else card.dataset.status = "alto";

            card.classList.remove("sem-dados");
        });

        // Atualiza pressões
        Object.keys(PRESSOES).forEach(key => {
            const card = document.getElementById(key);
            if (!card) return;

            const el = card.querySelector(".percent");
            const v = dados[key];

            if (typeof v !== "number" || isNaN(v))
                el.textContent = "-- bar";
            else
                el.textContent = v.toFixed(2) + " bar";
        });

        // Última atualização
        const last = document.getElementById("lastUpdate");
        if (last) {
            const dt = new Date(dados.timestamp || Date.now());
            last.textContent = "Última atualização: " + dt.toLocaleString("pt-BR");
        }

    } catch (err) {
        console.error("Erro ao buscar leituras:", err);
    }
}


// =============================
// FALLBACK — SEM ATUALIZAÇÃO
// =============================
setInterval(() => {
    const diff = Date.now() - ultimaLeitura;

    // Se passaram 4 minutos sem dados → mostrar "--"
    if (diff > 4 * 60 * 1000) {
        document.querySelectorAll(".card.reservatorio").forEach(c => {
            c.querySelector(".percent").textContent = "--%";
            c.querySelector(".liters").textContent = "-- L";
            c.querySelector(".nivelInterno").style.height = "0%";
            c.classList.add("sem-dados");
        });
    }
}, 10000);


// =============================
// INICIALIZAÇÃO
// =============================
window.addEventListener("DOMContentLoaded", () => {
    criarCards();
    atualizarLeituras();
    setInterval(atualizarLeituras, UPDATE_INTERVAL);
});


// =============================
// ABRIR HISTÓRICO
// =============================
window.abrirHistorico = function (reservatorioId) {
    window.location.href = `historico.html?reservatorio=${reservatorioId}`;
};
