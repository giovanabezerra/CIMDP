// admin.js — TELA do painel administrativo.
// Não fala com o banco: tudo passa pelo Api (api.js). Os dados ficam no
// Supabase (não mais no localStorage do navegador).
// A proteção real é do banco (RLS): mesmo que alguém abra esta página,
// sem login o banco não entrega nem aceita nada.

const $ = (id) => document.getElementById(id);
let produtos = [];
let regrasGenericas = [];
let especies = [];

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
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${esc(p.nome)}</strong></td>
      <td>${esc(p.tipo)}</td>
      <td>${esc(nomeEspecie(p.especie))}</td>
      <td>${p.peso_embalagem ? esc(p.peso_embalagem) + " kg" : "-"}</td>
      <td>${regra}</td>
      <td>${p.ativo ? "Ativo" : "Inativo"}</td>
      <td>
        <button class="btn-acao btn-editar" data-acao="editar" data-id="${p.id_produto}">Editar</button>
        <button class="btn-acao ${p.ativo ? "btn-excluir" : "btn-editar"}" data-acao="ativo" data-id="${p.id_produto}">${p.ativo ? "Desativar" : "Reativar"}</button>
      </td>`;
    corpo.appendChild(tr);
  });
}

function preencherFormulario(p) {
  $("produto-id").value = p.id_produto;
  $("nome-produto").value = p.nome;
  $("tipo-produto").value = p.tipo === "vermifugo" ? "medicamento" : p.tipo;
  renderizarEspecies(p.especie || "");
  alternarNovaEspecie();
  $("embalagem-produto").value = p.peso_embalagem ?? "";
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

// ---------- Exportar CSV ----------
function exportarCSV() {
  let csv = "ID;Nome;Tipo;Especie;EmbalagemKg;Regra;Status\n";
  produtos.forEach((p) => {
    const regra = p.temTabela ? "tabela" : p.id_regra ? "formula" : "sem regra";
    csv += `${p.id_produto};"${String(p.nome).replace(/"/g, '""')}";${p.tipo};${p.especie};${p.peso_embalagem ?? ""};${regra};${p.ativo ? "ativo" : "inativo"}\n`;
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
  $("btn-csv").addEventListener("click", exportarCSV);
  $("especie-produto").addEventListener("change", alternarNovaEspecie);
  iniciar();
});
