import Login from "./Login";

function App() {
  function handleLoginSuccess(user) {
    alert("Login realizado com sucesso! Bem-vindo(a), " + user.email);
  }

  return <Login onLoginSuccess={handleLoginSuccess} />;
}

export default App;
