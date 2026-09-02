import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);

  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [contato, setContato] = useState("");

  const [editandoId, setEditandoId] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // ==============================
  // READ - LISTAR FUNCIONÁRIOS
  // ==============================
  async function buscarFuncionarios() {
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase
      .from("funcionarios")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setErro("Não foi possível carregar os funcionários.");
      setCarregando(false);
      return;
    }

    setFuncionarios(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    buscarFuncionarios();
  }, []);

  // ==============================
  // LIMPAR FORMULÁRIO
  // ==============================
  function limparFormulario() {
    setNome("");
    setCargo("");
    setContato("");
    setEditandoId(null);
  }

  // ==============================
  // CREATE / UPDATE
  // ==============================
  async function salvarFuncionario(e) {
    e.preventDefault();

    setErro("");
    setMensagem("");
    setSalvando(true);

    // UPDATE - EDITAR
    if (editandoId !== null) {
      const { error } = await supabase
        .from("funcionarios")
        .update({
          nome: nome,
          cargo: cargo,
          contato: contato,
        })
        .eq("id", editandoId);

      if (error) {
        console.error(error);
        setErro("Não foi possível atualizar o funcionário.");
        setSalvando(false);
        return;
      }

      setMensagem("Funcionário atualizado com sucesso!");
    }

    // CREATE - CADASTRAR
    else {
      const { error } = await supabase
        .from("funcionarios")
        .insert([
          {
            nome: nome,
            cargo: cargo,
            contato: contato,
          },
        ]);

      if (error) {
        console.error(error);
        setErro("Não foi possível cadastrar o funcionário.");
        setSalvando(false);
        return;
      }

      setMensagem("Funcionário cadastrado com sucesso!");
    }

    limparFormulario();
    await buscarFuncionarios();

    setSalvando(false);
  }

  // ==============================
  // EDITAR FUNCIONÁRIO
  // ==============================
  function editarFuncionario(funcionario) {
    setEditandoId(funcionario.id);
    setNome(funcionario.nome || "");
    setCargo(funcionario.cargo || "");
    setContato(funcionario.contato || "");

    setMensagem("");
    setErro("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ==============================
  // DELETE - EXCLUIR
  // ==============================
  async function excluirFuncionario(id) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir este funcionário?"
    );

    if (!confirmar) {
      return;
    }

    setErro("");
    setMensagem("");

    const { error } = await supabase
      .from("funcionarios")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setErro("Não foi possível excluir o funcionário.");
      return;
    }

    setMensagem("Funcionário excluído com sucesso!");

    await buscarFuncionarios();
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.titulo}>Funcionários</h1>

      {/* ==============================
          FORMULÁRIO
      ============================== */}

      <form onSubmit={salvarFuncionario} style={styles.form}>
        <h2 style={styles.subtitulo}>
          {editandoId !== null
            ? "Editar funcionário"
            : "Novo funcionário"}
        </h2>

        <label style={styles.label}>Nome</label>

        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Digite o nome"
          required
          style={styles.input}
        />

        <label style={styles.label}>Cargo</label>

        <input
          type="text"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          placeholder="Digite o cargo"
          required
          style={styles.input}
        />

        <label style={styles.label}>Contato</label>

        <input
          type="text"
          value={contato}
          onChange={(e) => setContato(e.target.value)}
          placeholder="Digite o contato"
          required
          style={styles.input}
        />

        {erro && (
          <p style={styles.erro}>
            {erro}
          </p>
        )}

        {mensagem && (
          <p style={styles.mensagem}>
            {mensagem}
          </p>
        )}

        <div style={styles.botoesForm}>
          <button
            type="submit"
            disabled={salvando}
            style={styles.botao}
          >
            {salvando
              ? "Salvando..."
              : editandoId !== null
              ? "Salvar alterações"
              : "Cadastrar funcionário"}
          </button>

          {editandoId !== null && (
            <button
              type="button"
              onClick={() => {
                limparFormulario();
                setMensagem("");
                setErro("");
              }}
              style={styles.botaoCancelar}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* ==============================
          LISTAGEM
      ============================== */}

      <div style={styles.tituloLista}>
        <h2 style={styles.subtitulo}>
          Funcionários cadastrados
        </h2>

        <button
          type="button"
          onClick={buscarFuncionarios}
          style={styles.botaoAtualizar}
        >
          Atualizar lista
        </button>
      </div>

      {carregando && (
        <p>Carregando funcionários...</p>
      )}

      {!carregando && funcionarios.length === 0 && (
        <p>Nenhum funcionário cadastrado.</p>
      )}

      {!carregando && funcionarios.length > 0 && (
        <div style={styles.tabelaContainer}>
          <table style={styles.tabela}>
            <thead>
              <tr>
                <th style={styles.celula}>ID</th>
                <th style={styles.celula}>Nome</th>
                <th style={styles.celula}>Cargo</th>
                <th style={styles.celula}>Contato</th>
                <th style={styles.celula}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {funcionarios.map((funcionario) => (
                <tr key={funcionario.id}>
                  <td style={styles.celula}>
                    {funcionario.id}
                  </td>

                  <td style={styles.celula}>
                    {funcionario.nome}
                  </td>

                  <td style={styles.celula}>
                    {funcionario.cargo}
                  </td>

                  <td style={styles.celula}>
                    {funcionario.contato}
                  </td>

                  <td style={styles.celulaAcoes}>
                    <button
                      type="button"
                      onClick={() =>
                        editarFuncionario(funcionario)
                      }
                      style={styles.botaoEditar}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        excluirFuncionario(funcionario.id)
                      }
                      style={styles.botaoExcluir}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==============================
// ESTILOS
// ==============================

const styles = {
  container: {
    minHeight: "100vh",
    padding: "2rem",
    backgroundColor: "#F7F7F4",
  },

  titulo: {
    color: "#2E5339",
    marginBottom: "1.5rem",
  },

  subtitulo: {
    color: "#2E5339",
    marginTop: "0",
    marginBottom: "1rem",
  },

  form: {
    backgroundColor: "#FFFFFF",
    padding: "1.5rem",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    maxWidth: "500px",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },

  label: {
    fontSize: "0.9rem",
    color: "#444",
    marginTop: "0.5rem",
  },

  input: {
    padding: "0.7rem",
    borderRadius: "8px",
    border: "1px solid #DDD",
    fontSize: "1rem",
  },

  botoesForm: {
    display: "flex",
    gap: "10px",
    marginTop: "1rem",
  },

  botao: {
    padding: "0.7rem 1rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#2E5339",
    color: "#FFF",
    fontSize: "1rem",
    cursor: "pointer",
  },

  botaoCancelar: {
    padding: "0.7rem 1rem",
    borderRadius: "8px",
    border: "1px solid #999",
    backgroundColor: "#FFF",
    color: "#444",
    fontSize: "1rem",
    cursor: "pointer",
  },

  tituloLista: {
    marginTop: "2rem",
    marginBottom: "1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  botaoAtualizar: {
    padding: "0.6rem 1rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#2E5339",
    color: "#FFF",
    cursor: "pointer",
  },

  tabelaContainer: {
    overflowX: "auto",
  },

  tabela: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#FFFFFF",
  },

  celula: {
    padding: "12px",
    border: "1px solid #DDD",
    textAlign: "left",
  },

  celulaAcoes: {
    padding: "12px",
    border: "1px solid #DDD",
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  botaoEditar: {
    padding: "6px 10px",
    marginRight: "8px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#2E5339",
    color: "#FFF",
    cursor: "pointer",
  },

  botaoExcluir: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#B5482F",
    color: "#FFF",
    cursor: "pointer",
  },

  erro: {
    color: "#B5482F",
    fontSize: "0.9rem",
  },

  mensagem: {
    color: "#2E5339",
    fontSize: "0.9rem",
  },
};

export default Funcionarios;

