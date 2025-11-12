document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const msg = document.getElementById("errorMsg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        msg.textContent = "Usuário ou senha inválidos.";
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      window.location.href = "dashboard.html";
    } catch (err) {
      msg.textContent = "Erro de conexão com o servidor.";
      console.error(err);
    }
  });
});
