/* =====================================================================
   FRONT BEER — Estoque

   Tela de uma pergunta só: o que precisa comprar. Entrada de mercadoria
   quando chega o fardo, e correção de contagem quando o número da tela
   não bate com a prateleira.

   O que ela NÃO faz, de propósito: registrar o motivo de a mercadoria
   ter sumido. Isso é Perdas, e a separação existe porque são decisões
   diferentes — aqui se acerta o número, lá se explica o porquê.
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, chave, $, $$, avisar, abrirModal, fecharModal, confirmar } = UI;

  let produtos = [];

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

  function controlados() {
    return produtos.filter((p) => p.controla_estoque === true);
  }

  function acharProduto(id) {
    return produtos.find((p) => p.id === id);
  }

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
    $("#telaEstoque").classList.add("oculto");
    $("#telaAcesso").classList.remove("oculto");
  });

  async function abrirTela(usuario) {
    $("#telaAcesso").classList.add("oculto");
    $("#telaEstoque").classList.remove("oculto");
    NAV.definirUsuario(usuario || (await DB.usuarioAtual()));
    await recarregar();
  }

  async function recarregar() {
    try {
      produtos = await DB.listarProdutos(false);
      desenhar();
    } catch (e) {
      avisar(e.message || "Falha ao carregar o estoque.", "erro");
    }
  }

  /* ---------------- Indicadores e alerta ---------------- */
  function desenharIndicadores() {
    const lista = controlados();
    const repor = lista.filter((p) => DB.estoqueBaixo(p));
    const zerados = lista.filter((p) => p.estoque === 0);

    $("#kpiControlados").textContent = lista.length;
    $("#kpiRepor").textContent = repor.length;
    $("#kpiZerados").textContent = zerados.length;
    $("#kpiUnidades").textContent = lista.reduce((s, p) => s + p.estoque, 0);

    const alvo = $("#alertaEstoque");
    if (!repor.length) { alvo.classList.add("oculto"); alvo.innerHTML = ""; return; }

    const titulo = zerados.length
      ? zerados.length + (zerados.length === 1 ? " item acabou" : " itens acabaram")
      : "Comprar em breve";

    alvo.innerHTML = "<strong>" + esc(titulo) + "</strong> " +
      repor.slice(0, 12).map((p) =>
        esc(p.nome) + " (" + (p.estoque === 0 ? "acabou" : p.estoque + " restantes") + ")"
      ).join(" · ") +
      (repor.length > 12 ? " e mais " + (repor.length - 12) + "." : "");
    alvo.classList.remove("oculto");
  }

  /* ---------------- Tabela ---------------- */
  function filtrados() {
    const t = chave($("#buscaEstoque").value);
    const situacaoFiltro = $("#soRepor").value;
    return controlados()
      .filter((p) => {
        if (situacaoFiltro === "repor" && !DB.estoqueBaixo(p)) return false;
        if (situacaoFiltro === "zerado" && p.estoque !== 0) return false;
        if (t && chave(p.nome).indexOf(t) === -1 && chave(p.categoria).indexOf(t) === -1) return false;
        return true;
      })
      .sort((a, b) => {
        /* O que precisa repor sobe: é o motivo de a tela existir. */
        const ra = DB.estoqueBaixo(a) ? 0 : 1;
        const rb = DB.estoqueBaixo(b) ? 0 : 1;
        return ra - rb || a.estoque - b.estoque || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }

  function situacao(p) {
    if (p.estoque === 0) return '<span class="selo selo--erro">Acabou</span>';
    if (DB.estoqueBaixo(p)) return '<span class="selo selo--erro">Repor</span>';
    return '<span class="selo selo--ok">Em estoque</span>';
  }

  function linha(p) {
    return '<tr data-id="' + esc(p.id) + '">' +
      '<td data-rotulo="Produto"><div class="produto-nome"><div><strong>' + esc(p.nome) + "</strong>" +
        (p.esgotado ? "<small>fora do cardápio enquanto estiver zerado</small>" : "") +
      "</div></div></td>" +
      '<td data-rotulo="Categoria">' + esc(p.categoria) + "</td>" +
      '<td data-rotulo="Em estoque" class="preco-celula">' + esc(p.estoque) + "</td>" +
      '<td data-rotulo="Avisar em">' + esc(p.estoque_minimo) + "</td>" +
      '<td data-rotulo="Situação">' + situacao(p) + "</td>" +
      '<td data-rotulo="Ações"><div class="acoes-celula">' +
        '<button type="button" class="btn btn--confirmar btn--pequeno" data-acao="entrada">Entrada</button>' +
        '<button type="button" class="btn btn--fantasma btn--pequeno" data-acao="corrigir">Corrigir</button>' +
      "</div></td></tr>";
  }

  function desenhar() {
    desenharIndicadores();

    const lista = filtrados();
    const corpo = $("#corpoEstoque");
    const vazia = $("#areaVazia");

    corpo.innerHTML = lista.map(linha).join("");

    const nenhumControlado = controlados().length === 0;
    vazia.classList.toggle("oculto", !nenhumControlado);
    $("#tabelaEstoque").classList.toggle("oculto", nenhumControlado);

    if (!nenhumControlado && !lista.length) {
      corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:26px">' +
        "Nenhum item encontrado com esse filtro.</td></tr>";
    }
  }

  $("#buscaEstoque").addEventListener("input", desenhar);
  $("#soRepor").addEventListener("change", desenhar);

  /* ---------------- Ações da tabela ---------------- */
  $("#corpoEstoque").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    const id = btn.closest("tr").getAttribute("data-id");
    const p = acharProduto(id);
    if (!p) return;

    if (btn.getAttribute("data-acao") === "entrada") abrirEntrada(p);
    else abrirCorrecao(p);
  });

  /* ---------------- Entrada de mercadoria ---------------- */
  function abrirEntrada(p) {
    limparErro($("#erroEntrada"));
    $("#entradaId").value = p.id;
    $("#entradaQtd").value = 12;
    $("#entradaResumo").innerHTML =
      "<strong>" + esc(p.nome) + "</strong> — hoje há " + esc(p.estoque) + " em estoque.";
    abrirModal("modalEntrada");
  }

  $("#formEntrada").addEventListener("submit", async function (e) {
    e.preventDefault();
    limparErro($("#erroEntrada"));
    const btn = $("#btnSalvarEntrada");
    btn.disabled = true;
    try {
      const p = acharProduto($("#entradaId").value);
      if (!p) throw new Error("Produto não encontrado.");
      const qtd = parseInt($("#entradaQtd").value, 10);
      if (!(qtd > 0)) throw new Error("Informe uma quantidade maior que zero.");

      await DB.darEntradaEstoque(p.id, qtd);
      fecharModal("modalEntrada");
      avisar("Entrada de " + qtd + "× " + p.nome + " registrada.", "ok");
      await recarregar();
    } catch (err) {
      mostrarErro($("#erroEntrada"), err.message || "Falha ao dar entrada.");
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------------- Correção de contagem ----------------

     O dono conta a prateleira e digita o que viu. O sistema calcula a
     diferença sozinho — pedir "quantas somem" faria ele fazer a conta
     de cabeça no meio do serviço, que é onde o erro aparece. */
  function abrirCorrecao(p) {
    limparErro($("#erroCorrecao"));
    $("#correcaoId").value = p.id;
    $("#correcaoQtd").value = p.estoque;
    $("#correcaoResumo").innerHTML =
      "<strong>" + esc(p.nome) + "</strong> — o sistema diz " + esc(p.estoque) + ".";
    atualizarDiferenca();
    abrirModal("modalCorrecao");
  }

  function atualizarDiferenca() {
    const p = acharProduto($("#correcaoId").value);
    const alvo = $("#correcaoDiferenca");
    if (!p) { alvo.textContent = ""; return; }

    const contado = parseInt($("#correcaoQtd").value, 10);
    if (isNaN(contado) || contado < 0) { alvo.textContent = ""; return; }

    const d = contado - p.estoque;
    if (d === 0) alvo.textContent = "Bate com o sistema — nada muda.";
    else if (d > 0) alvo.textContent = "Sobraram " + d + " a mais do que o sistema sabia.";
    else alvo.textContent = "Faltam " + Math.abs(d) + " em relação ao sistema.";
  }

  $("#correcaoQtd").addEventListener("input", atualizarDiferenca);

  $("#formCorrecao").addEventListener("submit", async function (e) {
    e.preventDefault();
    limparErro($("#erroCorrecao"));
    const btn = $("#btnSalvarCorrecao");
    btn.disabled = true;
    try {
      const p = acharProduto($("#correcaoId").value);
      if (!p) throw new Error("Produto não encontrado.");
      const contado = parseInt($("#correcaoQtd").value, 10);
      if (isNaN(contado) || contado < 0) throw new Error("Informe a quantidade contada.");

      const diferenca = contado - p.estoque;
      if (!diferenca) { fecharModal("modalCorrecao"); return; }

      await DB.darEntradaEstoque(p.id, diferenca);
      fecharModal("modalCorrecao");
      avisar(p.nome + ": estoque acertado para " + contado + ".", "ok");
      await recarregar();
    } catch (err) {
      mostrarErro($("#erroCorrecao"), err.message || "Falha ao acertar o estoque.");
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------------- Início ---------------- */
  (async function iniciar() {
    $$("[data-marca]").forEach((el) => { el.textContent = CFG.nome || "Front Beer"; });
    document.title = "Estoque | " + (CFG.nome || "");
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
