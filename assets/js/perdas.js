/* =====================================================================
   FRONT BEER — Perdas

   Registra a mercadoria que saiu sem venda e mostra para onde ela foi.

   O motivo é obrigatório porque é ele que transforma um número em
   diagnóstico: quebra é manuseio, vencimento é erro de compra, consumo
   da casa é retirada do dono e brinde é marketing. Quatro decisões
   diferentes, que um total único esconderia.

   O valor é sempre o CUSTO. Uma cerveja de R$ 11 que custou R$ 6,49
   tirou R$ 6,49 do bolso; lançar pelo preço de venda inflaria a perda
   em quase o dobro.
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, moeda, chave, $, $$, avisar, abrirModal, fecharModal, confirmar } = UI;

  let produtos = [];
  let custos = {};
  let perdas = [];
  let faturamento = 0;

  const ROTULOS = {};
  DB.motivosDePerda.forEach((m) => { ROTULOS[m.valor] = m.rotulo; });

  NAV.montar();

  /* ---------------- Auxiliares ---------------- */
  function mostrarErro(el, msg) { el.textContent = msg; el.classList.remove("oculto"); }
  function limparErro(el) { el.textContent = ""; el.classList.add("oculto"); }

  function avisoAcesso(msg) {
    ["#erroAcesso", "#erroAcessoBaixo"].forEach(function (sel) {
      const el = $(sel);
      if (!el) return;
      if (msg) mostrarErro(el, msg); else limparErro(el);
    });
  }

  function custoDoProduto(p) {
    const u = DB.custoUnitario(custos[p.id]);
    return u == null ? 0 : u;
  }

  /* ---------------- Datas ---------------- */
  function paraCampo(d) {
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function doCampo(v) {
    const [a, m, d] = String(v || "").split("-").map(Number);
    return new Date(a, (m || 1) - 1, d || 1);
  }
  function definirPeriodo(dias) {
    const ate = new Date();
    const de = new Date();
    de.setDate(de.getDate() - dias);
    $("#dataDe").value = paraCampo(de);
    $("#dataAte").value = paraCampo(ate);
  }

  $("#atalhos").addEventListener("click", function (e) {
    const btn = e.target.closest(".atalho");
    if (!btn) return;
    $$(".atalho").forEach((b) => b.classList.remove("ativo"));
    btn.classList.add("ativo");
    definirPeriodo(Number(btn.getAttribute("data-dias")));
    carregar();
  });

  ["#dataDe", "#dataAte"].forEach((sel) => {
    $(sel).addEventListener("change", function () {
      $$(".atalho").forEach((b) => b.classList.remove("ativo"));
      carregar();
    });
  });

  /* ---------------- Acesso ---------------- */
  $("#formAcesso").addEventListener("submit", async function (e) {
    e.preventDefault();
    avisoAcesso("");
    const btn = $("#btnEntrar");
    btn.disabled = true;
    btn.textContent = "Entrando...";
    try {
      const usuario = await DB.login($("#email").value, $("#senha").value);
      $("#senha").value = "";
      await abrirTela(usuario);
    } catch (err) {
      avisoAcesso(err.message || "Não foi possível entrar.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  $("#btnSair").addEventListener("click", async function () {
    if (!(await confirmar({ titulo: "Sair", texto: "Deseja encerrar a sessão?", confirmar: "Sair" }))) return;
    await DB.logout();
    $("#telaPerdas").classList.add("oculto");
    $("#telaAcesso").classList.remove("oculto");
  });

  async function abrirTela(usuario) {
    $("#telaAcesso").classList.add("oculto");
    $("#telaPerdas").classList.remove("oculto");
    NAV.definirUsuario(usuario || (await DB.usuarioAtual()));

    $("#filtroMotivo").innerHTML = '<option value="">Todos os motivos</option>' +
      DB.motivosDePerda.map((m) =>
        '<option value="' + esc(m.valor) + '">' + esc(m.rotulo) + "</option>").join("");

    definirPeriodo(29);
    await carregarProdutos();
    await carregar();
  }

  async function carregarProdutos() {
    try {
      produtos = (await DB.listarProdutos(false)).filter((p) => p.ativo);
      custos = await DB.listarCustos();
    } catch (e) {
      avisar(e.message || "Falha ao carregar os produtos.", "erro");
    }
  }

  async function carregar() {
    const de = doCampo($("#dataDe").value);
    const ate = doCampo($("#dataAte").value);
    if (isNaN(de) || isNaN(ate)) return;
    if (de > ate) { avisar("A data inicial é posterior à final.", "erro"); return; }

    try {
      perdas = await DB.listarPerdas(de, ate);
    } catch (e) {
      perdas = [];
      avisar(e.message || "Falha ao carregar as perdas.", "erro");
    }

    /* O faturamento do mesmo período entra só para a proporção — que é
       a leitura que importa. Se falhar, a tela continua funcionando
       sem o percentual. */
    try {
      const vendas = await DB.listarVendas(de, ate);
      faturamento = vendas.reduce((s, v) => s + v.total, 0);
    } catch (e) {
      faturamento = 0;
    }

    desenhar();
  }

  /* ---------------- Desenho ---------------- */
  function desenhar() {
    const R = DB.resumoDePerdas(perdas, faturamento);

    $("#kpiCusto").textContent = moeda(R.total);
    $("#kpiUnidades").textContent = R.unidades;
    $("#kpiRegistros").textContent = perdas.length;
    $("#kpiPercentual").textContent = R.percentualDaReceita == null
      ? "—" : String(R.percentualDaReceita).replace(".", ",") + "%";

    /* A proporção diz mais que o valor. Num bar, passar de uns 3% do
       faturamento é sinal de problema de manuseio, compra ou controle. */
    const nota = $("#notaPercentual");
    if (R.percentualDaReceita == null) {
      nota.textContent = perdas.length
        ? "Sem vendas no período para comparar. O percentual aparece quando houver faturamento."
        : "";
    } else if (R.percentualDaReceita > 3) {
      nota.innerHTML = "<strong>" + String(R.percentualDaReceita).replace(".", ",") +
        "% do faturamento virou perda</strong> — acima do que se espera num bar. " +
        "Veja abaixo qual motivo está puxando.";
    } else {
      nota.innerHTML = String(R.percentualDaReceita).replace(".", ",") +
        "% do faturamento virou perda no período. Valores pelo custo, não pelo preço de venda.";
    }

    desenharMotivos(R);
    desenharTabela();
  }

  function desenharMotivos(R) {
    const painel = $("#painelMotivos");
    const motivos = Object.keys(R.porMotivo)
      .map((k) => ({ chave: k, rotulo: ROTULOS[k] || k, custo: R.porMotivo[k] }))
      .sort((a, b) => b.custo - a.custo);

    if (!motivos.length) { painel.classList.add("oculto"); return; }
    painel.classList.remove("oculto");

    const maior = motivos[0].custo || 1;
    $("#listaMotivos").innerHTML = motivos.map((m, i) =>
      '<div class="rank-linha">' +
        '<div class="rank-pos">' + (i + 1) + "</div>" +
        '<div class="rank-corpo">' +
          '<div class="rank-nome">' + esc(m.rotulo) + "</div>" +
          '<div class="rank-barra"><i style="width:' + Math.max(3, (m.custo / maior) * 100).toFixed(1) + '%"></i></div>' +
        "</div>" +
        '<div class="rank-valor">' + moeda(m.custo) + "</div>" +
      "</div>"
    ).join("");
  }

  function filtradas() {
    const t = chave($("#buscaPerda").value);
    const motivo = $("#filtroMotivo").value;
    return perdas.filter((p) => {
      if (motivo && p.motivo !== motivo) return false;
      if (t && chave(p.nome).indexOf(t) === -1) return false;
      return true;
    });
  }

  function quando(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " · " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function desenharTabela() {
    const lista = filtradas();
    const corpo = $("#corpoPerdas");
    const vazia = $("#areaVazia");
    const tabela = $("#tabelaPerdas");

    if (!perdas.length) {
      corpo.innerHTML = "";
      vazia.classList.remove("oculto");
      tabela.classList.add("oculto");
      return;
    }
    vazia.classList.add("oculto");
    tabela.classList.remove("oculto");

    if (!lista.length) {
      corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:26px">' +
        "Nenhuma perda encontrada com esse filtro.</td></tr>";
      return;
    }

    corpo.innerHTML = lista.map((p) =>
      '<tr data-id="' + esc(p.id) + '">' +
        '<td data-rotulo="Quando">' + esc(quando(p.criado_em)) + "</td>" +
        '<td data-rotulo="Produto"><div class="produto-nome"><div><strong>' + esc(p.nome) + "</strong>" +
          (p.observacao ? "<small>" + esc(p.observacao) + "</small>" : "") +
        "</div></div></td>" +
        '<td data-rotulo="Qtd.">' + esc(p.quantidade) + "</td>" +
        '<td data-rotulo="Motivo"><span class="selo selo--vazio">' +
          esc(ROTULOS[p.motivo] || p.motivo) + "</span></td>" +
        '<td data-rotulo="Custo" class="preco-celula">' + moeda(p.custo_unit * p.quantidade) + "</td>" +
        '<td data-rotulo="Ações"><div class="acoes-celula">' +
          '<button type="button" class="btn btn--perigo btn--pequeno" data-acao="excluir" ' +
            'aria-label="Excluir perda de ' + esc(p.nome) + '">Excluir</button>' +
        "</div></td></tr>"
    ).join("");
  }

  $("#buscaPerda").addEventListener("input", desenharTabela);
  $("#filtroMotivo").addEventListener("change", desenharTabela);

  /* ---------------- Excluir ---------------- */
  $("#corpoPerdas").addEventListener("click", async function (e) {
    const btn = e.target.closest('button[data-acao="excluir"]');
    if (!btn) return;
    const id = btn.closest("tr").getAttribute("data-id");
    const p = perdas.find((x) => x.id === id);
    if (!p) return;

    const ok = await confirmar({
      titulo: "Excluir registro de perda",
      texto: "Remover " + p.quantidade + "× " + p.nome + "?\n" +
             "A mercadoria volta para o estoque.",
      confirmar: "Excluir", perigo: true,
    });
    if (!ok) return;

    try {
      await DB.excluirPerda(id);
      avisar("Registro removido e estoque devolvido.", "ok");
      await carregarProdutos();
      await carregar();
    } catch (err) {
      avisar(err.message || "Falha ao excluir.", "erro");
    }
  });

  /* ---------------- Registrar ---------------- */
  function preencherFormulario() {
    $("#perdaProduto").innerHTML = produtos.slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((p) => '<option value="' + esc(p.id) + '">' + esc(p.nome) + "</option>")
      .join("");

    $("#perdaMotivo").innerHTML = DB.motivosDePerda
      .map((m) => '<option value="' + esc(m.valor) + '">' + esc(m.rotulo) + "</option>")
      .join("");

    $("#perdaQtd").value = 1;
    $("#perdaObs").value = "";
    atualizarValor();
    atualizarAjudaMotivo();
  }

  function atualizarAjudaMotivo() {
    const m = DB.motivosDePerda.find((x) => x.valor === $("#perdaMotivo").value);
    $("#perdaMotivoAjuda").textContent = m ? m.ajuda : "";
  }

  function atualizarValor() {
    const p = produtos.find((x) => x.id === $("#perdaProduto").value);
    const qtd = Math.max(1, parseInt($("#perdaQtd").value, 10) || 1);
    const alvo = $("#perdaValor");

    if (!p) { alvo.textContent = "Escolha o produto para ver quanto custa."; return; }

    const unitario = custoDoProduto(p);
    if (!unitario) {
      alvo.innerHTML = "<strong>" + esc(p.nome) + "</strong> não tem custo cadastrado. " +
        "A perda será registrada com valor zero — cadastre o custo em Produtos para a conta fechar.";
      return;
    }
    alvo.innerHTML = "Custo da perda: <strong>" + moeda(unitario * qtd) + "</strong> " +
      "<small>(" + qtd + " × " + moeda(unitario) + ")</small>";
  }

  $("#btnNovaPerda").addEventListener("click", function () {
    if (!produtos.length) { avisar("Cadastre produtos antes de registrar perdas.", "erro"); return; }
    limparErro($("#erroPerda"));
    preencherFormulario();
    abrirModal("modalPerda");
  });

  $("#perdaProduto").addEventListener("change", atualizarValor);
  $("#perdaQtd").addEventListener("input", atualizarValor);
  $("#perdaMotivo").addEventListener("change", atualizarAjudaMotivo);

  $("#formPerda").addEventListener("submit", async function (e) {
    e.preventDefault();
    limparErro($("#erroPerda"));
    const btn = $("#btnSalvarPerda");
    btn.disabled = true;
    try {
      const p = produtos.find((x) => x.id === $("#perdaProduto").value);
      if (!p) throw new Error("Escolha o produto.");
      const qtd = parseInt($("#perdaQtd").value, 10);

      await DB.registrarPerda({
        produto_id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        quantidade: qtd,
        custo_unit: custoDoProduto(p),
        motivo: $("#perdaMotivo").value,
        observacao: $("#perdaObs").value,
      });

      fecharModal("modalPerda");
      avisar("Perda registrada: " + qtd + "× " + p.nome + ".", "ok");
      await carregarProdutos();
      await carregar();
    } catch (err) {
      mostrarErro($("#erroPerda"), err.message || "Falha ao registrar a perda.");
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------------- Início ---------------- */
  (async function iniciar() {
    $$("[data-marca]").forEach((el) => { el.textContent = CFG.nome || "Front Beer"; });
    document.title = "Perdas | " + (CFG.nome || "");
    try {
      await DB.init();
    } catch (e) {
      avisar(e.message, "erro");
      return;
    }
    const usuario = await DB.usuarioAtual();
    if (usuario) await abrirTela(usuario);
  })();
})();
