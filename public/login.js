document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value.trim();

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });

      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        alert(data.erro || "Usuário ou senha inválidos");
        return;
      }

      localStorage.setItem("authToken", data.token);
      window.location.href = "/dashboard.html";
    } catch (err) {
      console.error("Erro:", err);
      alert("Erro ao conectar ao servidor.");
    }
  });
});
