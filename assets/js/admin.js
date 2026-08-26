/* =====================================================================
   FRONT BEER — Painel interno
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, urlSegura, moeda, chave, $, $$, avisar, abrirModal, fecharModal, confirmar } = UI;

  let produtos = [];
  let custos = {};                    // { produto_id: { custo_compra, rende_unidades, ... } }
  const GANHO_BOM = 100;             // markup de 100% = dobrar o dinheiro

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
      custos = await DB.listarCustos();
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

  /* Ganho sobre o custo (markup) para a lista, já com a cor da faixa */
  function margemDoProduto(p) {
    const unitario = DB.custoUnitario(custos[p.id]);
    if (unitario == null) {
      return '<span class="margem-celula vazia">sem custo</span>';
    }
    const k = DB.markupDe(p.preco, unitario);
    const faixa = k == null ? "vazia" : k < 0 ? "ruim" : k < GANHO_BOM ? "baixa" : "ok";
    return '<span class="margem-celula ' + faixa + '" title="Custo ' + moeda(unitario) +
      ' por unidade · lucro ' + moeda(p.preco - unitario) + ' por venda">' +
      (k == null ? "—" : String(k).replace(".", ",") + "%") + "</span>";
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
      '<td data-rotulo="Margem">' + margemDoProduto(p) + "</td>" +
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
        if (p.imagem_url) DB.apagarFoto(p.imagem_url);
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

  /* Reaproveita a categoria já existente quando o dono digita com outra
     grafia — "cervejas", "CERVEJAS" e "Cervejas " viram a mesma seção.
     Categoria nova continua sendo criada livremente. */
  function categoriaCanonica(texto) {
    const digitada = String(texto || "").trim().replace(/\s+/g, " ");
    if (!digitada) return "";
    const alvo = chave(digitada);
    const existente = produtos.find(function (p) { return chave(p.categoria) === alvo; });
    return existente ? existente.categoria : digitada;
  }

  /* ---------------- Custo e margem ---------------- */

  /* Conversão para a unidade base: tudo vira ml ou g, para o dono poder
     digitar "1 L" ou "5 kg" sem converter na mão. */
  const FATOR = { L: 1000, ml: 1, kg: 1000, g: 1 };
  const BASE  = { L: "ml", ml: "ml", kg: "g", g: "g" };

  let modoCompra = "unidade";        // unidade | medida

  function trocarModo(novo) {
    modoCompra = novo;
    $$(".modo-compra__opcao").forEach((b) =>
      b.classList.toggle("ativa", b.getAttribute("data-modo") === novo));
    $("#areaMedida").classList.toggle("oculto", novo !== "medida");
    $("#cRende").readOnly = novo === "medida";
    $("#ajudaRende").textContent = novo === "medida"
      ? "Calculado a partir das medidas acima. Ajuste manualmente se houver perda no copo."
      : "Quantas unidades de venda saem dessa compra.";
    if (novo === "medida") $("#cRende").readOnly = false;   // permitir correção
    calcularRendimento();
  }

  /* Converte as medidas em rendimento e escreve no campo de unidades */
  function calcularRendimento() {
    const dica = $("#dicaRendimento");
    if (modoCompra !== "medida") { dica.classList.add("oculto"); return; }

    const unidade = $("#cUnidade").value;
    $("#ajudaPorcao").textContent = "em " + BASE[unidade];

    const total = Number($("#cTotal").value) * (FATOR[unidade] || 1);
    const porcao = Number($("#cPorcao").value);

    if (!total || !porcao || porcao <= 0) {
      dica.classList.add("oculto");
      return;
    }

    const rende = Math.round((total / porcao) * 1000) / 1000;
    $("#cRende").value = rende;

    const compra = Number($("#cCompra").value);
    const unitario = compra ? Math.round((compra / rende) * 100) / 100 : null;

    dica.classList.remove("oculto");
    dica.innerHTML =
      "<strong>" + total.toLocaleString("pt-BR") + " " + BASE[unidade] +
      " ÷ " + porcao.toLocaleString("pt-BR") + " " + BASE[unidade] + " = " +
      String(rende).replace(".", ",") + " doses</strong>" +
      (unitario ? " · custo de " + moeda(unitario) + " por dose" : "") +
      "<br>Se sobrar líquido no fundo ou houver perda no copo, corrija o rendimento no campo abaixo.";

    pintarCalculadora();
  }

  $("#modoCompra").addEventListener("click", function (e) {
    const btn = e.target.closest(".modo-compra__opcao");
    if (btn) trocarModo(btn.getAttribute("data-modo"));
  });

  ["#cTotal", "#cPorcao", "#cUnidade"].forEach(function (sel) {
    $(sel).addEventListener("input", calcularRendimento);
    $(sel).addEventListener("change", calcularRendimento);
  });

  function lerCustoDoFormulario() {
    const compra = Number($("#cCompra").value);
    const rende = Number($("#cRende").value);
    if (!compra || !rende) return null;
    const unidade = $("#cUnidade").value;
    const usaMedida = modoCompra === "medida" && Number($("#cTotal").value) > 0;

    return {
      custo_compra: compra,
      rende_unidades: rende,
      embalagem: $("#cEmbalagem").value,
      fornecedor: $("#cFornecedor").value,
      medida_total: usaMedida ? Number($("#cTotal").value) * (FATOR[unidade] || 1) : null,
      medida_porcao: usaMedida ? Number($("#cPorcao").value) : null,
      medida_unidade: usaMedida ? BASE[unidade] : "",
    };
  }

  function pintarCalculadora() {
    const custo = lerCustoDoFormulario();
    const unitario = DB.custoUnitario(custo);
    const preco = Number($("#pPreco").value);
    const alvo = Number($("#cMargemAlvo").value);

    $("#calcUnitario").textContent = unitario == null ? "—" : moeda(unitario);

    /* Uma régua só: ganho sobre o CUSTO (markup), que é como o balcão
       raciocina — "botei o dobro" são 100%. Mostrar margem junto só
       confundiria quem vai usar isso todo dia. */
    const k = DB.markupDe(preco, unitario);
    const elMarkup = $("#calcMarkup");

    if (k == null) {
      elMarkup.textContent = "—";
      elMarkup.className = "";
    } else {
      elMarkup.textContent = String(k).replace(".", ",") + "%" +
        (preco > 0 ? " · lucro de " + moeda(preco - unitario) : "");
      elMarkup.className = k < 0 ? "ruim" : k < GANHO_BOM ? "baixa" : "ok";
    }

    /* Preço que atinge a margem desejada.
       Se o preço digitado já alcança a meta, não faz sentido sugerir
       outro — antes o botão mostrava um valor diferente do campo acima
       e os dois números se contradiziam na tela. */
    const sugerido = DB.precoParaMarkup(unitario, alvo);
    const botao = $("#btnUsarSugerido");
    const rotulo = $("#calcSugerido");

    if (sugerido == null) {
      rotulo.textContent = "—";
      botao.disabled = true;
      botao.firstChild.textContent = "Usar ";
    } else if (k != null && k + 0.05 >= alvo) {
      rotulo.textContent = "";
      botao.disabled = true;
      botao.firstChild.textContent = "Preço atual já atende";
    } else {
      rotulo.textContent = moeda(sugerido);
      botao.disabled = false;
      botao.firstChild.textContent = "Usar ";
    }

    /* Aviso de prejuízo — o erro que custa dinheiro de verdade */
    const aviso = $("#calcAviso");
    if (unitario != null && preco > 0 && preco < unitario) {
      aviso.textContent = "Atenção: o preço de venda está ABAIXO do custo. " +
        "Cada unidade vendida dá prejuízo de " + moeda(unitario - preco) + ".";
      aviso.classList.remove("oculto");
    } else if (unitario != null && preco > 0 && k != null && k < 15) {
      aviso.textContent = "Ganho muito apertado. Depois de carvão, gelo e gás, " +
        "esse item provavelmente não paga o próprio trabalho.";
      aviso.classList.remove("oculto");
    } else {
      aviso.classList.add("oculto");
    }
  }

  /* Quando o dono digita o preço direto, a "margem desejada" passa a
     refletir esse preço. Sem isso ela ficaria parada no valor antigo e a
     sugestão apontaria um preço diferente do que está no campo acima —
     dois números se contradizendo na mesma tela. */
  function sincronizarMargemAlvo() {
    const unitario = DB.custoUnitario(lerCustoDoFormulario());
    const k = DB.markupDe(Number($("#pPreco").value), unitario);
    if (k != null && k > 0) $("#cMargemAlvo").value = k;
  }

  $("#pPreco").addEventListener("input", function () {
    sincronizarMargemAlvo();
    pintarCalculadora();
  });

  ["#cCompra", "#cRende", "#cMargemAlvo"].forEach(function (sel) {
    $(sel).addEventListener("input", pintarCalculadora);
  });

  /* Mexer no custo também reacerta a margem desejada */
  ["#cCompra", "#cRende"].forEach(function (sel) {
    $(sel).addEventListener("input", sincronizarMargemAlvo);
  });

  $("#btnUsarSugerido").addEventListener("click", function () {
    if (this.disabled) return;        // o preço atual já atende à meta
    const unitario = DB.custoUnitario(lerCustoDoFormulario());
    const sugerido = DB.precoParaMarkup(unitario, Number($("#cMargemAlvo").value));
    if (sugerido == null) return;
    $("#pPreco").value = sugerido.toFixed(2);
    pintarCalculadora();
  });

  /* ---------------- Foto do produto ---------------- */
  let fotoAnterior = "";        // foto que estava salva ao abrir o formulário

  function pintarFoto(url) {
    const previa = $("#fotoPrevia");
    const segura = urlSegura(url);
    if (segura) {
      previa.innerHTML = '<img src="' + esc(segura) + '" alt="Prévia da foto">';
      $("#btnRemoverFoto").classList.remove("oculto");
    } else {
      previa.innerHTML = '<span class="foto-previa__vazia">sem foto</span>';
      $("#btnRemoverFoto").classList.add("oculto");
    }
  }

  function estadoFoto(texto, tipo) {
    const el = $("#fotoEstado");
    el.textContent = texto;
    el.className = "foto-estado" + (tipo ? " " + tipo : "");
  }

  const TEXTO_FOTO_PADRAO =
    "Tire a foto pelo celular ou escolha do computador. Ela é reduzida automaticamente antes do envio.";

  $("#btnEscolherFoto").addEventListener("click", function () { $("#pArquivo").click(); });

  $("#pArquivo").addEventListener("change", async function (e) {
    const arquivo = e.target.files && e.target.files[0];
    e.target.value = "";                       // permite reenviar o mesmo arquivo
    if (!arquivo) return;

    const botao = $("#btnEscolherFoto");
    botao.disabled = true;
    try {
      const url = await DB.enviarFoto(arquivo, function (passo) { estadoFoto(passo, "enviando"); });
      $("#pImagem").value = url;
      pintarFoto(url);
      const kb = Math.round(arquivo.size / 1024);
      estadoFoto("Foto enviada. Original tinha " + (kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB") + ".", "");
    } catch (err) {
      estadoFoto(err.message || "Falha ao enviar a foto.", "erro");
    } finally {
      botao.disabled = false;
    }
  });

  $("#btnRemoverFoto").addEventListener("click", function () {
    $("#pImagem").value = "";
    pintarFoto("");
    estadoFoto(TEXTO_FOTO_PADRAO, "");
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
    fotoAnterior = p ? p.imagem_url : "";
    pintarFoto(p ? p.imagem_url : "");
    estadoFoto(TEXTO_FOTO_PADRAO, "");
    const custo = p ? custos[p.id] : null;
    $("#cCompra").value     = custo ? custo.custo_compra : "";
    $("#cRende").value      = custo ? custo.rende_unidades : "";
    $("#cEmbalagem").value  = custo ? custo.embalagem : "";
    $("#cFornecedor").value = custo ? custo.fornecedor : "";

    /* Reconstrói o modo por medida quando o produto foi cadastrado assim */
    if (custo && custo.medida_total && custo.medida_porcao) {
      const emLitroOuQuilo = custo.medida_total >= 1000;
      const unidadeBase = custo.medida_unidade === "g" ? "g" : "ml";
      const unidadeExibida = emLitroOuQuilo
        ? (unidadeBase === "g" ? "kg" : "L")
        : unidadeBase;
      $("#cUnidade").value = unidadeExibida;
      $("#cTotal").value = custo.medida_total / (FATOR[unidadeExibida] || 1);
      $("#cPorcao").value = custo.medida_porcao;
      trocarModo("medida");
    } else {
      $("#cTotal").value = "";
      $("#cPorcao").value = "";
      $("#cUnidade").value = "L";
      trocarModo("unidade");
    }

    sincronizarMargemAlvo();
    pintarCalculadora();

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
        categoria: categoriaCanonica($("#pCategoria").value),
        preco: $("#pPreco").value,
        ordem: $("#pOrdem").value,
        imagem_url: $("#pImagem").value,
        ativo: $("#pAtivo").checked,
        esgotado: $("#pEsgotado").checked,
        alcoolico: $("#pAlcoolico").checked,
      });
      /* Custo vai para a tabela protegida, nunca junto do produto */
      const custoInformado = lerCustoDoFormulario();
      if (custoInformado) await DB.salvarCusto(salvo.id, custoInformado);
      else if (custos[salvo.id]) await DB.apagarCusto(salvo.id);

      if (fotoAnterior && fotoAnterior !== salvo.imagem_url) {
        DB.apagarFoto(fotoAnterior);           // libera espaço da foto trocada
      }
      fotoAnterior = salvo.imagem_url;
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
