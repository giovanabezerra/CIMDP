import { useState } from "react";
import { supabase } from "./supabaseClient";

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro("E-mail ou senha incorretos. Tente novamente.");
      return;
    }

    if (onLoginSuccess) {
      onLoginSuccess(data.user);
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleLogin} style={styles.form}>
        <h2 style={styles.titulo}>Painel Administrativo — CIMDP</h2>

        <label style={styles.label}>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          style={styles.input}
        />

        <label style={styles.label}>Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="********"
          required
          style={styles.input}
        />

        {erro && <p style={styles.erro}>{erro}</p>}

        <button type="submit" disabled={carregando} style={styles.botao}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#F7F7F4",
  },
  form: {
    backgroundColor: "#FFFFFF",
    padding: "2rem",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    width: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  titulo: {
    marginBottom: "1rem",
    fontSize: "1.2rem",
    color: "#2E5339",
    textAlign: "center",
  },
  label: {
    fontSize: "0.85rem",
    color: "#444",
    marginTop: "0.5rem",
  },
  input: {
    padding: "0.6rem",
    borderRadius: "8px",
    border: "1px solid #DDD",
    fontSize: "1rem",
  },
  botao: {
    marginTop: "1.2rem",
    padding: "0.7rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#2E5339",
    color: "#FFF",
    fontSize: "1rem",
    cursor: "pointer",
  },
  erro: {
    color: "#B5482F",
    fontSize: "0.85rem",
    marginTop: "0.3rem",
  },
};

export default Login;
