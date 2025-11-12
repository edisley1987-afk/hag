// login.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({message:"Erro"}));
        alert(err.message || "Usuário ou senha inválidos");
        return;
      }
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("user", data.user);
        window.location.href = "/dashboard.html";
      } else {
        alert("Usuário ou senha inválidos");
      }
    } catch (err) {
      console.error("Erro no login:", err);
      alert("Erro ao conectar com o servidor.");
    }
  });
});
