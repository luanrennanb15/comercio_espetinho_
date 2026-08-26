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

  /* Marcas: desenhadas cheias, do jeito que o público reconhece. */
  const MARCAS = {
    zap:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.44 1.32 4.94L2.11 22l5.35-1.4a9.8 9.8 0 0 0 4.58 1.16h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.02-5.1-2.88-6.96A9.78 9.78 0 0 0 12.04 2Zm0 17.93h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.18.83.85-3.1-.2-.31a8.13 8.13 0 0 1-1.25-4.35c0-4.5 3.67-8.17 8.19-8.17 2.18 0 4.24.85 5.78 2.4a8.13 8.13 0 0 1 2.4 5.78c0 4.5-3.67 8.24-8.12 8.24Zm4.49-6.16c-.24-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.13-.16.24-.63.79-.77.96-.14.16-.28.18-.52.06-.25-.12-1.04-.38-1.97-1.22-.73-.65-1.22-1.45-1.36-1.7-.14-.24-.02-.37.11-.49.11-.11.24-.28.37-.43.12-.14.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.26 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.45-.59 1.66-1.17.2-.57.2-1.06.14-1.17-.06-.1-.22-.16-.46-.28Z"/></svg>',
    insta:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9c-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 5.18a4.66 4.66 0 1 0 0 9.32 4.66 4.66 0 0 0 0-9.32Zm0 7.69a3.03 3.03 0 1 1 0-6.06 3.03 3.03 0 0 1 0 6.06Zm5.93-7.87a1.09 1.09 0 1 1-2.18 0 1.09 1.09 0 0 1 2.18 0Z"/></svg>',
  };

  /* Mensagem já digitada: quem toca no botão só aperta enviar. */
  function linkZap() {
    const texto = "Olá! Vi o cardápio da " + (CFG.nome || "casa") + " e gostaria de tirar uma dúvida.";
    return "https://wa.me/" + encodeURIComponent(CFG.whatsapp) + "?text=" + encodeURIComponent(texto);
  }

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

    /* --- Redes em destaque ---
       WhatsApp e Instagram ganham botão próprio, com a cor da rede.
       O texto evita prometer pedido pelo aplicativo: a casa não entrega. */
    const redes = [];
    if (CFG.whatsapp) {
      redes.push('<a class="rede rede--whatsapp" href="' + linkZap() + '" target="_blank" rel="noopener noreferrer">' +
                 MARCAS.zap + "<span>Chamar no WhatsApp</span></a>");
    }
    if (CFG.instagram) {
      redes.push('<a class="rede rede--instagram" href="https://instagram.com/' + encodeURIComponent(CFG.instagram) +
                 '" target="_blank" rel="noopener noreferrer">' + MARCAS.insta + "<span>@" + esc(CFG.instagram) + "</span></a>");
    }
    const elRedes = $("#redesLoja");
    if (redes.length) elRedes.innerHTML = redes.join(""); else elRedes.remove();

    /* --- Endereço, horário e telefone --- */
    const dados = [];
    if (CFG.endereco) {
      dados.push(CFG.mapaUrl
        ? '<a href="' + esc(urlSegura(CFG.mapaUrl) || "#") + '" target="_blank" rel="noopener noreferrer">' +
          icone(ICONES.local) + esc(CFG.endereco) + "</a>"
        : "<span>" + icone(ICONES.local) + esc(CFG.endereco) + "</span>");
    }
    if (CFG.horario)  dados.push("<span>" + icone(ICONES.relogio) + esc(CFG.horario) + "</span>");
    if (CFG.telefone) dados.push('<a href="tel:' + esc(CFG.telefone.replace(/[^0-9+]/g, "")) + '">' + icone(ICONES.fone) + esc(CFG.telefone) + "</a>");
    $("#dadosLoja").innerHTML = dados.join("");

    /* --- Botão flutuante ---
       Fica sempre à mão para tirar dúvida. Não é botão de pedido:
       o consumo é no local, e prometer atendimento por aqui frustraria. */
    if (CFG.whatsapp) {
      const flutuante = document.createElement("a");
      flutuante.className = "zap-flutuante";
      flutuante.href = linkZap();
      flutuante.target = "_blank";
      flutuante.rel = "noopener noreferrer";
      flutuante.setAttribute("aria-label", "Tirar dúvida pelo WhatsApp");
      flutuante.innerHTML = MARCAS.zap + "<span>Tirar dúvida</span>";
      document.body.appendChild(flutuante);
    }

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
  function linhaItem(p, secaoComFotos) {
    const foto = urlSegura(p.imagem_url);
    const selos = [];
    if (p.esgotado)  selos.push('<span class="selo selo--erro">Esgotado hoje</span>');
    if (p.alcoolico) selos.push('<span class="selo selo--ouro" title="Venda proibida para menores de ' +
                                esc(CFG.idadeMinima || 18) + ' anos">' + esc(CFG.idadeMinima || 18) + "+</span>");

    /* Quando a seção tem fotos, TODOS os itens ganham um quadro do mesmo
       tamanho — com foto ou com o marcador — para as linhas ficarem
       alinhadas. Sem nenhuma foto, mantém-se o cardápio clássico com a
       linha pontilhada ligando o nome ao preço. */
    let quadro = "";
    if (secaoComFotos) {
      quadro = foto
        ? '<img class="item__foto" src="' + esc(foto) + '" alt="' + esc(p.nome) +
          '" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
        : '<span class="item__foto item__foto--vazia" aria-hidden="true">' +
          '<img src="assets/img/emblema.png" alt="" loading="lazy"></span>';
    }

    /* Formato clássico de cardápio: nome, pontilhada e preço na MESMA
       linha; a descrição vai embaixo, ocupando a largura toda.
       A pontilhada aparece quando existe descrição — é ela que amarra o
       nome ao preço quando o olho precisa descer para ler o texto. */
    const temDescricao = !!p.descricao;

    return '<article class="item' + (p.esgotado ? " item--esgotado" : "") +
      (secaoComFotos ? " item--ilustrado" : "") + '">' +
      quadro +
      '<div class="item__corpo">' +
        '<div class="item__linha">' +
          '<h3 class="item__nome">' + esc(p.nome) + "</h3>" +
          (temDescricao ? '<span class="item__pontos" aria-hidden="true"></span>' : "") +
          '<span class="item__preco">' + moeda(p.preco) + "</span>" +
        "</div>" +
        (temDescricao ? '<p class="item__desc">' + esc(p.descricao) + "</p>" : "") +
        (selos.length ? '<div class="item__selos">' + selos.join("") + "</div>" : "") +
      "</div>" +
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
      const comFotos = itens.some((p) => !!urlSegura(p.imagem_url));
      return '<section class="secao">' +
        '<header class="secao__cabeca">' +
          "<h2>" + esc(cat) + "</h2>" +
          '<div class="filete"><span>' + itens.length + (itens.length === 1 ? " item" : " itens") + "</span></div>" +
        "</header>" +
        '<div class="itens' + (comFotos ? " itens--ilustrados" : "") + '">' +
          itens.map((p) => linhaItem(p, comFotos)).join("") +
        "</div>" +
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
    $("#acoesTopo").innerHTML = TEMA.botao();
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
