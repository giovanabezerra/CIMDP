// api.js — ÚNICO arquivo que conversa com o banco/servidor.
//
// DIVISÃO DE RESPONSABILIDADES
//  * CÁLCULO e REGISTRO (formulário, calcular, confirmar compra): feitos pelo
//    BACK-END. O front só envia o que o cliente digitou e mostra a resposta.
//    Rotas e formatos: CONTRATO_API.md. URL do back-end: API_URL em config.js.
//  * LEITURAS SIMPLES (menu, lista de produtos) e PAINEL ADMIN: ainda direto
//    no Supabase, protegidas por RLS. Dá para mover para o back-end depois,
//    mexendo só neste arquivo.

const Api = (() => {
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  // Na tela o cliente escolhe "Medicamento"; no banco pode estar como
  // "medicamento" ou "vermifugo".
  const TIPOS_BANCO = { racao: ["racao"], medicamento: ["medicamento", "vermifugo"], adubo: ["adubo"] };

  // ---------- chamada ao back-end ----------
  // 60 s de limite: servidores gratuitos (ex.: Render) podem demorar para "acordar".
  async function chamarBackend(metodo, rota, corpo) {
    if (typeof API_URL === "undefined" || !API_URL) {
      throw new Error("O servidor de cálculo ainda não foi configurado. Fale com um funcionário da loja.");
    }
    const controle = new AbortController();
    const prazo = setTimeout(() => controle.abort(), 60000);
    let resp;
    try {
      resp = await fetch(API_URL.replace(/\/$/, "") + rota, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: controle.signal,
      });
    } catch (e) {
      throw new Error("Não foi possível falar com o servidor. Verifique a internet e tente de novo.");
    } finally {
      clearTimeout(prazo);
    }
    let dados = null;
    try { dados = await resp.json(); } catch (e) { /* resposta sem corpo (204) */ }
    if (!resp.ok) {
      // 422 = erro de regra (ex.: peso fora da tabela): a mensagem já é para o cliente
      throw new Error((dados && dados.erro) || "O servidor não conseguiu processar. Tente novamente.");
    }
    return dados;
  }

  // ===================== CLIENTE (calculadora) =====================

  // (leitura direta no Supabase)
  async function listarProdutos(tipo, especie) {
    const { data, error } = await db
      .from("produto")
      .select("*")
      .in("tipo", TIPOS_BANCO[tipo] || [tipo])
      .eq("especie", especie)
      .order("nome");
    if (error) throw new Error("Não foi possível carregar os produtos.");
    return data;
  }

  // Monta o menu a partir do que está cadastrado: só aparece espécie que tem
  // produto ativo. Espécie nova cadastrada no admin aparece aqui sozinha.
  // [futuro back-end]  GET /menu
  async function listarMenu() {
    const { data: produtos, error } = await db.from("produto").select("tipo, especie").eq("ativo", true);
    if (error) throw new Error("Não foi possível carregar as opções.");
    const { data: especies } = await db.from("especie").select("codigo, nome");

    const nomes = {};
    (especies || []).forEach((e) => { nomes[e.codigo] = e.nome; });
    const nomeDe = (codigo) => nomes[codigo] || codigo.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

    const menu = { racao: [], medicamento: [], adubo: [] };
    const vistos = new Set();
    (produtos || []).forEach((p) => {
      if (!p.especie) return;
      const tipo = p.tipo === "vermifugo" ? "medicamento" : p.tipo;
      if (!menu[tipo]) return; // ex.: "ingrediente" ainda não tem tela
      const chave = tipo + "|" + p.especie;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      menu[tipo].push({ codigo: p.especie, nome: nomeDe(p.especie) });
    });
    Object.keys(menu).forEach((t) => menu[t].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")));
    return menu;
  }

  // Diz à tela QUAIS campos pedir (peso? fase? atividade? idade+porte? quantidade?)
  // Back-end:  GET /produtos/:id/formulario  ->  { produto, campos }
  async function obterFormulario(idProduto) {
    return chamarBackend("GET", `/produtos/${encodeURIComponent(idProduto)}/formulario`);
  }

  // Calcula e registra no histórico — tudo no back-end.
  // entrada = { peso, fase, atividade, idadeMeses, porteEsperado, quantidadeKg, dias }
  //   (peso em kg, ou m² para adubo; informe quantidadeKg OU dias, não os dois)
  // Back-end:  POST /calcular
  async function calcular(idProduto, entrada) {
    return chamarBackend("POST", "/calcular", { id_produto: idProduto, ...entrada });
  }

  // Back-end:  POST /confirmar-compra   (telefone só com dígitos)
  // Cliente já cadastrado: pode passar nome = null (o back-end usa o nome guardado).
  async function confirmarCompra(idCalculo, nome, telefoneSoDigitos) {
    const corpo = { id_calculo: idCalculo, telefone: telefoneSoDigitos };
    if (nome) corpo.nome = nome;
    await chamarBackend("POST", "/confirmar-compra", corpo);
  }

  // Back-end:  POST /clientes/identificar  ->  { encontrado, recorrente }
  // Só diz SE o telefone já está cadastrado (o nome nunca volta, por privacidade).
  async function identificarCliente(telefoneSoDigitos) {
    return chamarBackend("POST", "/clientes/identificar", { telefone: telefoneSoDigitos });
  }

  // Back-end:  POST /clientes   (cadastra/atualiza cliente recorrente; exige consentimento LGPD)
  async function cadastrarClienteRecorrente(nome, telefoneSoDigitos) {
    await chamarBackend("POST", "/clientes", {
      nome, telefone: telefoneSoDigitos, consentimento: true,
    });
  }

  // ===================== ADMIN =====================

  async function entrar(email, senha) {
    const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error("E-mail ou senha incorretos.");
    return data.user;
  }
  async function sair() { await db.auth.signOut(); }
  async function sessaoAtual() {
    const { data } = await db.auth.getSession();
    return data.session ? data.session.user : null;
  }

  // [futuro back-end]  GET /produtos (admin, com inativos)
  async function listarProdutosAdmin() {
    const { data: produtos, error } = await db.from("produto").select("*").order("nome");
    if (error) throw new Error("Não foi possível carregar os produtos.");
    // status de cada linha de regra (precisa do SQL schema_regras_bd.sql; sem ele, só id_produto)
    let { data: regras, error: erroStatus } = await db.from("regra_produto").select("id_produto, status");
    if (erroStatus) ({ data: regras } = await db.from("regra_produto").select("id_produto"));
    const porProduto = {};
    (regras || []).forEach((r) => {
      (porProduto[r.id_produto] = porProduto[r.id_produto] || []).push(r.status || "ATIVA");
    });
    return produtos.map((p) => {
      const lista = porProduto[p.id_produto] || [];
      // status único se todas as linhas têm o mesmo; "MISTO" se há mais de um
      const unicos = [...new Set(lista)];
      return {
        ...p,
        temTabela: lista.length > 0,
        statusTabela: unicos.length === 0 ? null : unicos.length === 1 ? unicos[0] : "MISTO",
      };
    });
  }

  // Troca o status de TODAS as linhas da tabela do fabricante de um produto.
  // Só VALIDADA e ATIVA entram no cálculo.
  async function definirStatusTabelaProduto(idProduto, status) {
    const { error } = await db.from("regra_produto").update({ status }).eq("id_produto", idProduto);
    if (error) throw new Error("Não foi possível alterar o status da regra.");
  }

  async function definirStatusRegraGenerica(idRegra, status) {
    const { error } = await db.from("regra_generica").update({ status }).eq("id_regra", idRegra);
    if (error) throw new Error("Não foi possível alterar o status da regra.");
  }

  // Clientes cadastrados + resumo das compras confirmadas (só o admin logado enxerga: RLS).
  async function listarClientes() {
    let { data: clientes, error } = await db.from("cliente")
      .select("id_cliente, nome, telefone, recorrente, consentimento_lgpd_em").order("nome");
    // Sem as colunas novas (SQL schema_clientes_lembretes.sql ainda não rodou): lista o básico
    if (error) ({ data: clientes, error } = await db.from("cliente").select("id_cliente, nome, telefone").order("nome"));
    if (error) throw new Error("Não foi possível carregar os clientes.");

    const { data: compras } = await db.from("calculo")
      .select("id_cliente, id_produto, data_confirmacao_compra")
      .not("id_cliente", "is", null).not("data_confirmacao_compra", "is", null)
      .order("data_confirmacao_compra", { ascending: false });

    const porCliente = {};
    (compras || []).forEach((c) => {
      const r = (porCliente[c.id_cliente] = porCliente[c.id_cliente] || { total: 0, ultima: c });
      r.total += 1; // já vem da mais recente para a mais antiga
    });
    return (clientes || []).map((c) => ({
      ...c,
      totalCompras: porCliente[c.id_cliente] ? porCliente[c.id_cliente].total : 0,
      ultimaCompra: porCliente[c.id_cliente] ? porCliente[c.id_cliente].ultima : null,
    }));
  }

  async function listarRegrasGenericas() {
    let { data, error } = await db.from("regra_generica").select("id_regra, especie, tipo, status").order("especie");
    if (error) ({ data, error } = await db.from("regra_generica").select("id_regra, especie, tipo").order("especie"));
    if (error) throw new Error("Não foi possível carregar as regras genéricas.");
    return data;
  }

  // [futuro back-end]  GET /especies
  async function listarEspecies() {
    const { data, error } = await db.from("especie").select("codigo, nome").order("nome");
    if (error) throw new Error("Não foi possível carregar as espécies.");
    return data;
  }

  // Cria a espécie se ainda não existir (nunca sobrescreve uma existente)
  // [futuro back-end]  POST /especies
  async function salvarEspecie(codigo, nome) {
    const { error } = await db.from("especie").upsert([{ codigo, nome }], { onConflict: "codigo", ignoreDuplicates: true });
    if (error) throw new Error("Não foi possível cadastrar a espécie.");
  }

  // [futuro back-end]  POST /produtos  |  PUT /produtos/:id
  async function salvarProduto(p) {
    const campos = {
      nome: p.nome, tipo: p.tipo, especie: p.especie,
      peso_embalagem: p.peso_embalagem, id_regra: p.id_regra,
      codigo: p.codigo, marca: p.marca, linha: p.linha,
      variante: p.variante, unidade_embalagem: p.unidade_embalagem,
    };
    const consulta = p.id_produto
      ? db.from("produto").update(campos).eq("id_produto", p.id_produto)
      : db.from("produto").insert([campos]);
    const { error } = await consulta;
    if (error) throw new Error("Não foi possível salvar o produto.");
  }

  // Produto nunca é apagado de verdade (cálculos antigos o referenciam): só desativa.
  // [futuro back-end]  DELETE /produtos/:id
  async function definirAtivoProduto(id, ativo) {
    const { error } = await db.from("produto").update({ ativo }).eq("id_produto", id);
    if (error) throw new Error("Não foi possível alterar o produto.");
  }

  async function resumo() {
    const total = await db.from("calculo").select("*", { count: "exact", head: true });
    const conf = await db.from("calculo").select("*", { count: "exact", head: true }).not("data_confirmacao_compra", "is", null);
    const { data: ids } = await db.from("calculo").select("id_produto").limit(1000);

    const contagem = {};
    (ids || []).forEach((r) => { contagem[r.id_produto] = (contagem[r.id_produto] || 0) + 1; });
    const topId = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];

    let topNome = "-";
    if (topId) {
      const { data: p } = await db.from("produto").select("nome").eq("id_produto", Number(topId)).maybeSingle();
      topNome = p ? p.nome : "-";
    }
    return { totalCalculos: total.count || 0, totalConfirmados: conf.count || 0, produtoMaisConsultado: topNome };
  }

  return {
    listarMenu, listarProdutos, obterFormulario, calcular, confirmarCompra,
    identificarCliente, cadastrarClienteRecorrente,
    listarEspecies, salvarEspecie,
    entrar, sair, sessaoAtual, listarProdutosAdmin, listarRegrasGenericas, listarClientes,
    salvarProduto, definirAtivoProduto, resumo,
    definirStatusTabelaProduto, definirStatusRegraGenerica,
  };
})();

if (typeof window !== "undefined") window.Api = Api;
if (typeof module !== "undefined" && module.exports) module.exports = { Api };
