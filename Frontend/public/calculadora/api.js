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
  async function confirmarCompra(idCalculo, nome, telefoneSoDigitos) {
    await chamarBackend("POST", "/confirmar-compra", {
      id_calculo: idCalculo, nome, telefone: telefoneSoDigitos,
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
    const { data: regras } = await db.from("regra_produto").select("id_produto");
    const comTabela = new Set((regras || []).map((r) => r.id_produto));
    return produtos.map((p) => ({ ...p, temTabela: comTabela.has(p.id_produto) }));
  }

  async function listarRegrasGenericas() {
    const { data, error } = await db.from("regra_generica").select("id_regra, especie, tipo").order("especie");
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
    listarEspecies, salvarEspecie,
    entrar, sair, sessaoAtual, listarProdutosAdmin, listarRegrasGenericas,
    salvarProduto, definirAtivoProduto, resumo,
  };
})();

if (typeof window !== "undefined") window.Api = Api;
if (typeof module !== "undefined" && module.exports) module.exports = { Api };
