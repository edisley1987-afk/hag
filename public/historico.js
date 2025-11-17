// ======================================================
//  HISTÓRICO — CORRIGIDO
// ======================================================

// Carregar lista de reservatórios para o <select>
async function carregarListaReservatorios() {
    try {
        const resp = await fetch("/lista");
        const lista = await resp.json();

        const select = document.getElementById("selectReservatorio");
        select.innerHTML = ""; // limpar

        if (!lista.length) {
            select.innerHTML = "<option value=''>Nenhum reservatório encontrado</option>";
            return;
        }

        lista.forEach(item => {
            // Ex.: "Reservatorio_Elevador_current" → "Reservatório Elevador"
            const nomeFormatado = item
                .replace("Reservatorio_", "")
                .replace("_current", "")
                .replace(/_/g, " ");

            const opt = document.createElement("option");
            opt.value = item;
            opt.textContent = nomeFormatado;
            select.appendChild(opt);
        });

        // carregar primeiro automaticamente
        carregarHistorico(select.value);

        select.addEventListener("change", () => {
            carregarHistorico(select.value);
        });

    } catch (e) {
        console.error("Erro ao carregar lista de reservatórios:", e);
    }
}

// ======================================================
// CARREGAR HISTÓRICO SELECIONADO
// ======================================================
async function carregarHistorico(nomeCampo) {
    try {
        const resp = await fetch("/historico");
        const dados = await resp.json();

        const filtrado = dados.filter(reg => reg[nomeCampo] !== undefined);

        atualizarTabela(filtrado);
        atualizarGrafico(filtrado, nomeCampo);

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
    }
}

// ======================================================
// ATUALIZAR TABELA
// ======================================================
function atualizarTabela(lista) {
    const tbody = document.querySelector("#tabelaHistorico tbody");
    tbody.innerHTML = "";

    if (!lista.length) {
        tbody.innerHTML = "<tr><td colspan='3'>Nenhum dado encontrado</td></tr>";
        return;
    }

    lista.forEach(reg => {
        const tr = document.createElement("tr");

        const data = new Date(reg.timestamp).toLocaleString("pt-BR");
        const litros = reg.valor ?? reg.Reservatorio_Elevador_current ??
            reg.Reservatorio_Osmose_current ??
            reg.Reservatorio_Agua_Abrandada_current ??
            reg.Reservatorio_CME_current ?? 0;

        const porcentagem = reg.porcentagem ?? "—";

        tr.innerHTML = `
            <td>${data}</td>
            <td>${litros}</td>
            <td>${porcentagem}</td>
        `;

        tbody.appendChild(tr);
    });
}

// ======================================================
// GRÁFICO
// ======================================================
let grafico;

function atualizarGrafico(lista, campo) {
    const ctx = document.getElementById("graficoHistorico").getContext("2d");

    if (grafico instanceof Chart) grafico.destroy();

    const labels = lista.map(reg => new Date(reg.timestamp).toLocaleString("pt-BR"));
    const valores = lista.map(reg => reg[campo]);

    grafico = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: campo.replace(/Reservatorio_|_current/g, "").replace(/_/g, " "),
                data: valores,
                borderColor: "#2c8b7d",
                backgroundColor: "rgba(44,139,125,0.3)",
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "top" }
            }
        }
    });
}

// ======================================================
// Inicializar ao carregar a página
// ======================================================
window.addEventListener("load", carregarListaReservatorios);
