/* =====================================================================
   FRONT BEER — Painel interno
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, urlSegura, moeda, chave, $, $$, avisar, abrirModal, fecharModal, confirmar } = UI;

  let produtos = [];

  NAV.montar();   // menu lateral e barra superior

  /* ---------------- Auxiliares ---------------- */
  function mostrarErro(el, msg) { el.textContent = msg; el.classList.remove("oculto"); }
  function limparErro(el) { el.textContent = ""; el.classList.add("oculto"); }

  /* O aviso aparece acima e abaixo do formulário: em tela pequena ou com
     alguma janela sobreposta, pelo menos um dos dois fica visível. */
  function avisoAcesso(msg) {
    ["#erroAcesso", "#erroAcessoBaixo"].forEach(function (sel) {
      const el = $(sel);
      if (!el) return;
      if (msg) mostrarErro(el, msg); else limparErro(el);
    });
  }

  function marcaFormatada() {
    const nome = CFG.nome || "Painel";
    const d = CFG.nomeDestaque || "";
    return d && nome.indexOf(d) !== -1
      ? esc(nome).replace(esc(d), "<em>" + esc(d) + "</em>")
      : esc(nome);
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
      await entrarNoPainel(usuario);
    } catch (err) {
      avisoAcesso(err.message || "Não foi possível entrar.");
      console.error("Falha no login:", err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  $("#btnSair").addEventListener("click", async function () {
    if (!(await confirmar({ titulo: "Sair do painel", texto: "Deseja encerrar a sessão?", confirmar: "Sair" }))) return;
    await DB.logout();
    $("#telaPainel").classList.add("oculto");
    $("#telaAcesso").classList.remove("oculto");
  });

  async function entrarNoPainel(usuario) {
    $("#telaAcesso").classList.add("oculto");
    $("#telaPainel").classList.remove("oculto");
    NAV.definirUsuario(usuario);

    $("#notaModo").className = DB.modo === "demo" ? "nota nota--ouro" : "nota";
    $("#notaModo").innerHTML = DB.modo === "demo"
      ? "<strong>Modo demonstração.</strong> As alterações ficam apenas neste navegador. " +
        "Configure o Supabase em <code>assets/js/config.js</code> para que o cardápio funcione em todos os aparelhos."
      : "<strong>Conectado à nuvem.</strong> Toda alteração aparece no cardápio dos clientes imediatamente.";

    await recarregar();
  }

  /* ---------------- Carregamento ---------------- */
  async function recarregar() {
    try {
      produtos = await DB.listarProdutos(false);
      atualizarCategorias();
      atualizarIndicadores();
      desenharTabela();
    } catch (e) {
      avisar(e.message || "Falha ao carregar os produtos.", "erro");
    }
  }

  function listaCategorias() {
    const cats = [];
    produtos.forEach((p) => { if (cats.indexOf(p.categoria) === -1) cats.push(p.categoria); });
    return cats.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function atualizarCategorias() {
    const cats = listaCategorias();
    const opcoes = cats.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "</option>").join("");

    const filtro = $("#filtroCategoria");
    const atual = filtro.value;
    filtro.innerHTML = '<option value="">Todas as categorias</option>' + opcoes;
    filtro.value = cats.indexOf(atual) !== -1 ? atual : "";

    $("#listaCategorias").innerHTML = cats.map((c) => '<option value="' + esc(c) + '"></option>').join("");
    $("#rCategoria").innerHTML = '<option value="">Todos os produtos</option>' + opcoes;
  }

  function atualizarIndicadores() {
    const total = produtos.length;
    const esgotados = produtos.filter((p) => p.esgotado).length;
    const ocultos = produtos.filter((p) => !p.ativo).length;
    const disponiveis = produtos.filter((p) => p.ativo && !p.esgotado).length;
    const media = total ? produtos.reduce((s, p) => s + p.preco, 0) / total : 0;

    $("#kpiTotal").textContent = total;
    $("#kpiDisponiveis").textContent = disponiveis;
    $("#kpiEsgotados").textContent = esgotados;
    $("#kpiOcultos").textContent = ocultos;
    $("#kpiMedia").textContent = total ? moeda(media) : "—";
    $("#btnRepor").disabled = esgotados === 0;
  }

  /* ---------------- Tabela ---------------- */
  function filtrados() {
    const t = chave($("#buscaAdmin").value);
    const cat = $("#filtroCategoria").value;
    const sit = $("#filtroSituacao").value;
    return produtos.filter((p) => {
      if (cat && p.categoria !== cat) return false;
      if (sit === "disponivel" && (!p.ativo || p.esgotado)) return false;
      if (sit === "esgotado" && !p.esgotado) return false;
      if (sit === "oculto" && p.ativo) return false;
      if (sit === "alcoolico" && !p.alcoolico) return false;
      if (t && chave(p.nome).indexOf(t) === -1 && chave(p.descricao).indexOf(t) === -1) return false;
      return true;
    });
  }

  function linha(p) {
    const foto = urlSegura(p.imagem_url);
    const selos = [];
    if (!p.ativo) selos.push('<span class="selo selo--vazio">Oculto</span>');
    selos.push(p.esgotado
      ? '<span class="selo selo--erro">Esgotado</span>'
      : '<span class="selo selo--ok">Disponível</span>');
    if (p.alcoolico) selos.push('<span class="selo selo--ouro">18+</span>');

    return '<tr class="' + (p.ativo ? "" : "esmaecido") + '" data-id="' + esc(p.id) + '">' +
      '<td data-rotulo="Produto"><div class="produto-nome">' +
        (foto
          ? '<img src="' + esc(foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
          : '<span class="semfoto">' + (p.alcoolico ? "&#127866;" : "&#127855;") + "</span>") +
        "<div><strong>" + esc(p.nome) + "</strong>" +
          (p.descricao ? "<small>" + esc(p.descricao) + "</small>" : "") +
        "</div></div></td>" +
      '<td data-rotulo="Categoria">' + esc(p.categoria) + "</td>" +
      '<td data-rotulo="Preço" class="preco-celula">' + moeda(p.preco) + "</td>" +
      '<td data-rotulo="Situação"><div class="item__selos">' + selos.join(" ") + "</div></td>" +
      '<td data-rotulo="Ações"><div class="acoes-celula">' +
        '<button type="button" class="btn btn--fantasma btn--pequeno" data-acao="esgotar">' +
          (p.esgotado ? "Repor" : "Esgotou") + "</button>" +
        '<button type="button" class="btn btn--fantasma btn--pequeno" data-acao="editar">Editar</button>' +
        '<button type="button" class="btn btn--perigo btn--pequeno" data-acao="excluir" aria-label="Excluir ' + esc(p.nome) + '">Excluir</button>' +
      "</div></td></tr>";
  }

  function desenharTabela() {
    const lista = filtrados();
    const corpo = $("#corpoTabela");
    const vazia = $("#areaVazia");

    if (!produtos.length) {
      corpo.innerHTML = "";
      vazia.innerHTML = '<div class="estado-vazio"><h3>Nenhum produto cadastrado</h3>' +
        "<p>Comece cadastrando o primeiro item do cardápio.</p>" +
        '<button type="button" class="btn" data-novo>+ Novo produto</button></div>';
    } else if (!lista.length) {
      corpo.innerHTML = "";
      vazia.innerHTML = '<div class="estado-vazio"><h3>Nada encontrado</h3>' +
        "<p>Nenhum produto corresponde aos filtros aplicados.</p></div>";
    } else {
      vazia.innerHTML = "";
      corpo.innerHTML = lista.map(linha).join("");
    }

    $("#rodapeTabela").textContent = produtos.length
      ? "Exibindo " + lista.length + " de " + produtos.length + " produto(s)."
      : "";
  }

  ["#buscaAdmin", "#filtroCategoria", "#filtroSituacao"].forEach((sel) => {
    $(sel).addEventListener("input", desenharTabela);
    $(sel).addEventListener("change", desenharTabela);
  });

  /* ---------------- Ações da tabela ---------------- */
  $("#corpoTabela").addEventListener("click", async function (e) {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    const id = btn.closest("tr").getAttribute("data-id");
    const p = produtos.find((x) => x.id === id);
    if (!p) return;

    try {
      if (btn.getAttribute("data-acao") === "esgotar") {
        await DB.definirEsgotado(id, !p.esgotado);
        avisar(p.esgotado ? p.nome + " voltou ao cardápio." : p.nome + " marcado como esgotado.", "ok");
        await recarregar();
      } else if (btn.getAttribute("data-acao") === "editar") {
        abrirFormulario(p);
      } else if (btn.getAttribute("data-acao") === "excluir") {
        const ok = await confirmar({
          titulo: "Excluir produto",
          texto: 'Excluir "' + p.nome + '" definitivamente?\n\nSe for algo temporário, prefira desmarcar "Visível no cardápio".',
          confirmar: "Excluir", perigo: true,
        });
        if (!ok) return;
        await DB.excluirProduto(id);
        avisar("Produto excluído.", "ok");
        await recarregar();
      }
    } catch (err) {
      avisar(err.message || String(err), "erro");
    }
  });

  $("#areaVazia").addEventListener("click", (e) => {
    if (e.target.closest("[data-novo]")) abrirFormulario(null);
  });

  /* ---------------- Formulário ---------------- */
  function abrirFormulario(p) {
    limparErro($("#erroProduto"));
    $("#tituloProduto").textContent = p ? "Editar produto" : "Novo produto";
    $("#pId").value = p ? p.id : "";
    $("#pNome").value = p ? p.nome : "";
    $("#pDescricao").value = p ? p.descricao : "";
    $("#pCategoria").value = p ? p.categoria : "";
    $("#pPreco").value = p ? p.preco : "";
    $("#pOrdem").value = p ? p.ordem : produtos.length + 1;
    $("#pImagem").value = p ? p.imagem_url : "";
    $("#pAtivo").checked = p ? p.ativo : true;
    $("#pEsgotado").checked = p ? p.esgotado : false;
    $("#pAlcoolico").checked = p ? p.alcoolico : false;
    abrirModal("modalProduto");
  }

  $("#btnNovo").addEventListener("click", () => abrirFormulario(null));

  $("#formProduto").addEventListener("submit", async function (e) {
    e.preventDefault();
    limparErro($("#erroProduto"));
    const btn = $("#btnSalvar");
    btn.disabled = true;
    try {
      const salvo = await DB.salvarProduto({
        id: $("#pId").value || undefined,
        nome: $("#pNome").value,
        descricao: $("#pDescricao").value,
        categoria: $("#pCategoria").value,
        preco: $("#pPreco").value,
        ordem: $("#pOrdem").value,
        imagem_url: $("#pImagem").value,
        ativo: $("#pAtivo").checked,
        esgotado: $("#pEsgotado").checked,
        alcoolico: $("#pAlcoolico").checked,
      });
      fecharModal("modalProduto");
      avisar(salvo.nome + " salvo com sucesso.", "ok");
      await recarregar();
    } catch (err) {
      mostrarErro($("#erroProduto"), err.message || String(err));
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------------- Repor esgotados ---------------- */
  $("#btnRepor").addEventListener("click", async function () {
    const n = produtos.filter((p) => p.esgotado).length;
    if (!n) return;
    const ok = await confirmar({
      titulo: "Repor esgotados",
      texto: "Marcar os " + n + " item(ns) esgotado(s) como disponíveis novamente?",
      confirmar: "Repor tudo",
    });
    if (!ok) return;
    try {
      await DB.reporTodos();
      avisar("Todos os itens foram repostos.", "ok");
      await recarregar();
    } catch (err) { avisar(err.message, "erro"); }
  });

  /* ---------------- Reajuste ---------------- */
  function atualizarPrevia() {
    const pct = Number($("#rPercentual").value) || 0;
    const cat = $("#rCategoria").value;
    const alvo = produtos.filter((p) => !cat || p.categoria === cat);
    if (!alvo.length) { $("#previaReajuste").textContent = "Nenhum produto no alvo selecionado."; return; }
    const ex = alvo[0];
    const novo = Math.round(ex.preco * (1 + pct / 100) * 100) / 100;
    $("#previaReajuste").innerHTML =
      "Serão alterados <strong>" + alvo.length + "</strong> produto(s). Exemplo: " +
      esc(ex.nome) + " passa de " + moeda(ex.preco) + " para <strong>" + moeda(novo) + "</strong>.";
  }

  $("#btnReajuste").addEventListener("click", () => { atualizarPrevia(); abrirModal("modalReajuste"); });
  $("#rPercentual").addEventListener("input", atualizarPrevia);
  $("#rCategoria").addEventListener("change", atualizarPrevia);

  $("#formReajuste").addEventListener("submit", async function (e) {
    e.preventDefault();
    const pct = Number($("#rPercentual").value);
    const cat = $("#rCategoria").value;
    const ok = await confirmar({
      titulo: "Confirmar reajuste",
      texto: "Aplicar " + pct + "% em " + (cat || "todos os produtos") + "?\nOs preços mudam imediatamente no cardápio.",
      confirmar: "Aplicar",
    });
    if (!ok) return;
    try {
      const n = await DB.reajustarPrecos(pct, cat || null);
      fecharModal("modalReajuste");
      avisar(n + " produto(s) reajustado(s).", "ok");
      await recarregar();
    } catch (err) { avisar(err.message, "erro"); }
  });

  /* ---------------- Manutenção ---------------- */
  $("#btnMais").addEventListener("click", () => abrirModal("modalMais"));

  $("#btnExportar").addEventListener("click", function () {
    const conteudo = JSON.stringify({ exportadoEm: new Date().toISOString(), produtos: produtos }, null, 2);
    const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "front-beer-cardapio-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    avisar("Cópia de segurança baixada.", "ok");
  });

  $("#btnExemplos").addEventListener("click", async function () {
    const ok = await confirmar({
      titulo: "Restaurar exemplos",
      texto: "Isto adiciona novamente os itens de exemplo ao cardápio. Deseja continuar?",
      confirmar: "Restaurar",
    });
    if (!ok) return;
    try {
      await DB.restaurarExemplos();
      fecharModal("modalMais");
      avisar("Itens de exemplo restaurados.", "ok");
      await recarregar();
    } catch (err) { avisar(err.message, "erro"); }
  });

  $("#btnLimpar").addEventListener("click", async function () {
    const ok = await confirmar({
      titulo: "Limpar cardápio",
      texto: "Apagar TODOS os " + produtos.length + " produtos?\n\nUse apenas para remover os itens de exemplo antes de cadastrar o cardápio real. Esta ação não pode ser desfeita.",
      confirmar: "Apagar tudo", perigo: true,
    });
    if (!ok) return;
    const certeza = await confirmar({
      titulo: "Confirmação final",
      texto: "O cardápio ficará vazio até você cadastrar os produtos. Prosseguir?",
      confirmar: "Sim, apagar", perigo: true,
    });
    if (!certeza) return;
    try {
      await DB.limparCardapio();
      fecharModal("modalMais");
      avisar("Cardápio limpo. Cadastre os produtos da casa.", "ok");
      await recarregar();
    } catch (err) { avisar(err.message, "erro"); }
  });

  /* ---------------- Início ---------------- */
  (async function iniciar() {
    $$("[data-marca]").forEach((el) => { el.innerHTML = marcaFormatada(); });
    await DB.init();
    if (DB.modo === "demo") $("#notaDemo").classList.remove("oculto");
    const usuario = await DB.usuarioAtual();
    if (usuario) await entrarNoPainel(usuario);
  })();
})();
