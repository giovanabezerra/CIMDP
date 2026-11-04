// admin.js — TELA do painel administrativo.
// Não fala com o banco: tudo passa pelo Api (api.js). Os dados ficam no
// Supabase (não mais no localStorage do navegador).
// A proteção real é do banco (RLS): mesmo que alguém abra esta página,
// sem login o banco não entrega nem aceita nada.

const $ = (id) => document.getElementById(id);
let produtos = [];
let regrasGenericas = [];
let especies = [];

const STATUS_REGRA = {
  RASCUNHO: "Rascunho", PENDENTE_VALIDACAO: "Pendente de validação",
  VALIDADA: "Validada", ATIVA: "Ativa", INATIVA: "Inativa",
};
const status_usa_no_calculo = (s) => s === "VALIDADA" || s === "ATIVA";
const opcoesStatus = (atual) =>
  Object.entries(STATUS_REGRA).map(([v, t]) => `<option value="${v}" ${v === atual ? "selected" : ""}>${t}</option>`).join("");

function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function aviso(elId, msg, tipo) {
  $(elId).innerHTML = msg ? `<div class="mensagem-${tipo}">${esc(msg)}</div>` : "";
}

// ---------- Login / sessão ----------
async function iniciar() {
  const usuario = await Api.sessaoAtual();
  if (usuario) await mostrarPainel();
  else mostrarLogin();
}

function mostrarLogin() {
  $("bloco-login").style.display = "block";
  $("bloco-painel").style.display = "none";
}

async function mostrarPainel() {
  $("bloco-login").style.display = "none";
  $("bloco-painel").style.display = "block";
  try {
    regrasGenericas = await Api.listarRegrasGenericas();
    $("regra-produto").innerHTML =
      '<option value="">Nenhuma</option>' +
      regrasGenericas.map((r) => `<option value="${r.id_regra}">${esc(r.especie)} / ${esc(r.tipo)}</option>`).join("");
    await carregarEspecies();
    await Promise.all([carregarProdutos(), carregarResumo()]);
    renderizarRegrasGenericas();
    await carregarClientes();
  } catch (e) {
    aviso("retorno-produto", e.message, "erro");
  }
}

async function entrar(evento) {
  evento.preventDefault();
  const btn = $("btn-entrar");
  btn.disabled = true;
  try {
    await Api.entrar($("login-email").value.trim(), $("login-senha").value);
    aviso("erro-login", "", "erro");
    await mostrarPainel();
  } catch (e) {
    aviso("erro-login", e.message, "erro");
  } finally {
    btn.disabled = false;
  }
}

async function sair() {
  await Api.sair();
  mostrarLogin();
}

// ---------- Resumo ----------
async function carregarResumo() {
  try {
    const r = await Api.resumo();
    $("metric-total").textContent = r.totalCalculos;
    $("metric-confirmados").textContent = r.totalConfirmados;
    $("metric-top").textContent = r.produtoMaisConsultado;
  } catch (e) { /* o resumo é secundário: não trava o painel */ }
}

// ---------- Espécies ----------
async function carregarEspecies() {
  try { especies = await Api.listarEspecies(); } catch (e) { especies = []; }
  renderizarEspecies($("especie-produto").value);
}

function renderizarEspecies(selecionada) {
  const sel = $("especie-produto");
  let opcoes = especies.map((e) => `<option value="${esc(e.codigo)}">${esc(e.nome)}</option>`).join("");
  // Produto com espécie que (ainda) não está na tabela de espécies: mostra o código
  if (selecionada && selecionada !== "__nova__" && !especies.some((e) => e.codigo === selecionada)) {
    opcoes = `<option value="${esc(selecionada)}">${esc(selecionada)}</option>` + opcoes;
  }
  sel.innerHTML = '<option value="">Selecione...</option>' + opcoes + '<option value="__nova__">+ Cadastrar nova espécie...</option>';
  sel.value = selecionada || "";
}

function alternarNovaEspecie() {
  $("bloco-nova-especie").style.display = $("especie-produto").value === "__nova__" ? "block" : "none";
  if ($("especie-produto").value !== "__nova__") $("nova-especie").value = "";
}

function nomeEspecie(codigo) {
  const achada = especies.find((e) => e.codigo === codigo);
  return achada ? achada.nome : codigo || "-";
}

