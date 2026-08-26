/* =====================================================================
   FRONT BEER — Caixa
   Duas formas de vender:
     comanda      -> cartão numerado que fica com o cliente na mesa
     venda rápida -> balcão, cliente compra e vai embora
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, moeda, chave, $, $$, avisar, confirmar } = UI;

  NAV.montar();

  let produtos = [];
  let custos = {};
  let comandas = [];
  let vendasHoje = [];

  let vista = "quadro";          // quadro | rapida | comanda
  let comandaAtual = null;       // objeto da comanda aberta
  const carrinho = [];           // usado só na venda rápida
  let pagamento = "dinheiro";

  /* ---------------- Acesso ---------------- */
  $("#formAcesso").addEventListener("submit", async function (e) {
    e.preventDefault();
    $$("#erroAcesso, #erroAcessoBaixo").forEach((el) => el.classList.add("oculto"));
    const btn = $("#btnEntrar");
    btn.disabled = true;
    try {
      const usuario = await DB.login($("#email").value, $("#senha").value);
      $("#senha").value = "";
      await abrirCaixa(usuario);
    } catch (err) {
      $$("#erroAcesso, #erroAcessoBaixo").forEach((el) => {
        el.textContent = err.message || "Não foi possível entrar.";
        el.classList.remove("oculto");
      });
      console.error("Falha no login:", err);
    } finally {
      btn.disabled = false;
    }
  });

  $("#btnSair").addEventListener("click", async function () {
    if (vista === "comanda" && !(await confirmar({
      titulo: "Sair do caixa",
      texto: "Há uma comanda aberta na tela. Ela continua salva, mas você sairá do sistema. Continuar?",
      confirmar: "Sair", perigo: true,
    }))) return;
    await DB.logout();
    location.reload();
  });

  async function abrirCaixa(usuario) {
    NAV.definirUsuario(usuario || (await DB.usuarioAtual()));
    $("#telaAcesso").classList.add("oculto");
    $("#telaCaixa").classList.remove("oculto");
    await carregarProdutos();
    await recarregarComandas();
    await carregarVendasDoDia();
    mostrarVista("quadro");
  }

  /* ---------------- Navegação entre as vistas ---------------- */
  function mostrarVista(nova) {
    vista = nova;
    const noQuadro = nova === "quadro";
    $("#vistaQuadro").classList.toggle("oculto", !noQuadro);
    $("#vistaVenda").classList.toggle("oculto", noQuadro);
    $("#comandaCabeca").classList.toggle("oculto", nova !== "comanda");
    $("#areaUltimas").classList.toggle("oculto", nova === "comanda");

    $$(".aba-caixa").forEach((b) => {
      const alvo = b.getAttribute("data-vista");
      b.classList.toggle("ativa", alvo === (nova === "comanda" ? "quadro" : nova));
    });

    $("#tituloPainel").textContent = nova === "comanda" ? "Consumo da comanda" : "Venda atual";
    $("#btnFechar").textContent = nova === "comanda" ? "Fechar conta" : "Fechar venda";
    $("#btnCancelar").textContent = nova === "comanda" ? "Cancelar comanda" : "Cancelar venda";

    if (nova !== "quadro") {
      $("#buscaProduto").value = "";
      desenharCatalogo();
      $("#buscaProduto").focus();
    }
    desenharPainel();
  }

  $$(".aba-caixa").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const alvo = btn.getAttribute("data-vista");
      if (alvo === "quadro") { comandaAtual = null; await recarregarComandas(); mostrarVista("quadro"); }
      else { comandaAtual = null; carrinho.length = 0; mostrarVista("rapida"); }
    });
  });

  $("#btnVoltarQuadro").addEventListener("click", async function () {
    comandaAtual = null;
    await recarregarComandas();
    mostrarVista("quadro");
  });

  /* ---------------- Quadro de comandas ---------------- */
  async function recarregarComandas() {
    try {
      comandas = await DB.listarComandas();
      if (comandaAtual) {
        comandaAtual = comandas.find((c) => c.id === comandaAtual.id) || null;
      }
      desenharQuadro();
      atualizarSalao();
    } catch (e) {
      avisar(e.message || "Falha ao carregar as comandas.", "erro");
    }
  }

  function totalComanda(c) {
    return Math.round((c.itens || []).reduce((s, i) => s + i.preco_unit * i.quantidade, 0) * 100) / 100;
  }

  function tempoAberta(c) {
    if (!c.aberta_em) return "";
    const min = Math.max(0, Math.round((Date.now() - new Date(c.aberta_em)) / 60000));
    if (min < 60) return min + " min";
    return Math.floor(min / 60) + "h" + String(min % 60).padStart(2, "0");
  }

  function desenharQuadro() {
    const alvo = $("#gradeComandas");
    if (!comandas.length) {
      alvo.innerHTML = '<div class="estado-vazio"><h3>Nenhuma comanda cadastrada</h3>' +
        "<p>Rode o arquivo supabase/comandas.sql para criar os cartões.</p></div>";
      return;
    }
    alvo.innerHTML = comandas.map(function (c) {
      const emUso = c.status === "em_uso";
      return '<button type="button" class="cartao-comanda cartao-comanda--' +
        (emUso ? "uso" : "livre") + '" data-id="' + esc(c.id) + '">' +
        '<span class="cartao-comanda__numero">' + esc(c.numero) + "</span>" +
        '<span class="cartao-comanda__estado">' + (emUso ? "Em uso" : "Livre") + "</span>" +
        (emUso
          ? '<span class="cartao-comanda__valor">' + moeda(totalComanda(c)) + "</span>" +
            '<span class="cartao-comanda__tempo">há ' + tempoAberta(c) + "</span>"
          : "") +
      "</button>";
    }).join("");
  }

  function atualizarSalao() {
    const abertas = comandas.filter((c) => c.status === "em_uso");
    const soma = abertas.reduce((s, c) => s + totalComanda(c), 0);
    $("#salaoAbertas").textContent = abertas.length;
    $("#salaoValor").textContent = moeda(soma);
  }

  $("#gradeComandas").addEventListener("click", async function (e) {
    const btn = e.target.closest(".cartao-comanda");
    if (!btn) return;
    const c = comandas.find((x) => x.id === btn.getAttribute("data-id"));
    if (!c) return;

    if (c.status === "livre") {
      const ok = await confirmar({
        titulo: "Abrir comanda " + c.numero,
        texto: "Entregue o cartão " + c.numero + " ao cliente e comece a lançar o consumo.",
        confirmar: "Abrir comanda",
      });
      if (!ok) return;
      try {
        await DB.abrirComanda(c.id);
        await recarregarComandas();
        comandaAtual = comandas.find((x) => x.id === c.id);
        avisar("Comanda " + c.numero + " aberta.", "ok");
      } catch (err) { avisar(err.message, "erro"); return; }
    } else {
      comandaAtual = c;
    }
    mostrarVista("comanda");
  });

  /* ---------------- Catálogo ---------------- */
  async function carregarProdutos() {
    try {
      produtos = (await DB.listarProdutos(false)).filter((p) => p.ativo);
      custos = await DB.listarCustos();
      desenharCatalogo();
    } catch (e) {
      avisar(e.message || "Falha ao carregar os produtos.", "erro");
    }
  }

  function produtosFiltrados() {
    const t = chave($("#buscaProduto").value);
    if (!t) return produtos;
    return produtos.filter((p) => chave(p.nome).indexOf(t) !== -1 || chave(p.categoria).indexOf(t) !== -1);
  }

  function quantidadeLancada(id) {
    if (vista === "comanda" && comandaAtual) {
      return (comandaAtual.itens || [])
        .filter((i) => i.nome === (produtos.find((p) => p.id === id) || {}).nome)
        .reduce((s, i) => s + i.quantidade, 0);
    }
    const item = carrinho.find((i) => i.id === id);
    return item ? item.qtd : 0;
  }

  function desenharCatalogo() {
    const lista = produtosFiltrados();
    const alvo = $("#catalogo");

    if (!produtos.length) {
      alvo.innerHTML = '<div class="estado-vazio"><h3>Nenhum produto cadastrado</h3>' +
        "<p>Cadastre o cardápio em Produtos para começar a vender.</p></div>";
      return;
    }
    if (!lista.length) {
      alvo.innerHTML = '<div class="estado-vazio"><h3>Nada encontrado</h3><p>Tente outro termo.</p></div>';
      return;
    }

    const grupos = {};
    const ordem = [];
    lista.forEach((p) => {
      if (!grupos[p.categoria]) { grupos[p.categoria] = []; ordem.push(p.categoria); }
      grupos[p.categoria].push(p);
    });

    alvo.innerHTML = ordem.map((cat) =>
      '<div class="catalogo__grupo">' +
        '<div class="catalogo__titulo">' + esc(cat) + "</div>" +
        '<div class="grade-produtos">' + grupos[cat].map(cartao).join("") + "</div>" +
      "</div>"
    ).join("");
  }

  function cartao(p) {
    const qtd = quantidadeLancada(p.id);
    return '<button type="button" class="cartao-produto' + (p.esgotado ? " cartao-produto--esgotado" : "") +
      '" data-id="' + esc(p.id) + '"' + (p.esgotado ? " disabled" : "") + ">" +
      '<span class="cartao-produto__nome">' + esc(p.nome) + (p.esgotado ? " (esgotado)" : "") + "</span>" +
      '<span class="cartao-produto__pe">' +
        '<span class="cartao-produto__preco">' + moeda(p.preco) + "</span>" +
        (qtd ? '<span class="cartao-produto__qtd">' + qtd + "</span>" : "") +
      "</span></button>";
  }

  $("#catalogo").addEventListener("click", function (e) {
    const btn = e.target.closest(".cartao-produto");
    if (!btn || btn.disabled) return;
    lancar(btn.getAttribute("data-id"));
  });

  const campoBusca = $("#buscaProduto");
  campoBusca.addEventListener("input", desenharCatalogo);
  campoBusca.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const primeiro = produtosFiltrados().filter((p) => !p.esgotado)[0];
    if (!primeiro) { avisar("Nenhum produto disponível para esse termo.", "erro"); return; }
    lancar(primeiro.id);
    campoBusca.select();
  });

  /* ---------------- Lançamento ---------------- */
  async function lancar(id) {
    const p = produtos.find((x) => x.id === id);
    if (!p || p.esgotado) return;

    if (vista === "comanda" && comandaAtual) {
      try {
        await DB.lancarItem(comandaAtual.id, {
          produto_id: p.id, nome: p.nome, categoria: p.categoria,
          preco_unit: p.preco, quantidade: 1,
          custo_unit: DB.custoUnitario(custos[p.id]),
        });
        await recarregarComandas();
        desenharPainel();
        desenharCatalogo();
      } catch (err) { avisar(err.message, "erro"); }
      return;
    }

    const existente = carrinho.find((i) => i.id === id);
    if (existente) existente.qtd += 1;
    else carrinho.push({ id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco, qtd: 1 });
    desenharPainel();
    desenharCatalogo();
  }

  /* ---------------- Painel lateral ---------------- */
  function itensDoPainel() {
    if (vista === "comanda" && comandaAtual) {
      return (comandaAtual.itens || []).map((i) => ({
        chave: i.id, nome: i.nome, preco: i.preco_unit, qtd: i.quantidade,
        hora: new Date(i.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        daComanda: true,
      }));
    }
    return carrinho.map((i) => ({ chave: i.id, nome: i.nome, preco: i.preco, qtd: i.qtd, daComanda: false }));
  }

  function totalPainel() {
    return Math.round(itensDoPainel().reduce((s, i) => s + i.preco * i.qtd, 0) * 100) / 100;
  }

  function desenharPainel() {
    const itens = itensDoPainel();
    const alvo = $("#comandaItens");
    const unidades = itens.reduce((s, i) => s + i.qtd, 0);

    if (vista === "comanda" && comandaAtual) {
      $("#comandaNumero").textContent = comandaAtual.numero;
      $("#comandaNumero2").textContent = comandaAtual.numero;
      $("#comandaAberta").textContent = comandaAtual.aberta_em
        ? "Aberta há " + tempoAberta(comandaAtual)
        : "";
    }

    if (!itens.length) {
      alvo.innerHTML = '<div class="comanda__vazia">Toque nos produtos ao lado<br>para lançar.</div>';
    } else {
      alvo.innerHTML = itens.map((i) =>
        '<div class="comanda-item" data-chave="' + esc(i.chave) + '">' +
          '<div class="comanda-item__nome">' + esc(i.nome) + "</div>" +
          '<div class="comanda-item__total">' + moeda(i.preco * i.qtd) + "</div>" +
          '<div class="comanda-item__unit">' + moeda(i.preco) + " a unidade" +
            (i.hora ? ' <span class="item-comanda__hora">· ' + esc(i.hora) + "</span>" : "") +
            '<div class="contador">' +
              (i.daComanda
                ? '<button type="button" class="remover" data-acao="remover">remover</button>'
                : '<button type="button" data-acao="menos" aria-label="Diminuir">&minus;</button>' +
                  "<span>" + i.qtd + "</span>" +
                  '<button type="button" data-acao="mais" aria-label="Aumentar">+</button>' +
                  '<button type="button" class="remover" data-acao="remover">remover</button>') +
            "</div>" +
          "</div>" +
        "</div>"
      ).join("");
    }

    $("#contagemItens").textContent = unidades
      ? unidades + (unidades === 1 ? " item" : " itens")
      : "nenhum item";
    $("#comandaTotal").textContent = moeda(totalPainel());
    $("#btnFechar").disabled = itens.length === 0;
  }

  $("#comandaItens").addEventListener("click", async function (e) {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    const chaveItem = btn.closest(".comanda-item").getAttribute("data-chave");
    const acao = btn.getAttribute("data-acao");

    if (vista === "comanda" && comandaAtual) {
      if (acao !== "remover") return;
      try {
        await DB.removerItemComanda(comandaAtual.id, chaveItem);
        await recarregarComandas();
        desenharPainel();
        desenharCatalogo();
      } catch (err) { avisar(err.message, "erro"); }
      return;
    }

    const item = carrinho.find((i) => i.id === chaveItem);
    if (!item) return;
    if (acao === "mais") item.qtd += 1;
    else if (acao === "menos") item.qtd -= 1;
    else item.qtd = 0;
    if (item.qtd <= 0) carrinho.splice(carrinho.indexOf(item), 1);
    desenharPainel();
    desenharCatalogo();
  });

  $("#pagamentos").addEventListener("click", function (e) {
    const btn = e.target.closest(".pagamento");
    if (!btn) return;
    pagamento = btn.getAttribute("data-pg");
    $$(".pagamento").forEach((b) => b.classList.toggle("ativo", b === btn));
  });

  /* ---------------- Cancelar ---------------- */
  $("#btnCancelar").addEventListener("click", async function () {
    if (vista === "comanda" && comandaAtual) {
      const ok = await confirmar({
        titulo: "Cancelar comanda " + comandaAtual.numero,
        texto: "Todo o consumo lançado será descartado e o cartão volta a ficar livre.\nUse apenas quando o cliente não consumiu nada ou o lançamento foi todo errado.",
        confirmar: "Descartar e liberar", perigo: true,
      });
      if (!ok) return;
      try {
        await DB.liberarComanda(comandaAtual.id);
        avisar("Comanda " + comandaAtual.numero + " liberada.", "ok");
        comandaAtual = null;
        await recarregarComandas();
        mostrarVista("quadro");
      } catch (err) { avisar(err.message, "erro"); }
      return;
    }

    if (!carrinho.length) return;
    const ok = await confirmar({
      titulo: "Cancelar venda",
      texto: "Descartar os itens desta venda?",
      confirmar: "Descartar", perigo: true,
    });
    if (!ok) return;
    limparVendaRapida();
  });

  function limparVendaRapida() {
    carrinho.length = 0;
    $("#observacao").value = "";
    campoBusca.value = "";
    desenharPainel();
    desenharCatalogo();
    campoBusca.focus();
  }

  /* ---------------- Fechamento ---------------- */
  $("#btnFechar").addEventListener("click", async function () {
    const itens = itensDoPainel();
    if (!itens.length) return;
    const btn = $("#btnFechar");
    const rotulo = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Registrando...";

    try {
      if (vista === "comanda" && comandaAtual) {
        const numero = comandaAtual.numero;
        const total = totalPainel();
        await DB.fecharComanda(comandaAtual.id, pagamento, $("#observacao").value);
        avisar("Comanda " + numero + " fechada — " + moeda(total) + ".", "ok");
        comandaAtual = null;
        $("#observacao").value = "";
        await recarregarComandas();
        await carregarVendasDoDia();
        mostrarVista("quadro");
      } else {
        const total = totalPainel();
        await DB.registrarVenda({
          pagamento: pagamento,
          observacao: $("#observacao").value,
          itens: carrinho.map((i) => ({
            produto_id: i.id, nome: i.nome, categoria: i.categoria,
            preco_unit: i.preco, quantidade: i.qtd,
            custo_unit: DB.custoUnitario(custos[i.id]),
          })),
        });
        avisar("Venda de " + moeda(total) + " registrada.", "ok");
        limparVendaRapida();
        await carregarVendasDoDia();
      }
    } catch (err) {
      avisar(err.message || "Falha ao registrar.", "erro");
    } finally {
      btn.textContent = rotulo;
      btn.disabled = itensDoPainel().length === 0;
    }
  });

  /* ---------------- Vendas do dia ---------------- */
  async function carregarVendasDoDia() {
    try {
      const hoje = new Date();
      vendasHoje = await DB.listarVendas(hoje, hoje);
      const total = vendasHoje.reduce((s, v) => s + v.total, 0);

      $("#diaQtd").textContent = vendasHoje.length;
      $("#diaTotal").textContent = moeda(total);
      $("#diaTicket").textContent = vendasHoje.length ? moeda(total / vendasHoje.length) : "—";

      const alvo = $("#ultimasVendas");
      if (!vendasHoje.length) {
        alvo.innerHTML = '<p style="font-size:.82rem;color:var(--texto-fraco)">Nenhuma venda registrada hoje.</p>';
        return;
      }
      alvo.innerHTML = vendasHoje.slice(0, 8).map((v) => {
        const resumo = (v.itens || []).map((i) => i.quantidade + "x " + i.nome).join(", ");
        const origem = v.comanda_numero ? "Comanda " + v.comanda_numero + " · " : "";
        return '<div class="ultima-venda" data-id="' + esc(v.id) + '">' +
          '<span class="ultima-venda__hora">' +
            new Date(v.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "</span>" +
          '<span class="ultima-venda__itens" title="' + esc(resumo) + '">' +
            esc(origem + (resumo || "—")) + "</span>" +
          '<span class="ultima-venda__valor">' + moeda(v.total) + "</span>" +
          '<button type="button" data-estornar aria-label="Estornar venda">estornar</button>' +
        "</div>";
      }).join("");
    } catch (e) {
      avisar(e.message || "Falha ao carregar as vendas do dia.", "erro");
    }
  }

  $("#ultimasVendas").addEventListener("click", async function (e) {
    const btn = e.target.closest("button[data-estornar]");
    if (!btn) return;
    const id = btn.closest(".ultima-venda").getAttribute("data-id");
    const venda = vendasHoje.find((v) => v.id === id);
    const ok = await confirmar({
      titulo: "Estornar venda",
      texto: "Apagar a venda de " + moeda(venda ? venda.total : 0) + " do relatório?\nUse apenas em caso de lançamento errado.",
      confirmar: "Estornar", perigo: true,
    });
    if (!ok) return;
    try {
      await DB.excluirVenda(id);
      avisar("Venda estornada.", "ok");
      await carregarVendasDoDia();
    } catch (err) { avisar(err.message, "erro"); }
  });

  /* ---------------- Atalhos ---------------- */
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" && e.key !== "Escape" && e.key !== "F2") return;
    if (e.key === "F2" && vista !== "quadro") { e.preventDefault(); $("#btnFechar").click(); }
    if (e.key === "Escape" && !document.querySelector(".modal-fundo.aberto") && vista !== "quadro") {
      campoBusca.focus();
    }
  });

  /* Mantém o tempo das comandas em dia sem recarregar a página */
  setInterval(function () {
    if (vista === "quadro" && comandas.length) desenharQuadro();
  }, 60000);

  /* ---------------- Início ---------------- */
  (async function iniciar() {
    const nome = CFG.nome || "";
    const d = CFG.nomeDestaque || "";
    $$("[data-marca]").forEach((el) => {
      el.innerHTML = d && nome.indexOf(d) !== -1
        ? esc(nome).replace(esc(d), "<em>" + esc(d) + "</em>")
        : esc(nome);
    });
    document.title = "Caixa | " + nome;
    try {
      await DB.init();
    } catch (e) {
      avisar(e.message, "erro");
      return;
    }
    const usuario = await DB.usuarioAtual();
    if (usuario) await abrirCaixa(usuario);
  })();
})();
