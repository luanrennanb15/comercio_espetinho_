/* =====================================================================
   FRONT BEER — Utilidades de interface
   Sem dependências externas. Carregar antes dos demais scripts.
   ===================================================================== */

const UI = (() => {
  "use strict";

  const MAPA_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  /* Escapa HTML — usado em TODO dado vindo do banco (proteção contra XSS) */
  function esc(valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, (c) => MAPA_ESCAPE[c]);
  }

  /* Só permite imagens http/https (bloqueia javascript:, data:, etc.) */
  function urlSegura(valor) {
    const s = String(valor || "").trim();
    return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
  }

  function moeda(valor) {
    return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  /* Remove acentos para busca tolerante ("acai" encontra "açaí") */
  function chave(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.prototype.slice.call((raiz || document).querySelectorAll(sel));

  /* ---------------- Avisos flutuantes ---------------- */
  function caixaAvisos() {
    let caixa = document.getElementById("avisos");
    if (!caixa) {
      caixa = document.createElement("div");
      caixa.id = "avisos";
      caixa.setAttribute("role", "status");
      caixa.setAttribute("aria-live", "polite");
      document.body.appendChild(caixa);
    }
    return caixa;
  }

  function avisar(mensagem, tipo) {
    const el = document.createElement("div");
    el.className = "aviso-flutuante" + (tipo ? " aviso-flutuante--" + tipo : "");
    el.textContent = mensagem;
    caixaAvisos().appendChild(el);
    setTimeout(() => {
      el.classList.add("saindo");
      setTimeout(() => el.remove(), 240);
    }, tipo === "erro" ? 5200 : 3200);
  }

  /* ---------------- Modais ---------------- */
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("aberto");
    document.body.style.overflow = "hidden";
    const foco = m.querySelector("input:not([type=hidden]), textarea, button");
    if (foco) setTimeout(() => foco.focus(), 40);
  }

  function fecharModal(id) {
    const m = typeof id === "string" ? document.getElementById(id) : id;
    if (!m) return;
    m.classList.remove("aberto");
    if (!document.querySelector(".modal-fundo.aberto")) document.body.style.overflow = "";
  }

  function fecharTodosModais() {
    $$(".modal-fundo.aberto").forEach(fecharModal);
  }

  /* Confirmação própria (substitui window.confirm, que trava a página) */
  function confirmar(opcoes) {
    const o = Object.assign(
      { titulo: "Confirmar", texto: "", confirmar: "Confirmar", cancelar: "Cancelar", perigo: false },
      opcoes || {}
    );
    return new Promise((resolver) => {
      const fundo = document.createElement("div");
      fundo.className = "modal-fundo aberto";
      fundo.innerHTML =
        '<div class="modal modal--estreito" role="dialog" aria-modal="true">' +
          '<div class="modal__cabeca"><h2>' + esc(o.titulo) + "</h2></div>" +
          '<div class="modal__corpo"><p style="margin:0;color:var(--texto-suave);font-size:.9rem;line-height:1.6">' +
            esc(o.texto).replace(/\n/g, "<br>") +
          "</p></div>" +
          '<div class="modal__pe">' +
            '<button type="button" class="btn btn--fantasma" data-r="0">' + esc(o.cancelar) + "</button>" +
            '<button type="button" class="btn' + (o.perigo ? " btn--perigo" : "") + '" data-r="1">' + esc(o.confirmar) + "</button>" +
          "</div>" +
        "</div>";
      document.body.appendChild(fundo);
      document.body.style.overflow = "hidden";

      function encerrar(resposta) {
        fundo.remove();
        if (!document.querySelector(".modal-fundo.aberto")) document.body.style.overflow = "";
        document.removeEventListener("keydown", aoTeclar);
        resolver(resposta);
      }
      function aoTeclar(e) { if (e.key === "Escape") encerrar(false); }

      fundo.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-r]");
        if (btn) return encerrar(btn.getAttribute("data-r") === "1");
        if (e.target === fundo) encerrar(false);
      });
      document.addEventListener("keydown", aoTeclar);
      setTimeout(() => fundo.querySelector('button[data-r="1"]').focus(), 40);
    });
  }

  /* ---------------- Comportamento global de modais ---------------- */
  document.addEventListener("click", (e) => {
    const fechar = e.target.closest("[data-fechar]");
    if (fechar) { fecharModal(fechar.closest(".modal-fundo")); return; }
    if (e.target.classList && e.target.classList.contains("modal-fundo")) fecharModal(e.target);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharTodosModais();
  });

  return { esc, urlSegura, moeda, chave, $, $$, avisar, abrirModal, fecharModal, fecharTodosModais, confirmar };
})();

window.UI = UI;
