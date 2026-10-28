// script.js — TELA do cliente (calculadora).
// Não fala com o banco: tudo passa pelo Api (api.js).

const UNIDADE_DOSE = {
  racao: "g por dia",
  medicamento: "comprimido(s) — dose única",
  vermifugo: "comprimido(s) — dose única",
  adubo: "g por aplicação",
};

const ROTULOS = {
  pouco_ativo: "Pouco ativo", ativo: "Ativo",
  inicial: "Inicial", crescimento: "Crescimento", postura: "Postura",
  adulto: "Adulto", filhote: "Filhote", idoso: "Idoso",
  medio: "Médio", grande: "Grande",
};

let estado = { produtos: [], produto: null, campos: null, idCalculo: null, resumo: "" };

const $ = (id) => document.getElementById(id);
const rotulo = (v) => ROTULOS[v] || v.charAt(0).toUpperCase() + v.slice(1);
const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Evita que texto vindo do banco seja interpretado como HTML
function esc(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Máscara de telefone brasileiro: (61) 90000-0000 (celular) ou (61) 3000-0000 (fixo).
// Só aceita números; ao colar "+55 61 90000-0000", descarta o 55 do país.
function mascararTelefone(valor) {
  let d = String(valor).replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);

  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

async function carregarMenu() {
  try {
    window.montarMenu(await Api.listarMenu());
  } catch (e) {
    window.mostrarErroMenu(e.message);
  }
}

function mostrarErro(msg) {
  $("erro-calculo").innerHTML = msg ? `<div class="mensagem-erro">${esc(msg)}</div>` : "";
}

function limparResultado() {
  mostrarErro("");
  estado.idCalculo = null;
  $("resultado-dosagem").innerHTML = 'Escolha o que calcular acima e clique em "Calcular Dosagem".';
  $("secao-confirmacao").style.display = "none";
  $("retorno-confirmacao").innerHTML = "";
}

// ---------- 1) O menu em cascata avisa quando uma espécie é escolhida ----------
window.aoSelecionarEspecie = async function (tipo, especie) {
  limparResultado();
  estado.produto = null;
  $("campos-dinamicos").innerHTML = "";
  $("btn-calcular").style.display = "none";
  $("bloco-produto").style.display = "block";

  const sel = $("produto");
  sel.innerHTML = '<option value="">Carregando...</option>';

  try {
    estado.produtos = await Api.listarProdutos(tipo, especie);
  } catch (e) {
    sel.innerHTML = "";
    mostrarErro(e.message);
    return;
  }

  if (estado.produtos.length === 0) {
    sel.innerHTML = '<option value="">Nenhum produto cadastrado para esta opção</option>';
    return;
  }

  sel.innerHTML =
    '<option value="">Selecione o produto...</option>' +
    estado.produtos.map((p) => `<option value="${p.id_produto}">${esc(p.nome)}</option>`).join("");

  if (estado.produtos.length === 1) {
    sel.value = estado.produtos[0].id_produto;
    await aoMudarProduto();
  }
};

// ---------- 2) Produto escolhido: monta só os campos que ele precisa ----------
async function aoMudarProduto() {
  limparResultado();
  $("campos-dinamicos").innerHTML = "";
  $("btn-calcular").style.display = "none";

  const id = Number($("produto").value);
  if (!id) return;

  try {
    const { produto, campos } = await Api.obterFormulario(id);
    estado.produto = produto;
    estado.campos = campos;
    renderizarCampos(campos);
    $("btn-calcular").style.display = "block";
  } catch (e) {
    mostrarErro(e.message);
  }
}

function opcoes(lista, vazio) {
  return (vazio ? `<option value="">${vazio}</option>` : "") +
    lista.map((v) => `<option value="${esc(v)}">${esc(rotulo(v))}</option>`).join("");
}

function renderizarCampos(c) {
  let html = "";

  if (c.idadePorte) {
    html += `<label for="campo-idade">Idade do animal (em meses):</label>
             <input type="number" id="campo-idade" min="0" step="1" placeholder="Ex: 4">
             <label for="campo-porte">Porte esperado quando adulto:</label>
             <select id="campo-porte">${opcoes(c.idadePorte.portes)}</select>`;
  }

  if (c.usaPeso) {
    if (c.ehArea) {
      html += `<label for="campo-peso">Área do canteiro (m²):</label>
               <input type="number" id="campo-peso" min="0" step="any" placeholder="Ex: 3">`;
    } else {
      html += `<label for="campo-peso">Peso do animal:</label>
               <div class="linha-unidade">
                 <input type="number" id="campo-peso" min="0" step="any" placeholder="Ex: 8.5">
                 <select id="campo-unidade"><option value="kg">kg</option><option value="g">g</option></select>
               </div>`;
    }
  }

  // Fase única e obrigatória (ex: "adulto") não precisa perguntar
  const perguntaFase = c.fases.length > 1 || (c.fases.length === 1 && !c.faseObrigatoria);
  if (perguntaFase) {
    html += `<label for="campo-fase">Fase:</label>
             <select id="campo-fase">${opcoes(c.fases, c.faseObrigatoria ? "Selecione..." : "Não informar")}</select>`;
  }

  if (c.atividades.length > 0) {
    html += `<label for="campo-atividade">Nível de atividade:</label>
             <select id="campo-atividade">${opcoes(c.atividades, c.atividadeObrigatoria ? "Selecione..." : "Não informar")}</select>`;
  }

  if (c.pedeQuantidade) {
    const sugestao = estado.produto && estado.produto.peso_embalagem ? estado.produto.peso_embalagem : "";
    const modoInicial = sugestao ? "quantidade" : "dias";
    html += `<label for="campo-modo-duracao">Como prefere informar?</label>
             <select id="campo-modo-duracao">
               <option value="dias" ${modoInicial === "dias" ? "selected" : ""}>Por quantos dias quero que dure</option>
               <option value="quantidade" ${modoInicial === "quantidade" ? "selected" : ""}>Pela quantidade que vou levar (kg)</option>
             </select>
             <div id="bloco-dias" style="display:${modoInicial === "dias" ? "block" : "none"};">
               <label for="campo-dias">Quantos dias?</label>
               <input type="number" id="campo-dias" min="1" max="365" step="1" placeholder="Ex: 30">
             </div>
             <div id="bloco-quantidade" style="display:${modoInicial === "quantidade" ? "block" : "none"};">
               <label for="campo-quantidade">Quantidade que vai levar (kg):</label>
               <input type="number" id="campo-quantidade" min="0" step="any" value="${esc(sugestao)}" placeholder="Ex: 15">
             </div>
             <p class="resultado-detalhe" style="margin-top:4px;">Com isso calculamos quanto levar (ou em quantos dias acaba) e avisamos você na hora certa.</p>`;
  }

  $("campos-dinamicos").innerHTML = html;

  const modo = $("campo-modo-duracao");
  if (modo) {
    modo.addEventListener("change", () => {
      $("bloco-dias").style.display = modo.value === "dias" ? "block" : "none";
      $("bloco-quantidade").style.display = modo.value === "quantidade" ? "block" : "none";
    });
  }
}

function lerEntrada() {
  const c = estado.campos;
  const e = {};

  if (c.usaPeso) {
    const bruto = $("campo-peso").value;
    const v = Number(bruto);
    if (bruto === "" || !(v > 0)) throw new Error(c.ehArea ? "Informe a área do canteiro." : "Informe o peso do animal.");
    e.peso = !c.ehArea && $("campo-unidade").value === "g" ? v / 1000 : v;
  }

  if (c.idadePorte) {
    const idade = $("campo-idade").value;
    if (idade === "" || Number(idade) < 0) throw new Error("Informe a idade do animal em meses.");
    e.idadeMeses = Number(idade);
    e.porteEsperado = $("campo-porte").value;
  }

  if (c.fases.length === 1 && c.faseObrigatoria) {
    e.fase = c.fases[0];
  } else if ($("campo-fase")) {
    e.fase = $("campo-fase").value || undefined;
    if (c.faseObrigatoria && !e.fase) throw new Error("Selecione a fase.");
  }

  if ($("campo-atividade")) {
    e.atividade = $("campo-atividade").value || undefined;
    if (c.atividadeObrigatoria && !e.atividade) throw new Error("Selecione o nível de atividade.");
  }

  const modo = $("campo-modo-duracao");
  if (modo && modo.value === "dias") {
    const dias = Number($("campo-dias").value);
    if ($("campo-dias").value === "" || !Number.isInteger(dias) || dias < 1) throw new Error("Informe por quantos dias quer que dure (número inteiro, 1 ou mais).");
    if (dias > 365) throw new Error("Use no máximo 365 dias.");
    e.dias = dias;
  } else if ($("campo-quantidade") && $("campo-quantidade").value !== "") {
    const q = Number($("campo-quantidade").value);
    if (!(q > 0)) throw new Error("Informe a quantidade que vai levar, em kg.");
    e.quantidadeKg = q;
  }
  return e;
}

// ---------- 3) Calcular ----------
async function calcular() {
  mostrarErro("");
  const btn = $("btn-calcular");
  try {
    const entrada = lerEntrada();
    btn.disabled = true;
    btn.textContent = "Calculando...";

    const res = await Api.calcular(estado.produto.id_produto, entrada);
    mostrarResultado(res);
  } catch (e) {
    mostrarErro(e.message); // inclui o bloqueio "valor não consta na tabela do fabricante"
  } finally {
    btn.disabled = false;
    btn.textContent = "Calcular Dosagem";
  }
}

function mostrarResultado(res) {
  const p = estado.produto;
  const unidade = UNIDADE_DOSE[p.tipo] || "g por dia";

  let faixa;
  if (res.doseMin !== null && res.doseMax !== null && res.doseMin !== res.doseMax) faixa = `${fmt(res.doseMin)} a ${fmt(res.doseMax)}`;
  else if (res.doseMin === null && res.doseMax !== null) faixa = `até ${fmt(res.doseMax)}`;
  else if (res.doseMax === null && res.doseMin !== null) faixa = `a partir de ${fmt(res.doseMin)}`;
  else faixa = fmt(res.dose);

  let html = `<div><strong>${esc(p.nome)}</strong></div>
              <div class="resultado-dose">${faixa} <span style="font-size:1rem;font-weight:600;">${unidade}</span></div>`;

  if (res.desperdicio > 0) {
    html += `<div class="resultado-detalhe">Já inclui ${fmt(res.desperdicio)}% de desperdício (parte da ração é derrubada/espalhada).</div>`;
  }
  if (res.modoDias && res.quantidadeNecessaria) {
    const q = res.quantidadeNecessaria;
    let texto;
    if (q.minKg !== null && q.maxKg !== null && q.minKg !== q.maxKg) texto = `entre ${fmt(q.minKg)} e ${fmt(q.maxKg)} kg`;
    else if (q.minKg === null) texto = `no máximo ${fmt(q.maxKg)} kg`;
    else if (q.maxKg === null) texto = `pelo menos ${fmt(q.minKg)} kg`;
    else texto = `cerca de ${fmt(q.minKg)} kg`;
    const extra = p.tipo === "adubo" ? " (considerando 1 aplicação por mês)" : "";
    html += `<div class="resultado-detalhe">Para <strong>${res.duracao} dias</strong> você vai precisar de <strong>${texto}</strong>${extra}.</div>`;
  } else if (res.duracao !== null && res.quantidadeKg) {
    const extra = p.tipo === "adubo" ? " (considerando 1 aplicação por mês)" : res.doseMin !== res.doseMax ? " (pela média da faixa)" : "";
    html += `<div class="resultado-detalhe">Essa quantidade (${fmt(res.quantidadeKg)} kg) dura cerca de <strong>${res.duracao} dias</strong>${extra}.</div>`;
  } else if (p.tipo === "racao" || p.tipo === "adubo") {
    html += `<div class="resultado-detalhe">Para receber o lembrete de reposição, informe por quantos dias quer que dure ou a quantidade que vai levar, e calcule novamente.</div>`;
  }
  if (res.observacao) html += `<div class="resultado-detalhe">${esc(res.observacao)}</div>`;
  if (res.alertas && res.alertas.length > 0) {
    html += `<ul class="lista-avisos">${res.alertas.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`;
  }
  html += `<div class="resultado-detalhe" style="font-size:.8rem;">Valores orientativos. Siga a embalagem/bula e a orientação de um veterinário ou da loja.</div>`;
  if (res.avisoHistorico) html += `<div class="resultado-detalhe">${esc(res.avisoHistorico)}</div>`;

  $("resultado-dosagem").innerHTML = html;
  estado.resumo = `${p.nome}: ${faixa} ${unidade}` + (res.duracao !== null ? ` | dura ~${res.duracao} dias` : "");
  estado.idCalculo = res.id_calculo;

  // A confirmação (nome + telefone) só aparece se existe o que lembrar:
  // o cálculo foi registrado E sabemos em quantos dias o produto acaba.
  $("secao-confirmacao").style.display = res.id_calculo && res.duracao !== null ? "block" : "none";
  $("retorno-confirmacao").innerHTML = "";
}

// ---------- 4) Confirmar compra (só agora pedimos nome e telefone) ----------
async function confirmar(evento) {
  evento.preventDefault();
  const retorno = $("retorno-confirmacao");

  const nome = $("nome").value.trim();
  const telefone = $("whatsapp").value.replace(/\D/g, ""); // só dígitos: telefone é a chave do cliente
  if (!nome) { retorno.innerHTML = '<div class="mensagem-erro">Informe seu nome.</div>'; return; }
  // O lembrete vai por WhatsApp: exige celular com DDD (11 dígitos, começando com 9 depois do DDD)
  if (telefone.length !== 11 || Number(telefone.slice(0, 2)) < 11 || telefone[2] !== "9") {
    retorno.innerHTML = '<div class="mensagem-erro">Informe o celular com DDD, no formato (61) 90000-0000.</div>';
    return;
  }
  if (!$("lgpd").checked) {
    retorno.innerHTML = '<div class="mensagem-erro">É necessário aceitar o consentimento (LGPD).</div>';
    return;
  }

  const btn = $("btn-confirmar");
  btn.disabled = true;
  try {
    await Api.confirmarCompra(estado.idCalculo, nome, telefone);

    let html = `<div class="mensagem-sucesso">Compra confirmada! Você receberá um lembrete quando o produto estiver acabando.</div>`;

    // Botão opcional: o cliente manda o resumo para o WhatsApp da loja.
    // Fica desligado por padrão (veja MOSTRAR_BOTAO_WHATSAPP_LOJA no config.js).
    if (typeof MOSTRAR_BOTAO_WHATSAPP_LOJA !== "undefined" && MOSTRAR_BOTAO_WHATSAPP_LOJA) {
      const texto = encodeURIComponent(
        `*CIMDP - Compra confirmada*\nCliente: ${nome}\nContato: ${$("whatsapp").value}\nResumo: ${estado.resumo}`
      );
      html += `<a href="https://wa.me/${NUMERO_LOJA_WHATSAPP}?text=${texto}" target="_blank" rel="noopener">
        <button type="button" class="btn-whatsapp">Enviar resumo para a loja pelo WhatsApp</button>
      </a>`;
    }

    retorno.innerHTML = html;
    $("form-pedido").style.display = "none";
  } catch (e) {
    retorno.innerHTML = `<div class="mensagem-erro">${esc(e.message)}</div>`;
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("produto").addEventListener("change", aoMudarProduto);
  $("btn-calcular").addEventListener("click", calcular);
  $("form-pedido").addEventListener("submit", confirmar);
  $("whatsapp").addEventListener("input", (e) => { e.target.value = mascararTelefone(e.target.value); });
  carregarMenu();
});
