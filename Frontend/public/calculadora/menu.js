// menu.js — menu em cascata (categoria -> espécie), montado a partir do banco.
// Quando alguém escolhe uma espécie, avisa o script.js chamando
// window.aoSelecionarEspecie(tipo, especie, rotulo).

const CATEGORIAS_MENU = [
  { tipo: "racao", rotulo: "🍖 Ração" },
  { tipo: "medicamento", rotulo: "💊 Medicamento" },
  { tipo: "adubo", rotulo: "🌱 Adubo" },
];

function escMenu(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// menu = { racao: [{codigo, nome}], medicamento: [...], adubo: [...] }
window.montarMenu = function (menu) {
  const html = CATEGORIAS_MENU
    .filter((c) => menu[c.tipo] && menu[c.tipo].length > 0)
    .map(
      (c) => `
      <li class="item-categoria">
        <span class="nome-categoria">${c.rotulo}</span>
        <ul class="submenu-especies">
          ${menu[c.tipo].map((e) => `<li data-tipo="${c.tipo}" data-especie="${escMenu(e.codigo)}">${escMenu(e.nome)}</li>`).join("")}
        </ul>
      </li>`
    )
    .join("");

  document.getElementById("lista-categorias").innerHTML =
    html || '<li class="menu-vazio">Nenhum produto cadastrado ainda.</li>';
};

window.mostrarErroMenu = function (mensagem) {
  document.getElementById("lista-categorias").innerHTML = `<li class="menu-vazio">${escMenu(mensagem)}</li>`;
};

// Eventos por delegação: funcionam mesmo com o menu montado depois da página abrir
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("menu-categorias");

  nav.addEventListener("click", (e) => {
    const especie = e.target.closest(".submenu-especies li");

    if (especie) {
      nav.querySelectorAll(".submenu-especies li").forEach((x) => x.classList.remove("selecionado"));
      especie.classList.add("selecionado");
      nav.querySelectorAll(".item-categoria").forEach((c) => c.classList.remove("aberto"));
      document.getElementById("selecao-atual").textContent = "Selecionado: " + especie.textContent.trim();

      if (typeof window.aoSelecionarEspecie === "function") {
        window.aoSelecionarEspecie(especie.dataset.tipo, especie.dataset.especie, especie.textContent.trim());
      }
      return;
    }

    // Celular: não existe "hover" — o toque na categoria abre/fecha o submenu
    const categoria = e.target.closest(".item-categoria");
    if (categoria && window.innerWidth <= 600) {
      const jaAberto = categoria.classList.contains("aberto");
      nav.querySelectorAll(".item-categoria").forEach((c) => c.classList.remove("aberto"));
      if (!jaAberto) categoria.classList.add("aberto");
    }
  });
});