// "Cão" -> "cao", "Pato Mudo" -> "pato_mudo" (é o que o produto guarda no banco)
function gerarCodigo(nome) {
  return String(nome)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// ---------- Produtos ----------
async function carregarProdutos() {
  produtos = await Api.listarProdutosAdmin();
  const corpo = $("tabela-corpo");
  corpo.innerHTML = "";

  produtos.forEach((p) => {
    const regra = p.temTabela ? "Tabela do fabricante" : p.id_regra ? "Fórmula genérica" : "Sem regra";
    const validacao = p.temTabela
      ? (p.statusTabela === "MISTO"
          ? `<select data-validacao="${p.id_produto}"><option value="">Misto: escolha para padronizar</option>${opcoesStatus("")}</select>`
          : `<select data-validacao="${p.id_produto}">${opcoesStatus(p.statusTabela)}</select>`)
      : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(p.codigo || "-")}</td>
      <td><strong>${esc(p.nome)}</strong>${p.marca || p.linha || p.variante ? `<br><small>${esc([p.marca, p.linha, p.variante].filter(Boolean).join(" · "))}</small>` : ""}</td>
      <td>${esc(p.tipo)}</td>
      <td>${esc(nomeEspecie(p.especie))}</td>
      <td>${p.peso_embalagem ? esc(p.peso_embalagem) + " " + esc(p.unidade_embalagem || "kg") : "-"}</td>
      <td>${regra}</td>
      <td>${validacao}</td>
      <td>${p.ativo ? "Ativo" : "Inativo"}</td>
      <td>
        <button class="btn-acao btn-editar" data-acao="editar" data-id="${p.id_produto}">Editar</button>
        <button class="btn-acao ${p.ativo ? "btn-excluir" : "btn-editar"}" data-acao="ativo" data-id="${p.id_produto}">${p.ativo ? "Desativar" : "Reativar"}</button>
      </td>`;
    corpo.appendChild(tr);
  });
}

// ---------- Clientes ----------
let clientes = [];

function formatarTelefone(t) {
  const d = String(t || "").replace(/\D/g, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d || "-";
}

function formatarData(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d) ? "-" : d.toLocaleDateString("pt-BR");
}

async function carregarClientes() {
  try { clientes = await Api.listarClientes(); } catch (e) { clientes = []; aviso("retorno-produto", e.message, "erro"); }
  renderizarClientes();
}

function renderizarClientes() {
  const termo = $("busca-cliente").value.trim().toLowerCase();
  const soDigitos = termo.replace(/\D/g, "");
  const lista = clientes.filter((c) =>
    !termo || String(c.nome || "").toLowerCase().includes(termo) || (soDigitos && String(c.telefone || "").includes(soDigitos)));

  $("tabela-clientes").innerHTML = lista.map((c) => {
    const ult = c.ultimaCompra;
    const prod = ult ? produtos.find((p) => p.id_produto === ult.id_produto) : null;
    return `<tr>
      <td><strong>${esc(c.nome)}</strong></td>
      <td>${esc(formatarTelefone(c.telefone))}</td>
      <td>${c.recorrente === undefined ? "-" : c.recorrente ? "Sim" : "Não"}</td>
      <td>${esc(formatarData(c.consentimento_lgpd_em))}</td>
      <td>${c.totalCompras}</td>
      <td>${ult ? esc(formatarData(ult.data_confirmacao_compra)) + (prod ? `<br><small>${esc(prod.nome)}</small>` : "") : "-"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>`;
  $("total-clientes").textContent = `${lista.length} de ${clientes.length} cliente(s).`;
}

function renderizarRegrasGenericas() {
  const corpo = $("tabela-regras");
  corpo.innerHTML = regrasGenericas.map((r) => `
    <tr>
      <td>${esc(nomeEspecie(r.especie))}</td>
      <td>${esc(r.tipo)}</td>
      <td>${r.status === undefined
        ? "Rode o SQL schema_regras_bd.sql para controlar o status"
        : `<select data-regra-generica="${r.id_regra}">${opcoesStatus(r.status)}</select>`}</td>
    </tr>`).join("");
}

function preencherFormulario(p) {
  $("produto-id").value = p.id_produto;
  $("nome-produto").value = p.nome;
  $("tipo-produto").value = p.tipo === "vermifugo" ? "medicamento" : p.tipo;
  renderizarEspecies(p.especie || "");
  alternarNovaEspecie();
  $("embalagem-produto").value = p.peso_embalagem ?? "";
  $("unidade-embalagem").value = p.unidade_embalagem || "kg";
  $("codigo-produto").value = p.codigo ?? "";
  $("marca-produto").value = p.marca ?? "";
  $("linha-produto").value = p.linha ?? "";
  $("variante-produto").value = p.variante ?? "";
  $("regra-produto").value = p.id_regra ?? "";
  $("titulo-form").textContent = "Editar produto";
  $("btn-salvar").textContent = "Atualizar Produto";
  $("btn-cancelar").style.display = "block";
  window.scrollTo({ top: $("form-produto").offsetTop - 20, behavior: "smooth" });
}

function limparFormulario() {
  $("form-produto").reset();
  renderizarEspecies("");
  alternarNovaEspecie();
  $("produto-id").value = "";
  $("titulo-form").textContent = "Cadastrar produto";
  $("btn-salvar").textContent = "Cadastrar Produto";
  $("btn-cancelar").style.display = "none";
}

async function salvar(evento) {
  evento.preventDefault();
  let especie = $("especie-produto").value;
  if (!especie) { aviso("retorno-produto", "Selecione a espécie.", "erro"); return; }

  if (especie === "__nova__") {
    const nomeNovo = $("nova-especie").value.trim();
    const codigo = gerarCodigo(nomeNovo);
    if (!nomeNovo || !codigo) { aviso("retorno-produto", "Informe o nome da nova espécie.", "erro"); return; }
    try {
      // Se já existir uma espécie com esse código, usa a existente (não duplica)
      if (!especies.some((x) => x.codigo === codigo)) await Api.salvarEspecie(codigo, nomeNovo);
    } catch (e) {
      aviso("retorno-produto", e.message, "erro");
      return;
    }
    especie = codigo;
  }

  const emb = $("embalagem-produto").value;
  const regra = $("regra-produto").value;

  const produto = {
    id_produto: $("produto-id").value ? Number($("produto-id").value) : null,
    nome: $("nome-produto").value.trim(),
    tipo: $("tipo-produto").value,
    especie,
    peso_embalagem: emb === "" ? null : Number(emb),
    id_regra: regra === "" ? null : Number(regra),
    // código é TEXTO (preserva zeros à esquerda); vazio vira nulo para não colidir no índice único
    codigo: $("codigo-produto").value.trim() || null,
    marca: $("marca-produto").value.trim() || null,
    linha: $("linha-produto").value.trim() || null,
    variante: $("variante-produto").value.trim() || null,
    unidade_embalagem: $("unidade-embalagem").value || "kg",
  };

  try {
    await Api.salvarProduto(produto);
    await carregarEspecies();
    aviso("retorno-produto", "Produto salvo com sucesso.", "sucesso");
    limparFormulario();
    await carregarProdutos();
  } catch (e) {
    aviso("retorno-produto", e.message, "erro");
  }
}

async function aoClicarTabela(evento) {
  const btn = evento.target.closest("button[data-acao]");
  if (!btn) return;
  const p = produtos.find((x) => x.id_produto === Number(btn.dataset.id));
  if (!p) return;

  if (btn.dataset.acao === "editar") {
    preencherFormulario(p);
  } else if (btn.dataset.acao === "ativo") {
    const acao = p.ativo ? "desativar" : "reativar";
    if (!confirm(`Deseja ${acao} "${p.nome}"? (O histórico de cálculos é mantido.)`)) return;
    try {
      await Api.definirAtivoProduto(p.id_produto, !p.ativo);
      await carregarProdutos();
    } catch (e) {
      aviso("retorno-produto", e.message, "erro");
    }
  }
}

// Troca de status (tabela do fabricante de um produto ou regra genérica)
async function aoMudarStatus(evento) {
  const sel = evento.target;
  try {
    if (sel.dataset.validacao) {
      if (!sel.value) return;
      const p = produtos.find((x) => x.id_produto === Number(sel.dataset.validacao));
      const nome = STATUS_REGRA[sel.value];
      if (!confirm(`Marcar TODAS as faixas da tabela de "${p.nome}" como "${nome}"?` +
          (status_usa_no_calculo(sel.value) ? "\nElas passam a valer no cálculo. Confira antes na embalagem." : "\nElas deixam de valer no cálculo."))) {
        await carregarProdutos(); return;
      }
      await Api.definirStatusTabelaProduto(p.id_produto, sel.value);
      await carregarProdutos();
      aviso("retorno-produto", `Tabela de "${p.nome}" marcada como ${nome}.`, "sucesso");
    } else if (sel.dataset.regraGenerica) {
      const r = regrasGenericas.find((x) => x.id_regra === Number(sel.dataset.regraGenerica));
      if (!confirm(`Marcar a regra ${r.especie} / ${r.tipo} como "${STATUS_REGRA[sel.value]}"?`)) { renderizarRegrasGenericas(); return; }
      await Api.definirStatusRegraGenerica(r.id_regra, sel.value);
      r.status = sel.value;
      aviso("retorno-produto", "Status da regra atualizado.", "sucesso");
    }
  } catch (e) {
    aviso("retorno-produto", e.message, "erro");
  }
}

// ---------- Exportar CSV ----------
function exportarCSV() {
  let csv = "ID;Codigo;Nome;Marca;Linha;Variante;Tipo;Especie;Embalagem;Unidade;Regra;StatusRegra;Status\n";
  produtos.forEach((p) => {
    const regra = p.temTabela ? "tabela" : p.id_regra ? "formula" : "sem regra";
    const t = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    csv += `${p.id_produto};${t(p.codigo)};${t(p.nome)};${t(p.marca)};${t(p.linha)};${t(p.variante)};${p.tipo};${p.especie};${p.peso_embalagem ?? ""};${p.unidade_embalagem ?? ""};${regra};${p.statusTabela ?? ""};${p.ativo ? "ativo" : "inativo"}\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `produtos_cimdp_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

document.addEventListener("DOMContentLoaded", () => {
  $("form-login").addEventListener("submit", entrar);
  $("btn-sair").addEventListener("click", sair);
  $("form-produto").addEventListener("submit", salvar);
  $("btn-cancelar").addEventListener("click", limparFormulario);
  $("tabela-corpo").addEventListener("click", aoClicarTabela);
  $("tabela-corpo").addEventListener("change", aoMudarStatus);
  $("busca-cliente").addEventListener("input", renderizarClientes);
  $("tabela-regras").addEventListener("change", aoMudarStatus);
  $("btn-csv").addEventListener("click", exportarCSV);
  $("especie-produto").addEventListener("change", alternarNovaEspecie);
  iniciar();
});
