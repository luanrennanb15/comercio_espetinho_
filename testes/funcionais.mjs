/* =====================================================================
   Testes funcionais — os fluxos de verdade, módulo a módulo

   Os unitários provam que uma função calcula certo. Estes provam que a
   casa funciona: cadastrar um produto, vender no balcão, abrir uma
   comanda, fechar a conta e ver o dinheiro aparecer no relatório.

   Tudo roda em modo demonstração, contra o armazenamento local. Nenhum
   teste toca no banco do cliente nem depende de internet.
   ===================================================================== */

import { suite, conf, confErro, abrirTela, encerrar } from "./ajuda.mjs";

/* Abre uma tela interna só para pegar a camada de dados isolada. */
async function bancoLimpo() {
  const { window } = await abrirTela("admin.html", {
    semBanco: true,
    scripts: ["config.js", "ui.js", "db.js"],
    antes(w) {
      /* Começo com produtos, vendas e custos zerados. As comandas ficam
         de fora de propósito: quando a chave não existe, o sistema cria
         os 20 cartões sozinho, e é justamente esse caminho que interessa
         testar — é o que acontece na primeira vez que a casa abre. */
      w.localStorage.setItem("frontbeer:produtos", "[]");
      w.localStorage.setItem("frontbeer:vendas", "[]");
      w.localStorage.setItem("frontbeer:custos", "{}");   // custos são um mapa, não uma lista
      w.localStorage.removeItem("frontbeer:comandas");
    },
  });
  await window.DB.init();
  return window;
}

/* ================================================================
   MÓDULO 1 — Cadastro de produtos
   ================================================================ */
suite("Funcional — cadastro de produtos");

{
  const w = await bancoLimpo();
  const DB = w.DB;

  const salvo = await DB.salvarProduto({
    nome: "  Espeto de Cupim  ", descricao: "Fatiado, na brasa",
    categoria: "espetos", preco: "13.50", alcoolico: false, ordem: 1,
  });
  conf("salva e devolve o produto", !!salvo && !!salvo.id);
  conf("apara espaços do nome", salvo.nome === "Espeto de Cupim");
  conf("preço em texto vira número", salvo.preco === 13.5);
  conf("nasce visível no cardápio", salvo.ativo === true);
  conf("nasce disponível, não esgotado", salvo.esgotado === false);

  const lista = await DB.listarProdutos(false);
  conf("aparece na listagem", lista.length === 1 && lista[0].nome === "Espeto de Cupim");

  await confErro("recusa produto sem nome",
    () => DB.salvarProduto({ nome: "   ", preco: 10 }), /nome/i);
  await confErro("recusa preço negativo",
    () => DB.salvarProduto({ nome: "Teste", categoria: "X", preco: -5 }), /pre[çc]o/i);
  await confErro("recusa endereço de imagem perigoso",
    () => DB.salvarProduto({ nome: "Teste", categoria: "X", preco: 5, imagem_url: "javascript:alert(1)" }), /foto|imagem|link/i);

  /* Esgotar não é o mesmo que esconder: esgotado continua no cardápio,
     riscado, para o cliente saber que existe e acabou hoje. */
  await DB.definirEsgotado(salvo.id, true);
  const visiveis = await DB.listarProdutos(true);
  conf("esgotado continua aparecendo para o cliente", visiveis.length === 1);
  conf("mas marcado como esgotado", visiveis[0].esgotado === true);

  await DB.definirAtivo(salvo.id, false);
  conf("oculto some do cardápio do cliente", (await DB.listarProdutos(true)).length === 0);
  conf("mas continua no painel", (await DB.listarProdutos(false)).length === 1);

  await DB.definirAtivo(salvo.id, true);
  await DB.reporTodos();
  conf("repor esgotados devolve tudo à venda",
    (await DB.listarProdutos(true))[0].esgotado === false);

  const antes = (await DB.listarProdutos(false))[0].preco;
  await DB.reajustarPrecos(10);
  const depois = (await DB.listarProdutos(false))[0].preco;
  conf("reajuste de 10% sobe o preço", depois > antes);
  conf("reajuste calcula certo", Math.abs(depois - Math.round(antes * 1.1 * 100) / 100) < 0.01,
    antes + " -> " + depois);

  await DB.excluirProduto(salvo.id);
  conf("excluir some do cadastro", (await DB.listarProdutos(false)).length === 0);
  w.close();
}

/* ================================================================
   MÓDULO 2 — Venda no caixa
   ================================================================ */
suite("Funcional — venda no caixa");

