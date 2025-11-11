// historico.js
const API_URL = window.location.origin;

async function carregarHistorico() {
  const token = localStorage.getItem("authToken");
  const res = await fetch(`${API_URL}/historico`, {
    headers: { Authorization: token },
  });

  if (res.status === 401) {
    alert("Sessão expirada. Faça login novamente.");
    localStorage.clear();
    window.location.href = "login.html";
    return;
  }

  const historico = await res.json();
  const tbody = document.querySelector("#tabela-historico tbody");
  tbody.innerHTML = "";

  Object.entries(historico).forEach(([data, sensores]) => {
    Object.entries(sensores).forEach(([nome, { min, max }]) => {
      const linha = document.createElement("tr");

      // Corrigir exibição de pressões em bar
      const isPressao = nome.toLowerCase().includes("pressao");
      const minFmt = isPressao ? min.toFixed(3) + " bar" : min + " L";
      const maxFmt = isPressao ? max.toFixed(3) + " bar" : max + " L";

      linha.innerHTML = `
        <td>${data}</td>
        <td>${nome.replaceAll("_current", "").replaceAll("_", " ")}</td>
        <td>${minFmt}</td>
        <td>${maxFmt}</td>
      `;
      tbody.appendChild(linha);
    });
  });
}

window.addEventListener("DOMContentLoaded", carregarHistorico);
