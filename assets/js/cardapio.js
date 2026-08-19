/* =====================================================================
   FRONT BEER — Cardápio público
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, urlSegura, moeda, chave, $, $$ } = UI;

  const estado = { produtos: [], categoria: "Todos", termo: "" };

  const elLista  = $("#cardapio");
  const elAbas   = $("#abas");
  const elBusca  = $("#busca");

  /* ---------------- Cabeçalho e rodapé ---------------- */
  function icone(caminho) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
           'stroke-linecap="round" stroke-linejoin="round" width="15" height="15">' + caminho + "</svg>";
  }

  const ICONES = {
    local:  '<path d="M12 21s-7-5.686-7-11a7 7 0 1 1 14 0c0 5.314-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
    relogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    insta:  '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1"/>',
    fone:   '<path d="M4.5 5.5c0 8 6 14 14 14l1.8-3.4-4-1.9-1.7 1.9a12.4 12.4 0 0 1-6.7-6.7l1.9-1.7-1.9-4Z"/>',
    zap:    '<path d="M20 11.5a8 8 0 0 1-11.9 7L4 20l1.6-3.9A8 8 0 1 1 20 11.5Z"/>',
  };

  function montarIdentidade() {
    const nome = CFG.nome || "Cardápio";
    const destaque = CFG.nomeDestaque || "";
    const marcado = destaque && nome.indexOf(destaque) !== -1
      ? esc(nome).replace(esc(destaque), "<em>" + esc(destaque) + "</em>")
      : esc(nome);

    document.title = nome + (CFG.segmento ? " — " + CFG.segmento : "") + " | Cardápio";
    $$("[data-marca]").forEach((el) => { el.innerHTML = marcado; });
    $$("[data-segmento]").forEach((el) => { el.textContent = CFG.segmento || ""; });

    const lema = $("#lema");
    if (CFG.lema) lema.textContent = CFG.lema; else lema.remove();

    /* Contatos */
    const dados = [];
    if (CFG.endereco) {
      dados.push(CFG.mapaUrl
        ? '<a href="' + esc(urlSegura(CFG.mapaUrl) || "#") + '" target="_blank" rel="noopener noreferrer">' +
          icone(ICONES.local) + esc(CFG.endereco) + "</a>"
        : "<span>" + icone(ICONES.local) + esc(CFG.endereco) + "</span>");
    }
    if (CFG.horario)  dados.push("<span>" + icone(ICONES.relogio) + esc(CFG.horario) + "</span>");
    if (CFG.telefone) dados.push('<a href="tel:' + esc(CFG.telefone.replace(/[^0-9+]/g, "")) + '">' + icone(ICONES.fone) + esc(CFG.telefone) + "</a>");
    if (CFG.whatsapp) dados.push('<a href="https://wa.me/' + encodeURIComponent(CFG.whatsapp) + '" target="_blank" rel="noopener noreferrer">' + icone(ICONES.zap) + "WhatsApp</a>");
    if (CFG.instagram) dados.push('<a href="https://instagram.com/' + encodeURIComponent(CFG.instagram) + '" target="_blank" rel="noopener noreferrer">' + icone(ICONES.insta) + "@" + esc(CFG.instagram) + "</a>");
    $("#dadosLoja").innerHTML = dados.join("");

    /* Rodapé */
    $("#idadeMinima").textContent = String(CFG.idadeMinima || 18);
    $("#avisoOperacao").textContent = CFG.avisoOperacao || "";
    const info = [];
    if (CFG.endereco) info.push(esc(CFG.endereco));
    if (CFG.horario)  info.push(esc(CFG.horario));
    if (CFG.instagram) info.push('<a href="https://instagram.com/' + encodeURIComponent(CFG.instagram) + '" target="_blank" rel="noopener noreferrer">@' + esc(CFG.instagram) + "</a>");
    $("#rodapeInfo").innerHTML = info.join("");

    if (CFG.credito) {
      $("#credito").innerHTML = "Desenvolvido por " + (CFG.creditoUrl
        ? '<a href="' + esc(urlSegura(CFG.creditoUrl) || "#") + '" target="_blank" rel="noopener noreferrer">' + esc(CFG.credito) + "</a>"
        : esc(CFG.credito));
    }
  }

  /* ---------------- Filtros ---------------- */
  function categorias() {
    const vistas = [];
    estado.produtos.forEach((p) => { if (vistas.indexOf(p.categoria) === -1) vistas.push(p.categoria); });
    return vistas;
  }

  function desenharAbas() {
    const lista = ["Todos"].concat(categorias());
    elAbas.innerHTML = lista.map((c) =>
      '<button type="button" class="aba' + (c === estado.categoria ? " ativa" : "") +
      '" data-cat="' + esc(c) + '">' + esc(c) + "</button>"
    ).join("");
  }

  function filtrar() {
    const t = chave(estado.termo);
    return estado.produtos.filter((p) => {
      const casaCat = estado.categoria === "Todos" || p.categoria === estado.categoria;
      if (!casaCat) return false;
      if (!t) return true;
      return chave(p.nome).indexOf(t) !== -1 ||
             chave(p.descricao).indexOf(t) !== -1 ||
             chave(p.categoria).indexOf(t) !== -1;
    });
  }

  /* ---------------- Desenho ---------------- */
  function linhaItem(p) {
    const foto = urlSegura(p.imagem_url);
    const selos = [];
    if (p.esgotado)  selos.push('<span class="selo selo--erro">Esgotado hoje</span>');
    if (p.alcoolico) selos.push('<span class="selo selo--ouro" title="Venda proibida para menores de ' +
                                esc(CFG.idadeMinima || 18) + ' anos">' + esc(CFG.idadeMinima || 18) + "+</span>");

    return '<article class="item' + (p.esgotado ? " item--esgotado" : "") + '">' +
      (foto ? '<img class="item__foto" src="' + esc(foto) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : "") +
      '<div class="item__corpo">' +
        '<h3 class="item__nome">' + esc(p.nome) + "</h3>" +
        (p.descricao ? '<p class="item__desc">' + esc(p.descricao) + "</p>" : "") +
        (selos.length ? '<div class="item__selos">' + selos.join("") + "</div>" : "") +
      "</div>" +
      '<span class="item__pontos" aria-hidden="true"></span>' +
      '<span class="item__preco">' + moeda(p.preco) + "</span>" +
    "</article>";
  }

  function desenhar() {
    const lista = filtrar();

    if (!estado.produtos.length) {
      elLista.innerHTML = '<div class="vazio"><strong>Cardápio em atualização</strong>' +
        "Nossos itens estão sendo cadastrados. Consulte o atendente.</div>";
      return;
    }
    if (!lista.length) {
      elLista.innerHTML = '<div class="vazio"><strong>Nada encontrado</strong>' +
        "Tente outro termo ou toque em “Todos”.</div>";
      return;
    }

    const grupos = {};
    const ordem = [];
    lista.forEach((p) => {
      if (!grupos[p.categoria]) { grupos[p.categoria] = []; ordem.push(p.categoria); }
      grupos[p.categoria].push(p);
    });

    elLista.innerHTML = ordem.map((cat) => {
      const itens = grupos[cat];
      return '<section class="secao">' +
        '<header class="secao__cabeca">' +
          "<h2>" + esc(cat) + "</h2>" +
          '<div class="filete"><span>' + itens.length + (itens.length === 1 ? " item" : " itens") + "</span></div>" +
        "</header>" +
        '<div class="itens">' + itens.map(linhaItem).join("") + "</div>" +
      "</section>";
    }).join("");
  }

  /* ---------------- Eventos ---------------- */
  elBusca.addEventListener("input", (e) => { estado.termo = e.target.value; desenhar(); });

  elAbas.addEventListener("click", (e) => {
    const aba = e.target.closest(".aba");
    if (!aba) return;
    estado.categoria = aba.getAttribute("data-cat");
    desenharAbas();
    desenhar();
    if (aba.scrollIntoView) aba.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  });

  const btnTopo = $("#aoTopo");
  const topoFixo = $("#topoFixo");
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    btnTopo.classList.toggle("visivel", y > 620);
    topoFixo.classList.toggle("rolado", y > 10);
  }, { passive: true });
  btnTopo.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* Atalho: "/" foca a busca */
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== elBusca) { e.preventDefault(); elBusca.focus(); }
  });

  /* ---------------- Início ---------------- */
  (async function iniciar() {
    montarIdentidade();
    try {
      await DB.init();
      estado.produtos = await DB.listarProdutos(true);
      desenharAbas();
      desenhar();
      const marca = $("#atualizacao");
      if (marca) {
        marca.textContent = "Cardápio atualizado em " + new Date().toLocaleDateString("pt-BR") +
          (DB.modo === "demo" ? " · modo demonstração" : "");
      }
    } catch (e) {
      console.error(e);
      elLista.innerHTML = '<div class="vazio"><strong>Não foi possível carregar o cardápio</strong>' +
        "Verifique sua conexão e tente novamente em instantes.</div>";
    }
  })();
})();