{
  const w = await bancoLimpo();
  const DB = w.DB;

  const cerveja = await DB.salvarProduto({ nome: "Cerveja Lata 350ml", categoria: "Cervejas", preco: 6.5, ordem: 1 });
  const espeto  = await DB.salvarProduto({ nome: "Espeto de Frango",   categoria: "Espetos",  preco: 9,   ordem: 2 });

  const venda = await DB.registrarVenda({
    pagamento: "pix",
    itens: [
      { produto_id: cerveja.id, nome: cerveja.nome, categoria: cerveja.categoria, preco_unit: 6.5, quantidade: 3 },
      { produto_id: espeto.id,  nome: espeto.nome,  categoria: espeto.categoria,  preco_unit: 9,   quantidade: 2 },
    ],
  });
  conf("a venda é registrada", !!venda && !!venda.id);
  conf("o total soma certo (3×6,50 + 2×9,00 = 37,50)", venda.total === 37.5, "veio " + venda.total);

  const vendas = await DB.listarVendas();
  conf("a venda aparece no histórico", vendas.length === 1);
  conf("a forma de pagamento é preservada", vendas[0].pagamento === "pix");
  conf("os itens vêm junto", (vendas[0].itens || []).length === 2);

  /* O ponto mais importante do módulo: o preço é congelado na venda.
     Reajustar o cardápio hoje não pode reescrever o faturamento de ontem. */
  await DB.reajustarPrecos(50);
  const depoisDoReajuste = await DB.listarVendas();
  conf("reajustar preço NÃO altera venda passada",
    depoisDoReajuste[0].total === 37.5,
    "o faturamento de ontem mudou sozinho: " + depoisDoReajuste[0].total);
  conf("o nome do item também fica congelado",
    depoisDoReajuste[0].itens.some((i) => i.nome === "Cerveja Lata 350ml"));

  await confErro("recusa venda sem item", () => DB.registrarVenda({ itens: [] }), /item/i);

  const invalida = await DB.registrarVenda({
    pagamento: "bitcoin",
    itens: [{ nome: "X", preco_unit: 10, quantidade: 1 }],
  });
  conf("pagamento desconhecido vira dinheiro, não quebra", invalida.pagamento === "dinheiro");

  const muitos = await DB.registrarVenda({
    itens: [{ nome: "Y", preco_unit: 1, quantidade: 99999 }],
  });
  conf("quantidade absurda é limitada", muitos.itens[0].quantidade <= 999);

  await DB.excluirVenda(venda.id);
  conf("estornar remove a venda", (await DB.listarVendas()).every((v) => v.id !== venda.id));
  w.close();
}

/* ================================================================
   MÓDULO 3 — Ciclo da comanda
   ================================================================ */
suite("Funcional — ciclo completo da comanda");

{
  const w = await bancoLimpo();
  const DB = w.DB;
  const espeto = await DB.salvarProduto({ nome: "Espeto de Carne", categoria: "Espetos", preco: 10, ordem: 1 });

  let comandas = await DB.listarComandas();
  conf("a casa nasce com 20 cartões prontos", comandas.length === 20, "vieram " + comandas.length);
  conf("todos começam livres", comandas.every((c) => c.status === "livre"));

  const n1 = comandas[0];
  await DB.abrirComanda(n1.id);
  const aberta = (await DB.listarComandas()).find((c) => c.id === n1.id);
  conf("abrir muda o cartão para em uso", aberta.status === "em_uso");
  conf("o cartão ganha um código para o QR", !!aberta.token && aberta.token.length >= 8);

  await DB.lancarItem(n1.id, { produto_id: espeto.id, nome: espeto.nome, categoria: espeto.categoria, preco_unit: 10, quantidade: 2 });
  await DB.lancarItem(n1.id, { produto_id: espeto.id, nome: espeto.nome, categoria: espeto.categoria, preco_unit: 10, quantidade: 1 });

  const extrato = await DB.extratoComanda(aberta.token);
  conf("o cliente consegue ler o extrato pelo código", extrato.encontrada === true);
  conf("o extrato mostra a comanda aberta", extrato.aberta === true);
  conf("o total do extrato bate (3 × R$ 10)", Number(extrato.total) === 30, "veio " + extrato.total);

  /* Privacidade: o código de um cartão não pode abrir a conta de outro. */
  const outro = (await DB.listarComandas()).find((c) => c.id !== n1.id);
  const invasao = await DB.extratoComanda("codigo-que-nao-existe-123456");
  conf("código inventado não devolve conta de ninguém", invasao.encontrada === false);
  conf("cada cartão tem seu próprio código", !outro.token || outro.token !== aberta.token);

  const fechada = await DB.fecharComanda(n1.id, "debito");
  conf("fechar gera a venda", !!fechada && !!fechada.id);
  conf("o valor da venda é o da comanda", fechada.total === 30, "veio " + fechada.total);
  conf("a venda entra no faturamento", (await DB.listarVendas()).length === 1);

  const depois = (await DB.listarComandas()).find((c) => c.id === n1.id);
  conf("o cartão volta a ficar livre", depois.status === "livre");

  /* O link do cliente tem que morrer junto com a conta: senão o cartão
     entregue ao próximo cliente mostraria o consumo do anterior. */
  const extratoMorto = await DB.extratoComanda(aberta.token);
  conf("o link antigo para de mostrar o consumo",
    extratoMorto.encontrada === false || extratoMorto.aberta === false,
    "o cliente seguinte veria a conta do anterior");
  w.close();
}

