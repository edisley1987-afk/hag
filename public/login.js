// === login.js ===

// URL base da API
const API_URL = window.location.origin;

// Evento de envio do formulário
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Por favor, preencha usuário e senha.");
    return;
  }

  try {
    // Faz requisição ao backend
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Salva token simples (sem session lib)
      localStorage.setItem("authUser", username);
      window.location.href = "dashboard.html";
    } else {
      alert(data.message || "Usuário ou senha inválido!");
    }
  } catch (err) {
    console.error("Erro ao fazer login:", err);
    alert("Falha de conexão com o servidor.");
  }
});

// Caso já esteja logado, redireciona
if (localStorage.getItem("authUser")) {
  window.location.href = "dashboard.html";
}
