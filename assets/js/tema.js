/* =====================================================================
   FRONT BEER — Tema claro e escuro

   A escolha fica salva no navegador de quem escolheu: o cliente que
   prefere claro não muda nada para o dono, e vice-versa. Sem escolha
   salva, segue a preferência do próprio aparelho.

   O tema é aplicado por um trecho no <head> de cada página, antes do
   CSS carregar, para a tela não piscar branca ao abrir.
   ===================================================================== */

const TEMA = (() => {
  "use strict";

  const CHAVE = "frontbeer:tema";

  function preferidoDoAparelho() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "claro" : "escuro";
  }

  function atual() {
    return document.documentElement.getAttribute("data-tema") || preferidoDoAparelho();
  }

  function aplicar(tema) {
    document.documentElement.setAttribute("data-tema", tema);
    const cor = tema === "claro" ? "#FAF7F1" : "#0A0908";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", cor);
    try { localStorage.setItem(CHAVE, tema); } catch (e) {}
    document.dispatchEvent(new CustomEvent("temamudou", { detail: { tema: tema } }));
  }

  function alternar() {
    aplicar(atual() === "claro" ? "escuro" : "claro");
  }

  /* HTML do botão, para as telas encaixarem onde fizer sentido */
  function botao() {
    return '<button type="button" class="btn-tema" data-tema-alternar ' +
      'aria-label="Alternar entre tema claro e escuro" title="Alternar tema">' +
      '<svg class="icone-claro" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round">' +
        '<circle cx="12" cy="12" r="4"/>' +
        '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' +
      "</svg>" +
      '<svg class="icone-escuro" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>' +
      "</svg></button>";
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-tema-alternar]")) alternar();
  });

  return { atual, aplicar, alternar, botao };
})();

window.TEMA = TEMA;
