import { useState } from "react";
import Login from "./Login";
import Funcionarios from "./Funcionarios";

function App() {
  const [usuario, setUsuario] = useState(null);

  function handleLoginSuccess(user) {
    setUsuario(user);
  }

  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <Funcionarios />;
}

export default App;

