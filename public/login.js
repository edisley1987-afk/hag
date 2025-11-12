// === login.js ===
// Autenticação simples com token localStorage

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();
  const erro = document.getElementById("erro");

  erro.textContent = "";

  try {
    const res = await fetch(window.location.origin + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, senha }),
    });

    const data = await res.json();

    if (!res.ok) {
      erro.textContent = data?.erro || "Usuário ou senha incorretos.";
      return;
    }

    // Armazena token e redireciona para o dashboard
    localStorage.setItem("authToken", data.token);
    window.location.href = "index.html";
  } catch (err) {
    erro.textContent = "Erro de conexão. Tente novamente.";
    console.error(err);
  }
});