/* ================================================================
   MÓDULO 4 — Cardápio do cliente
   ================================================================ */
suite("Funcional — cardápio do cliente");

{
  const produtos = [
    { id: "1", nome: "Espeto de Carne",  categoria: "Espetos",  preco: 10, ativo: true,  esgotado: false, ordem: 1 },
    { id: "2", nome: "Caipirinha",       categoria: "Doses",    preco: 18, ativo: true,  esgotado: false, alcoolico: true, ordem: 2 },
    { id: "3", nome: "Água Mineral",     categoria: "Sem Álcool", preco: 4, ativo: true, esgotado: true,  ordem: 3 },
    { id: "4", nome: "Item Escondido",   categoria: "Espetos",  preco: 99, ativo: false, esgotado: false, ordem: 4 },
  ];

  const t = await abrirTela("index.html", {
    semBanco: true,
    antes(w) { w.localStorage.setItem("frontbeer:produtos", JSON.stringify(produtos)); },
  });
  const doc = t.doc;
  const texto = doc.body.textContent || "";

  conf("mostra os itens visíveis", /Espeto de Carne/.test(texto) && /Caipirinha/.test(texto));
  conf("NÃO mostra item oculto", !/Item Escondido/.test(texto),
    "um item desativado vazou para o cardápio público");
  conf("mostra o esgotado, marcado", /Água Mineral/.test(texto));
  conf("cria uma aba por categoria", doc.querySelectorAll(".aba").length >= 4);
  conf("a primeira aba é Todos", (doc.querySelector(".aba") || {}).textContent === "Todos");
  conf("marca 18+ na bebida alcoólica",
    /18\+/.test(doc.body.innerHTML) || !!doc.querySelector(".selo--ouro, .selo"));
  conf("os preços aparecem formatados", /R\$\s?10,00/.test(texto));

  /* Busca */
  const busca = doc.querySelector("#busca");
  busca.value = "caipirinha";
  busca.dispatchEvent(new t.window.Event("input"));
  await new Promise((r) => setTimeout(r, 60));
  const apos = doc.querySelector("#cardapio").textContent || "";
  conf("a busca filtra", /Caipirinha/.test(apos) && !/Espeto de Carne/.test(apos));

  busca.value = "agua";
  busca.dispatchEvent(new t.window.Event("input"));
  await new Promise((r) => setTimeout(r, 60));
  conf("a busca ignora acento (agua encontra Água)",
    /Água Mineral/.test(doc.querySelector("#cardapio").textContent || ""));

  busca.value = "zzzzz";
  busca.dispatchEvent(new t.window.Event("input"));
  await new Promise((r) => setTimeout(r, 60));
  conf("busca sem resultado explica em vez de mostrar vazio",
    /nada encontrado|nenhum/i.test(doc.querySelector("#cardapio").textContent || ""));
  t.fechar();
}

/* ================================================================
   MÓDULO 5 — Custos e lucro
   ================================================================ */
suite("Funcional — custo, markup e lucro");

