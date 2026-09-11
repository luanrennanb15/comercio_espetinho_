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

  /* Salva os campos de estoque sem tocar no resto do cadastro. O objeto
     do produto vai inteiro porque salvarProduto espera o cadastro
     completo — nome, categoria e preço seguem como estão. */
  async function gravarEstoque(p, dados) {
    await DB.salvarProduto(Object.assign({}, p, dados));
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
      desenharCategorias();
      avisarSeFaltaModulo();
      desenhar();
    } catch (e) {
      avisar(e.message || "Falha ao carregar o estoque.", "erro");
    }
  }

  /* O banco pode não ter as colunas de estoque ainda. Quando isso
     acontece, elas simplesmente não voltam na consulta — nenhum erro.
     Então a ausência é detectada aqui, na abertura da tela, em vez de
     o dono descobrir depois de preencher o formulário e clicar. */
  function avisarSeFaltaModulo() {
    const alvo = $("#avisoSemModulo");
    const faltando = DB.modo === "supabase" && produtos.length > 0 &&
      produtos.every((p) => p.controla_estoque === undefined);

    if (!faltando) { alvo.classList.add("oculto"); alvo.innerHTML = ""; return; }

    alvo.innerHTML = "<strong>Falta um passo no banco.</strong> " +
      "O módulo de estoque ainda não foi instalado, então ligar o controle " +
      "aqui não vai gravar nada. Abra o Supabase, vá em <strong>SQL Editor → " +
      "New query</strong>, cole o conteúdo de <code>supabase/estoque.sql</code> " +
      "e clique em Run. Depois recarregue esta página.";
    alvo.classList.remove("oculto");
  }

  /* ---------------- Indicadores e alerta ---------------- */
  function desenharIndicadores() {
    const lista = controlados();
    const repor = lista.filter((p) => DB.estoqueBaixo(p));
    const zerados = lista.filter((p) => p.estoque === 0);

    $("#kpiControlados").textContent = lista.length;
    $("#kpiSemControle").textContent = produtos.length - lista.length;
    $("#kpiRepor").textContent = repor.length;
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

  /* ---------------- Tabela ----------------

     Lista TODOS os produtos cadastrados, com ou sem controle ligado.
     É daqui que o controle é ligado e desligado: o dono vê o cardápio
     inteiro e escolhe o que faz sentido contar, sem precisar abrir a
     ficha de cada produto para descobrir. */
  function filtrados() {
    const t = chave($("#buscaEstoque").value);
    const situacaoFiltro = $("#filtroSituacao").value;
    const cat = $("#filtroCategoria").value;

    return produtos
      .filter((p) => {
        const ligado = p.controla_estoque === true;
        if (situacaoFiltro === "ligado" && !ligado) return false;
        if (situacaoFiltro === "desligado" && ligado) return false;
        if (situacaoFiltro === "repor" && !DB.estoqueBaixo(p)) return false;
        if (situacaoFiltro === "zerado" && !(ligado && p.estoque === 0)) return false;
        if (cat && p.categoria !== cat) return false;
        if (t && chave(p.nome).indexOf(t) === -1 && chave(p.categoria).indexOf(t) === -1) return false;
        return true;
      })
      .sort((a, b) => {
        /* O que precisa repor sobe; quem não é controlado desce. É o
           motivo de a tela existir — ela abre já mostrando a compra. */
        const peso = (p) => (DB.estoqueBaixo(p) ? 0 : p.controla_estoque ? 1 : 2);
        return peso(a) - peso(b) ||
               (a.controla_estoque && b.controla_estoque ? a.estoque - b.estoque : 0) ||
               a.nome.localeCompare(b.nome, "pt-BR");
      });
  }

  function situacao(p) {
    if (!p.controla_estoque) return '<span class="selo selo--vazio">Sem controle</span>';
    if (p.estoque === 0) return '<span class="selo selo--erro">Acabou</span>';
    if (DB.estoqueBaixo(p)) return '<span class="selo selo--erro">Repor</span>';
    return '<span class="selo selo--ok">Em estoque</span>';
  }

  function linha(p) {
    const ligado = p.controla_estoque === true;

    const acoes = ligado
      ? '<button type="button" class="btn btn--confirmar btn--pequeno" data-acao="entrada">Entrada</button>' +
        '<button type="button" class="btn btn--fantasma btn--pequeno" data-acao="corrigir">Contar</button>' +
        '<button type="button" class="btn btn--fantasma btn--pequeno" data-acao="configurar">Ajustes</button>'
      : '<button type="button" class="btn btn--pequeno" data-acao="configurar">Ligar estoque</button>';

    return '<tr class="' + (ligado ? "" : "esmaecido") + '" data-id="' + esc(p.id) + '">' +
      '<td data-rotulo="Produto"><div class="produto-nome"><div><strong>' + esc(p.nome) + "</strong>" +
        (!p.ativo ? "<small>oculto no cardápio</small>"
                  : ligado && p.esgotado ? "<small>fora do cardápio enquanto estiver zerado</small>" : "") +
      "</div></div></td>" +
      '<td data-rotulo="Categoria">' + esc(p.categoria) + "</td>" +
      '<td data-rotulo="Em estoque" class="preco-celula">' + (ligado ? esc(p.estoque) : "—") + "</td>" +
      '<td data-rotulo="Avisar em">' + (ligado ? esc(p.estoque_minimo) : "—") + "</td>" +
      '<td data-rotulo="Situação">' + situacao(p) + "</td>" +
      '<td data-rotulo="Ações"><div class="acoes-celula">' + acoes + "</div></td></tr>";
  }

  function desenharCategorias() {
    const atual = $("#filtroCategoria").value;
    const cats = [];
    produtos.forEach((p) => { if (p.categoria && cats.indexOf(p.categoria) === -1) cats.push(p.categoria); });
    cats.sort((a, b) => a.localeCompare(b, "pt-BR"));
    $("#filtroCategoria").innerHTML = '<option value="">Todas as categorias</option>' +
      cats.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "</option>").join("");
    if (cats.indexOf(atual) !== -1) $("#filtroCategoria").value = atual;
  }

  function desenhar() {
    desenharIndicadores();

    const lista = filtrados();
    const corpo = $("#corpoEstoque");
    const vazia = $("#areaVazia");

    corpo.innerHTML = lista.map(linha).join("");

    const semProdutos = produtos.length === 0;
    vazia.classList.toggle("oculto", !semProdutos);
    $("#tabelaEstoque").classList.toggle("oculto", semProdutos);

    if (!semProdutos && !lista.length) {
      corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:26px">' +
        "Nenhum produto encontrado com esse filtro.</td></tr>";
    }
  }

  $("#buscaEstoque").addEventListener("input", desenhar);
  $("#filtroSituacao").addEventListener("change", desenhar);
  $("#filtroCategoria").addEventListener("change", desenhar);

  /* ---------------- Ações da tabela ---------------- */
  $("#corpoEstoque").addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    const id = btn.closest("tr").getAttribute("data-id");
    const p = acharProduto(id);
    if (!p) return;

    const acao = btn.getAttribute("data-acao");
    if (acao === "entrada") abrirEntrada(p);
    else if (acao === "corrigir") abrirCorrecao(p);
    else abrirConfigurar(p);
  });

  /* ---------------- Ligar, ajustar e desligar ---------------- */
  function abrirConfigurar(p) {
    limparErro($("#erroConfigurar"));
    const ligado = p.controla_estoque === true;

    $("#configurarId").value = p.id;
    $("#tituloConfigurar").textContent = ligado ? "Ajustes do estoque" : "Ligar estoque";
    $("#configQtd").value = ligado ? p.estoque : 0;
    $("#configMinimo").value = ligado ? p.estoque_minimo : 6;
    $("#btnDesligar").classList.toggle("oculto", !ligado);
    $("#btnSalvarConfig").textContent = ligado ? "Salvar" : "Ligar estoque";

    $("#configurarResumo").innerHTML = "<strong>" + esc(p.nome) + "</strong> — " +
      (ligado
        ? "controle ligado."
        : "conte o que tem hoje e escolha o ponto de aviso.");

    abrirModal("modalConfigurar");
  }

  $("#formConfigurar").addEventListener("submit", async function (e) {
    e.preventDefault();
    limparErro($("#erroConfigurar"));
    const btn = $("#btnSalvarConfig");
    btn.disabled = true;
    try {
      const p = acharProduto($("#configurarId").value);
      if (!p) throw new Error("Produto não encontrado.");

      const qtd = parseInt($("#configQtd").value, 10);
      const min = parseInt($("#configMinimo").value, 10);
      if (isNaN(qtd) || qtd < 0) throw new Error("Informe a quantidade que tem hoje.");
      if (isNaN(min) || min < 0) throw new Error("Informe o ponto de aviso.");

      await gravarEstoque(p, {
        controla_estoque: true,
        estoque: qtd,
        estoque_minimo: min,
        /* Ligar com quantidade acima de zero tira o esgotado que possa
           ter ficado de antes — senão o item continuaria escondido do
           cardápio sem motivo. */
        esgotado: qtd === 0 ? true : false,
      });

      /* Só comemora depois de reler do banco e confirmar que gravou.
         Avisar "ligado" na fé de que o servidor aceitou foi exatamente
         o que fez o dono achar que tinha ligado sem ter ligado. */
      await recarregar();
      const conferido = acharProduto(p.id);
      if (!conferido || conferido.controla_estoque !== true) {
        throw new Error(
          "O banco aceitou a gravação mas o estoque não ficou ligado. " +
          "Confira se o arquivo supabase/estoque.sql foi executado no Supabase."
        );
      }

      fecharModal("modalConfigurar");
      avisar(p.nome + ": estoque ligado com " + conferido.estoque + " unidade(s).", "ok");
    } catch (err) {
      mostrarErro($("#erroConfigurar"), err.message || "Falha ao salvar.");
    } finally {
      btn.disabled = false;
    }
  });

  $("#btnDesligar").addEventListener("click", async function () {
    const p = acharProduto($("#configurarId").value);
    if (!p) return;

    const ok = await confirmar({
      titulo: "Desligar controle de estoque",
      texto: p.nome + " deixa de ser contado e some desta lista.\n" +
             "O produto continua no cardápio normalmente.",
      confirmar: "Desligar", perigo: true,
    });
    if (!ok) return;

    try {
      await gravarEstoque(p, {
        controla_estoque: false, estoque: 0, estoque_minimo: 0,
        /* Sem controle, quem manda no esgotado é o botão do painel.
           Deixar marcado esconderia o item do cardápio para sempre. */
        esgotado: false,
      });
      fecharModal("modalConfigurar");
      avisar(p.nome + ": controle de estoque desligado.", "ok");
      await recarregar();
    } catch (err) {
      mostrarErro($("#erroConfigurar"), err.message || "Falha ao desligar.");
    }
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
