/* =====================================================================
   FRONT BEER — Navegação da área interna
   Constrói o menu lateral e a barra superior em todas as telas internas.
   A página se identifica por <body data-pagina="produtos|caixa|relatorios">.
   ===================================================================== */

const NAV = (() => {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const esc = UI.esc;

  const ICONES = {
    produtos:  '<path d="M4 7h16M4 12h16M4 17h10"/>',
    caixa:     '<rect x="2.5" y="7" width="19" height="12" rx="2"/><path d="M2.5 11h19M6 15h4"/>',
    relatorios:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
    cardapio:  '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
    qrcode:    '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2"/>',
    manual:    '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 8h7M9 12h7"/>',
    cartoes:   '<rect x="3" y="6" width="13" height="14" rx="2"/><path d="M8 6V4h13v14h-2"/><path d="M7 11h5M7 15h3"/>',
    sair:      '<path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/>',
    menu:      '<path d="M4 7h16M4 12h16M4 17h16"/>',
    externo:   '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };

  /* Títulos e subtítulos de cada tela */
  const PAGINAS = {
    produtos:   { titulo: "Produtos",   apoio: "Cadastro e preços do cardápio" },
    caixa:      { titulo: "Caixa",      apoio: "Lançamento das vendas do balcão" },
    relatorios: { titulo: "Relatórios", apoio: "Faturamento e desempenho do período" },
    cartoes:    { titulo: "Cartões de comanda", apoio: "Imprimir os cartões com QR Code" },
  };

  const MENU = [
    { grupo: "Operação" },
    { id: "caixa",      rotulo: "Caixa",      href: "caixa.html",      icone: "caixa" },
    { id: "produtos",   rotulo: "Produtos",   href: "admin.html",      icone: "produtos" },
    { id: "relatorios", rotulo: "Relatórios", href: "relatorios.html", icone: "relatorios" },
    { grupo: "Comandas" },
    { id: "cartoes",    rotulo: "Cartões",    href: "cartoes.html",    icone: "cartoes" },
    { grupo: "Divulgação" },
    { id: "cardapio",   rotulo: "Ver cardápio", href: "index.html",  icone: "cardapio", externo: true },
    { id: "qrcode",     rotulo: "QR Code",      href: "qrcode.html", icone: "qrcode",   externo: true },
    { grupo: "Ajuda" },
    { id: "manual",     rotulo: "Manual",     href: "manual.html",   icone: "manual",   externo: true },
  ];

  function svg(nome, classe) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round"' + (classe ? ' class="' + classe + '"' : "") + ">" +
           ICONES[nome] + "</svg>";
  }

  function marcaFormatada() {
    const nome = CFG.nome || "Painel";
    const d = CFG.nomeDestaque || "";
    return d && nome.indexOf(d) !== -1
      ? esc(nome).replace(esc(d), "<em>" + esc(d) + "</em>")
      : esc(nome);
  }

  function iniciais(email) {
    const base = String(email || "").split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").trim();
    const partes = base.split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)).toUpperCase();
  }

  function montarLateral(atual) {
    const itens = MENU.map((m) => {
      if (m.grupo) return '<div class="lateral__grupo">' + esc(m.grupo) + "</div>";
      return '<a class="item-nav' + (m.id === atual ? " ativo" : "") + '" href="' + m.href + '"' +
        (m.externo ? ' target="_blank" rel="noopener"' : "") +
        (m.id === atual ? ' aria-current="page"' : "") + ">" +
        svg(m.icone) + "<span>" + esc(m.rotulo) + "</span>" +
        (m.externo ? svg("externo", "externo") : "") +
      "</a>";
    }).join("");

    return '<div class="lateral__marca">' +
        '<img src="assets/img/emblema.png" alt="" width="40" height="40">' +
        "<div><strong>" + marcaFormatada() + "</strong><span>Área interna</span></div>" +
      "</div>" +
      '<nav class="lateral__nav" aria-label="Navegação principal">' + itens + "</nav>" +
      '<div class="lateral__pe">' +
        '<div class="conta">' +
          '<span class="conta__bola" id="contaIniciais">--</span>' +
          '<span class="conta__dados"><strong>Acesso da equipe</strong><span id="usuarioEmail"></span></span>' +
        "</div>" +
        '<button type="button" class="btn btn--fantasma btn--bloco btn--pequeno" id="btnSair">' +
          svg("sair") + "Sair</button>" +
      "</div>";
  }

  function montarBarra(atual, acoes) {
    const p = PAGINAS[atual] || { titulo: CFG.nome || "", apoio: "" };
    return '<button type="button" class="barra__abrir" id="abrirLateral" aria-label="Abrir menu">' +
        svg("menu") + "</button>" +
      '<div class="barra__titulo"><h1>' + esc(p.titulo) + "</h1>" +
        (p.apoio ? "<p>" + esc(p.apoio) + "</p>" : "") + "</div>" +
      '<div class="barra__acoes">' + (acoes || "") +
        (window.TEMA ? TEMA.botao() : "") + "</div>";
  }

  return {
    /* Monta a estrutura. `acoes` é HTML opcional para a direita da barra. */
    montar(acoes) {
      const atual = document.body.getAttribute("data-pagina") || "";
      const lateral = document.querySelector("[data-nav]");
      const barra = document.querySelector("[data-barra]");
      if (!lateral || !barra) return;

      lateral.innerHTML = montarLateral(atual);
      barra.innerHTML = montarBarra(atual, acoes);

      const veu = document.createElement("div");
      veu.className = "veu-lateral";
      document.body.appendChild(veu);

      function abrir() { lateral.classList.add("aberta"); veu.classList.add("visivel"); }
      function fechar() { lateral.classList.remove("aberta"); veu.classList.remove("visivel"); }

      document.getElementById("abrirLateral").addEventListener("click", abrir);
      veu.addEventListener("click", fechar);
      lateral.addEventListener("click", (e) => { if (e.target.closest(".item-nav")) fechar(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });

      const p = PAGINAS[atual];
      if (p) document.title = p.titulo + " | " + (CFG.nome || "");
    },

    /* Preenche os dados do usuário logado no rodapé do menu */
    definirUsuario(usuario) {
      const email = (usuario && usuario.email) || "";
      const bola = document.getElementById("contaIniciais");
      const alvo = document.getElementById("usuarioEmail");
      if (bola) bola.textContent = iniciais(email);
      if (alvo) alvo.textContent = email;
    },
  };
})();

window.NAV = NAV;