{
  const w = await bancoLimpo();
  const DB = w.DB;
  const p = await DB.salvarProduto({ nome: "Cerveja Lata", categoria: "Cervejas", preco: 11, ordem: 1 });

  /* Fardo de 12 latas por R$ 77,88 — o caso real do balcão. */
  await DB.salvarCusto(p.id, { custo_compra: 77.88, rende_unidades: 12, embalagem: "fardo com 12" });
  const custos = await DB.listarCustos();
  conf("o custo é gravado e devolvido", !!custos[p.id]);

  const unit = DB.custoUnitario(custos[p.id]);
  conf("custo por lata = R$ 6,49", Math.abs(unit - 6.49) < 0.005, "veio " + unit);
  conf("vendendo a R$ 11 o ganho é 69,5% sobre o custo",
    Math.abs(DB.markupDe(11, unit) - 69.5) < 0.1, "veio " + DB.markupDe(11, unit));

  /* O custo é dado sensível: não pode viajar junto do cardápio público. */
  const publico = await DB.listarProdutos(true);
  conf("o custo NÃO viaja no cardápio do cliente",
    publico.every((x) => x.custo_compra === undefined && x.custo_unit === undefined),
    "o preço de compra vazaria para qualquer visitante");

  await DB.registrarVenda({
    pagamento: "dinheiro",
    itens: [{ produto_id: p.id, nome: p.nome, categoria: p.categoria, preco_unit: 11, quantidade: 10, custo_unit: unit }],
  });
  const v = (await DB.listarVendas())[0];
  const lucro = v.itens.reduce((s, i) => s + (i.preco_unit - (i.custo_unit || 0)) * i.quantidade, 0);
  conf("o lucro de 10 latas fecha em R$ 45,10",
    Math.abs(lucro - 45.1) < 0.05, "veio " + lucro.toFixed(2));

  await DB.apagarCusto(p.id);
  conf("apagar o custo funciona", !(await DB.listarCustos())[p.id]);
  w.close();
}

/* ================================================================
   MÓDULO 6 — Relatórios
   ================================================================ */
suite("Funcional — agregação dos relatórios");

{
  const w = await bancoLimpo();
  const DB = w.DB;

  const cerveja = await DB.salvarProduto({ nome: "Cerveja", categoria: "Cervejas", preco: 6.5, ordem: 1 });
  const espeto  = await DB.salvarProduto({ nome: "Espeto",  categoria: "Espetos",  preco: 10,  ordem: 2 });

  await DB.registrarVenda({ pagamento: "pix",      itens: [{ produto_id: cerveja.id, nome: "Cerveja", categoria: "Cervejas", preco_unit: 6.5, quantidade: 4 }] });
  await DB.registrarVenda({ pagamento: "dinheiro", itens: [{ produto_id: espeto.id,  nome: "Espeto",  categoria: "Espetos",  preco_unit: 10,  quantidade: 3 }] });
  await DB.registrarVenda({ pagamento: "pix",      itens: [{ produto_id: cerveja.id, nome: "Cerveja", categoria: "Cervejas", preco_unit: 6.5, quantidade: 2 }] });

  const vendas = await DB.listarVendas();
  const faturamento = vendas.reduce((s, v) => s + v.total, 0);
  conf("faturamento total = 26 + 30 + 13 = R$ 69,00",
    Math.abs(faturamento - 69) < 0.01, "veio " + faturamento);
  conf("ticket médio = R$ 23,00",
    Math.abs(faturamento / vendas.length - 23) < 0.01);

  const porItem = {};
  vendas.forEach((v) => (v.itens || []).forEach((i) => {
    porItem[i.nome] = (porItem[i.nome] || 0) + i.quantidade;
  }));
  conf("mais vendido é a cerveja, com 6 unidades", porItem["Cerveja"] === 6, JSON.stringify(porItem));
  conf("o espeto conta 3", porItem["Espeto"] === 3);

  const porPag = {};
  vendas.forEach((v) => (porPag[v.pagamento] = (porPag[v.pagamento] || 0) + v.total));
  conf("pix soma R$ 39,00", Math.abs(porPag.pix - 39) < 0.01, JSON.stringify(porPag));
  conf("dinheiro soma R$ 30,00", Math.abs(porPag.dinheiro - 30) < 0.01);
  conf("cada venda tem data para o gráfico diário",
    vendas.every((v) => !isNaN(new Date(v.criado_em).getTime())));
  w.close();
}

/* ================================================================
   MÓDULO 7 — Isolamento entre módulos
   ================================================================ */
suite("Funcional — um módulo não contamina o outro");

{
  const w = await bancoLimpo();
  const DB = w.DB;
  const p = await DB.salvarProduto({ nome: "Produto Vendido", categoria: "X", preco: 5, ordem: 1 });
  await DB.registrarVenda({ itens: [{ produto_id: p.id, nome: p.nome, categoria: "X", preco_unit: 5, quantidade: 1 }] });

  /* Apagar o cardápio é uma operação de manutenção. Ela não pode levar
     o faturamento junto: contabilidade não se apaga por engano. */
  await DB.limparCardapio();
  conf("limpar o cardápio apaga os produtos", (await DB.listarProdutos(false)).length === 0);
  conf("mas o faturamento continua lá", (await DB.listarVendas()).length === 1,
    "apagar o cardápio levou as vendas junto");
  conf("e o histórico ainda sabe o que foi vendido",
    (await DB.listarVendas())[0].itens[0].nome === "Produto Vendido");
  w.close();
}

encerrar();
