// ===== dashboard.js COMPLETO =====

const API_URL = window.location.origin + "/dados";
const UPDATE_INTERVAL = 5000;

// Carrega manutenção salva
let manutencaoLocal = JSON.parse(localStorage.getItem("manutencaoReservatorios") || "{}");

// Salvar manutenção
function salvarManutencao(nome, status) {
    manutencaoLocal[nome] = status;
    localStorage.setItem("manutencaoReservatorios", JSON.stringify(manutencaoLocal));
}

// Atualiza todos os cards
async function atualizarDashboard() {
    try {
        const res = await fetch(API_URL);
        const dados = await res.json();

        atualizarTimestamp();
        atualizarReservatorios(dados);

    } catch (err) {
        console.error("Erro ao atualizar dashboard:", err);
    }
}

// Atualiza horário
function atualizarTimestamp() {
    const el = document.getElementById("ultimaAtualizacao");
    if (!el) return;

    const agora = new Date();
    el.textContent =
        agora.toLocaleDateString() + " " + agora.toLocaleTimeString();
}

// Atualiza todos os reservatórios
function atualizarReservatorios(dados) {

    dados.forEach(item => {
        const card = document.querySelector(`[data-reservatorio="${item.ref}"]`);
        if (!card) return;

        const percentEl = card.querySelector(".percentual");
        const litrosEl = card.querySelector(".litros");
        const alertaMsg = card.querySelector(".alerta-msg");
        const manutBtn = card.querySelector(".btn-manut");
        const manutStatus = card.querySelector(".status-manut");

        const capacidade = Number(card.dataset.capacidade);
        let litros = Number(item.value);
        let percent = Math.round((litros / capacidade) * 100);

        if (isNaN(litros)) litros = 0;
        if (isNaN(percent)) percent = 0;

        // Preenche valores
        percentEl.textContent = percent + "%";
        litrosEl.textContent = litros.toLocaleString("pt-BR") + " L";

        const nome = item.ref;
        const emManutencao = manutencaoLocal[nome] === true;

        // --------------------------
        // LÓGICA DE ALERTA E MANUTENÇÃO
        // --------------------------
        if (percent <= 30) {

            // Mostrar botão para marcar manutenção
            manutBtn.style.display = "block";

            if (!emManutencao) {
                // ALERTA CRÍTICO
                card.classList.add("alerta-critico");
                alertaMsg.style.display = "block";
                alertaMsg.textContent = "⚠ Nível crítico! Abaixo de 30%";
                manutStatus.style.display = "none";
            } else {
                // Em manutenção → alerta some
                card.classList.remove("alerta-critico");
                alertaMsg.style.display = "none";
                manutStatus.style.display = "block";
                manutStatus.textContent = "🔧 Em manutenção";
            }

        } else {

            // Fora da zona crítica
            card.classList.remove("alerta-critico");
            alertaMsg.style.display = "none";
            manutBtn.style.display = "none";

            // Se estava em manutenção, remove automaticamente
            if (emManutencao) {
                salvarManutencao(nome, false);
            }

            manutStatus.style.display = "none";
        }

        // Botão marcar manutenção
        manutBtn.onclick = () => {
            const novo = !emManutencao;
            salvarManutencao(nome, novo);
            atualizarDashboard();
        };
    });
}

// Intervalo de atualização
setInterval(atualizarDashboard, UPDATE_INTERVAL);
atualizarDashboard();
