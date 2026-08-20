/* =====================================================================
   FRONT BEER — Caixa (lançamento de vendas)
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, moeda, chave, $, $$, avisar, confirmar } = UI;

  const ROTULO_PAGAMENTO = {
    dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito: "Crédito", outro: "Outro",
  };

  let produtos = [];
  let vendasHoje = [];
  const comanda = [];              // { id, nome, categoria, preco, qtd }
  let pagamento = "dinheiro";

  NAV.montar();   // menu lateral e barra superior

  /* ---------------- Acesso ---------------- */
  $("#formAcesso").addEventListener("submit", async function (e) {
    e.preventDefault();
    ["#erroAcesso", "#erroAcessoBaixo"].forEach(function (sel) {
      const el = $(sel); if (el) el.classList.add("oculto");
    });
    const btn = $("#btnEntrar");
    btn.disabled = true;
    try {
      const usuario = await DB.login($("#email").value, $("#senha").value);
      $("#senha").value = "";
      await abrirCaixa(usuario);
    } catch (err) {
      ["#erroAcesso", "#erroAcessoBaixo"].forEach(function (sel) {
        const el = $(sel);
        if (el) { el.textContent = err.message || "Não foi possível entrar."; el.classList.remove("oculto"); }
      });
      console.error("Falha no login:", err);
    } finally {
      btn.disabled = false;
    }
  });

  $("#btnSair").addEventListener("click", async function () {
    if (comanda.length && !(await confirmar({
      titulo: "Sair do caixa",
      texto: "Há uma venda em aberto que será perdida. Deseja sair mesmo assim?",
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
    await carregarVendasDoDia();
    $("#buscaProduto").focus();
  }

  /* ---------------- Catálogo ---------------- */
  async function carregarProdutos() {
    try {
      produtos = (await DB.listarProdutos(false)).filter((p) => p.ativo);
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

  function quantidadeNaComanda(id) {
    const item = comanda.find((i) => i.id === id);
    return item ? item.qtd : 0;
  }

  function desenharCatalogo() {
    const lista = produtosFiltrados();
    const alvo = $("#catalogo");

    if (!produtos.length) {
      alvo.innerHTML = '<div class="estado-vazio"><h3>Nenhum produto cadastrado</h3>' +
        '<p>Cadastre o cardápio em Produtos para começar a vender.</p></div>';
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
    const qtd = quantidadeNaComanda(p.id);
    return '<button type="button" class="cartao-produto' + (p.esgotado ? " cartao-produto--esgotado" : "") +
      '" data-id="' + esc(p.id) + '"' + (p.esgotado ? " disabled" : "") + '>' +
      '<span class="cartao-produto__nome">' + esc(p.nome) + (p.esgotado ? " (esgotado)" : "") + "</span>" +
      '<span class="cartao-produto__pe">' +
        '<span class="cartao-produto__preco">' + moeda(p.preco) + "</span>" +
        (qtd ? '<span class="cartao-produto__qtd">' + qtd + "</span>" : "") +
      "</span></button>";
  }

  $("#catalogo").addEventListener("click", function (e) {
    const btn = e.target.closest(".cartao-produto");
    if (!btn || btn.disabled) return;
    adicionar(btn.getAttribute("data-id"));
  });

  const campoBusca = $("#buscaProduto");
  campoBusca.addEventListener("input", desenharCatalogo);
  campoBusca.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const primeiro = produtosFiltrados().filter((p) => !p.esgotado)[0];
    if (!primeiro) { avisar("Nenhum produto disponível para esse termo.", "erro"); return; }
    adicionar(primeiro.id);
    campoBusca.select();
  });

  /* ---------------- Comanda ---------------- */
  function adicionar(id) {
    const p = produtos.find((x) => x.id === id);
    if (!p || p.esgotado) return;
    const existente = comanda.find((i) => i.id === id);
    if (existente) existente.qtd += 1;
    else comanda.push({ id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco, qtd: 1 });
    desenharComanda();
    desenharCatalogo();
  }

  function alterarQtd(id, delta) {
    const item = comanda.find((i) => i.id === id);
    if (!item) return;
    item.qtd += delta;
    if (item.qtd <= 0) comanda.splice(comanda.indexOf(item), 1);
    desenharComanda();
    desenharCatalogo();
  }

  function removerItem(id) {
    const i = comanda.findIndex((x) => x.id === id);
    if (i !== -1) comanda.splice(i, 1);
    desenharComanda();
    desenharCatalogo();
  }

  function totalComanda() {
    return Math.round(comanda.reduce((s, i) => s + i.preco * i.qtd, 0) * 100) / 100;
  }

  function desenharComanda() {
    const alvo = $("#comandaItens");
    const unidades = comanda.reduce((s, i) => s + i.qtd, 0);

    if (!comanda.length) {
      alvo.innerHTML = '<div class="comanda__vazia">Toque nos produtos ao lado<br>para montar a venda.</div>';
    } else {
      alvo.innerHTML = comanda.map((i) =>
        '<div class="comanda-item" data-id="' + esc(i.id) + '">' +
          '<div class="comanda-item__nome">' + esc(i.nome) + "</div>" +
          '<div class="comanda-item__total">' + moeda(i.preco * i.qtd) + "</div>" +
          '<div class="comanda-item__unit">' + moeda(i.preco) + " a unidade" +
            '<div class="contador">' +
              '<button type="button" data-acao="menos" aria-label="Diminuir">&minus;</button>' +
              "<span>" + i.qtd + "</span>" +
              '<button type="button" data-acao="mais" aria-label="Aumentar">+</button>' +
              '<button type="button" class="remover" data-acao="remover">remover</button>' +
            "</div>" +
          "</div>" +
        "</div>"
      ).join("");
    }

    $("#contagemItens").textContent = unidades
      ? unidades + (unidades === 1 ? " item" : " itens")
      : "nenhum item";
    $("#comandaTotal").textContent = moeda(totalComanda());
    $("#btnFechar").disabled = comanda.length === 0;
  }

  $("#comandaItens").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    const id = btn.closest(".comanda-item").getAttribute("data-id");
    const acao = btn.getAttribute("data-acao");
    if (acao === "mais") alterarQtd(id, 1);
    else if (acao === "menos") alterarQtd(id, -1);
    else removerItem(id);
  });

  $("#pagamentos").addEventListener("click", function (e) {
    const btn = e.target.closest(".pagamento");
    if (!btn) return;
    pagamento = btn.getAttribute("data-pg");
    $$(".pagamento").forEach((b) => b.classList.toggle("ativo", b === btn));
  });

  $("#btnCancelar").addEventListener("click", async function () {
    if (!comanda.length) return;
    const ok = await confirmar({
      titulo: "Cancelar venda",
      texto: "Descartar os itens desta venda?",
      confirmar: "Descartar", perigo: true,
    });
    if (!ok) return;
    limparComanda();
  });

  function limparComanda() {
    comanda.length = 0;
    $("#observacao").value = "";
    desenharComanda();
    desenharCatalogo();
    campoBusca.value = "";
    desenharCatalogo();
    campoBusca.focus();
  }

  /* ---------------- Fechamento ---------------- */
  $("#btnFechar").addEventListener("click", async function () {
    if (!comanda.length) return;
    const btn = $("#btnFechar");
    btn.disabled = true;
    btn.textContent = "Registrando...";
    try {
      await DB.registrarVenda({
        pagamento: pagamento,
        observacao: $("#observacao").value,
        itens: comanda.map((i) => ({
          produto_id: i.id, nome: i.nome, categoria: i.categoria,
          preco_unit: i.preco, quantidade: i.qtd,
        })),
      });
      avisar("Venda de " + moeda(totalComanda()) + " registrada.", "ok");
      limparComanda();
      await carregarVendasDoDia();
    } catch (err) {
      avisar(err.message || "Falha ao registrar a venda.", "erro");
    } finally {
      btn.textContent = "Fechar venda";
      btn.disabled = comanda.length === 0;
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
      $("#diaUltima").textContent = vendasHoje.length
        ? new Date(vendasHoje[0].criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "—";

      const alvo = $("#ultimasVendas");
      if (!vendasHoje.length) {
        alvo.innerHTML = '<p style="font-size:.82rem;color:var(--texto-fraco)">Nenhuma venda registrada hoje.</p>';
        return;
      }
      alvo.innerHTML = vendasHoje.slice(0, 8).map((v) => {
        const resumo = (v.itens || []).map((i) => i.quantidade + "x " + i.nome).join(", ");
        return '<div class="ultima-venda" data-id="' + esc(v.id) + '">' +
          '<span class="ultima-venda__hora">' +
            new Date(v.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "</span>" +
          '<span class="ultima-venda__itens" title="' + esc(resumo) + '">' + esc(resumo || "—") + "</span>" +
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
    } catch (err) {
      avisar(err.message, "erro");
    }
  });

  /* ---------------- Atalhos ---------------- */
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" && e.key !== "Escape" && e.key !== "F2") return;
    if (e.key === "F2") { e.preventDefault(); $("#btnFechar").click(); }
    if (e.key === "Escape" && !document.querySelector(".modal-fundo.aberto")) campoBusca.focus();
  });

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
    await DB.init();
    const usuario = await DB.usuarioAtual();
    if (usuario) await abrirCaixa(usuario);
  })();
})();
