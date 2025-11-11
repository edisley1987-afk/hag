// login.js
const API_URL = window.location.origin;

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const erro = document.getElementById("loginError");
  erro.textContent = "";

  if (!username || !password) {
    erro.textContent = "Preencha todos os campos.";
    return;
  }

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      erro.textContent = "Usuário ou senha inválidos.";
      return;
    }

    const data = await res.json();
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("authUser", username);
    window.location.href = "dashboard.html";
  } catch {
    erro.textContent = "Erro ao conectar ao servidor.";
  }
});
