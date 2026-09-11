/* =====================================================================
   Testes de integridade das telas

   Aqui não se testa lógica, e sim as coisas que quebram em silêncio:
   um arquivo renomeado e não atualizado no HTML, um id repetido, uma
   versão de cache esquecida, um formulário sem rótulo.

   São falhas que não aparecem no computador de quem programou — só no
   celular do cliente, semanas depois.
   ===================================================================== */

import { suite, conf, aviso, abrirTela, ler, existe, RAIZ, TODAS_TELAS, encerrar } from "./ajuda.mjs";
import fs from "fs";
import path from "path";

/* ================================================================
   1. Nada aponta para arquivo que não existe
   ================================================================ */
suite("Telas — arquivos referenciados existem");

const quebrados = [];
TODAS_TELAS.forEach((tela) => {
  const html = ler(tela);
  [...html.matchAll(/(?:src|href)="((?!https?:|mailto:|tel:|#|data:)[^"]+)"/g)].forEach((m) => {
    const alvo = m[1].split("?")[0].split("#")[0];
    if (!alvo || alvo.endsWith("/")) return;
    if (!existe(alvo)) quebrados.push(tela + " → " + alvo);
  });
});
conf("nenhum caminho aponta para arquivo inexistente", quebrados.length === 0, quebrados.join("\n         → "));

/* O caminho inverso: imagem na pasta que ninguém usa é peso morto no
   repositório e confunde quem for revender o sistema. */
const usadas = new Set();
const tudo = TODAS_TELAS.map(ler).join("\n") +
  fs.readdirSync(path.join(RAIZ, "assets/css")).map((f) => ler("assets/css/" + f)).join("\n") +
  fs.readdirSync(path.join(RAIZ, "assets/js")).map((f) => ler("assets/js/" + f)).join("\n");
const imagens = fs.readdirSync(path.join(RAIZ, "assets/img")).filter((f) => /\.(jpe?g|png|webp|svg)$/i.test(f));
imagens.forEach((img) => { if (tudo.includes(img)) usadas.add(img); });
aviso("nenhuma imagem sobrando na pasta",
  usadas.size === imagens.length,
  "sem uso: " + imagens.filter((i) => !usadas.has(i)).join(", "));

/* ================================================================
   2. Cache
   ================================================================ */
suite("Telas — controle de cache");

const versoes = new Set();
const semVersao = [];
TODAS_TELAS.forEach((tela) => {
  const html = ler(tela);
  [...html.matchAll(/(?:src|href)="(assets\/(?:js|css)\/[^"]+)"/g)].forEach((m) => {
    const [, v] = m[1].split("?v=");
    if (v) versoes.add(v); else semVersao.push(tela + " → " + m[1]);
  });
});
conf("todo CSS e JS local carrega com número de versão", semVersao.length === 0, semVersao.join(", "));
conf("a versão é a mesma em todas as telas", versoes.size === 1,
  "encontradas: " + [...versoes].join(", ") + " — telas com versão diferente servem código velho a quem já visitou");

/* ================================================================
   3. Estrutura do HTML
   ================================================================ */
suite("Telas — estrutura do HTML");

for (const tela of TODAS_TELAS) {
  const { doc, fechar } = await abrirTela(tela, { semBanco: true });

  const ids = [...doc.querySelectorAll("[id]")].map((e) => e.id);
  const repetidos = ids.filter((v, i) => ids.indexOf(v) !== i);
  conf(tela + ": nenhum id repetido", repetidos.length === 0, [...new Set(repetidos)].join(", "));

  conf(tela + ": tem título próprio",
    (doc.title || "").trim().length > 4 && doc.title !== "Documento");
  conf(tela + ": idioma declarado como pt-BR",
    doc.documentElement.getAttribute("lang") === "pt-BR");
  conf(tela + ": preparada para celular",
    !!doc.querySelector('meta[name="viewport"]'));

  const semAlt = [...doc.querySelectorAll("img")].filter((i) => i.getAttribute("alt") === null);
  conf(tela + ": toda imagem tem texto alternativo", semAlt.length === 0,
    semAlt.map((i) => i.getAttribute("src")).join(", "));

  /* Um campo sem rótulo é invisível para leitor de tela e ambíguo para
     todo mundo. Aceito <label for>, aria-label ou aria-labelledby. */
  const semRotulo = [...doc.querySelectorAll("input, select, textarea")].filter((c) => {
    if (c.type === "hidden") return false;
    if (c.getAttribute("aria-label") || c.getAttribute("aria-labelledby") || c.getAttribute("title")) return false;
    if (c.id && doc.querySelector('label[for="' + c.id + '"]')) return false;
    return !c.closest("label");
  });
  conf(tela + ": todo campo tem rótulo", semRotulo.length === 0,
    semRotulo.map((c) => c.id || c.name || c.type).join(", "));

  const semTipo = [...doc.querySelectorAll("button")].filter((b) => !b.getAttribute("type"));
  conf(tela + ": todo botão declara o tipo", semTipo.length === 0,
    "botão sem type dentro de <form> envia o formulário sem querer: " +
    semTipo.map((b) => (b.textContent || "").trim().slice(0, 20)).join(" | "));

  fechar();
}

/* ================================================================
   4. Identidade e conformidade legal
   ================================================================ */
suite("Telas — identidade e obrigações legais");

const publico = await abrirTela("index.html", { semBanco: true });
const textoPublico = publico.doc.body.textContent || "";

conf("aviso de venda a menores, exigido por lei", /menores de 18 anos/i.test(textoPublico));
conf("cita a lei que obriga o aviso", /13\.106/.test(textoPublico));
conf("avisa que não há entrega", /n[ãa]o realizamos entregas/i.test(textoPublico));
conf("avisa que o preço pode mudar", /pre[çc]os sujeitos a altera/i.test(textoPublico));
conf("o nome da casa aparece", /Front Beer/.test(textoPublico));
conf("o endereço aparece", /Saladino/.test(textoPublico));
conf("a cidade aparece no cardápio", /Sorocaba/.test(textoPublico));
conf("o horário aparece", /16h/.test(textoPublico));

const cfg = publico.window.APP_CONFIG;
conf("telefone e WhatsApp são o mesmo número",
  cfg.whatsapp.replace(/\D/g, "").endsWith(cfg.telefone.replace(/\D/g, "")),
  "telefone " + cfg.telefone + " · whatsapp " + cfg.whatsapp);
conf("o WhatsApp tem o código do país", /^55\d{10,11}$/.test(cfg.whatsapp));
conf("o endereço tem bairro e cidade", /Sorocaba/i.test(cfg.endereco) && /Vit[óo]ria R[ée]gia/i.test(cfg.endereco));
conf("existe link de 'Como chegar'", !!cfg.mapaUrl && /^https:\/\/(www\.)?google\.com\/maps/.test(cfg.mapaUrl));
aviso("siteUrl preenchido", !!cfg.siteUrl,
  "é o endereço que vai dentro do QR Code das mesas");
publico.fechar();

/* ================================================================
   5. Prévia do link (o que aparece ao mandar no WhatsApp)
   ================================================================ */
suite("Telas — prévia ao compartilhar o link");

const idx = ler("index.html");
["og:title", "og:description", "og:image", "og:type"].forEach((p) =>
  conf("index.html declara " + p, new RegExp('property="' + p + '"').test(idx)));
conf("a imagem de prévia existe", existe("assets/img/og.jpg"));
conf("a prévia declara o tamanho", /og:image:width/.test(idx));
conf("descrição com tamanho útil para busca",
  (idx.match(/name="description" content="([^"]+)"/) || [, ""])[1].length > 70);

/* ================================================================
   6. Tema claro e escuro
   ================================================================ */
suite("Telas — tema claro e escuro");

for (const tela of TODAS_TELAS) {
  const html = ler(tela);
  if (tela === "manual.html") continue;                 // feito para imprimir
  conf(tela + ": aplica o tema antes do CSS carregar",
    /frontbeer:tema/.test(html) && html.indexOf("frontbeer:tema") < html.indexOf("tokens.css"),
    "sem isto a tela pisca branca antes de escurecer");
}

for (const tema of ["claro", "escuro"]) {
  const t = await abrirTela("index.html", { tema, semBanco: true });
  conf("tema " + tema + ": a página assume o tema escolhido",
    t.doc.documentElement.getAttribute("data-tema") === tema);
  conf("tema " + tema + ": há botão para trocar",
    !!t.doc.querySelector("#acoesTopo button, .btn-tema"));
  t.fechar();
}

const tokens = ler("assets/css/tokens.css");
conf("os dois temas vivem no mesmo arquivo de cores",
  /:root\s*\{/.test(tokens) && /\[data-tema="claro"\]/.test(tokens));

/* ================================================================
   7. Menu lateral

   O menu é o mapa do sistema. Tela que existe e não está nele não é
   encontrada; item no menu que não existe dá 404 na cara do dono.
   ================================================================ */
suite("Telas — menu lateral");

const nav = ler("assets/js/nav.js");

["caixa.html", "admin.html", "relatorios.html", "estoque.html", "perdas.html", "cartoes.html"]
  .forEach((t) => conf(t + " aparece no menu", nav.includes('href: "' + t + '"')));

[...nav.matchAll(/href:\s*"([\w.-]+\.html)"/g)].forEach((m) =>
  conf("o menu não aponta para tela inexistente: " + m[1], existe(m[1])));

["estoque", "perdas"].forEach((p) =>
  conf(p + ": a barra superior tem título próprio",
    new RegExp(p + ":\\s*\\{\\s*titulo:").test(nav)));

conf("Estoque e Perdas ficam num grupo próprio, separados de Operação",
  /grupo:\s*"Controle"/.test(nav),
  "enterrados dentro de outra tela, não seriam usados");

/* Cada assunto mora numa tela só. Estoque no cadastro de produto e na
   tela de Estoque significaria a mesma regra em dois lugares — e um
   dia os dois discordariam. */
suite("Telas — cada assunto num lugar só");

conf("o cadastro de produto NÃO tem campos de estoque",
  !/id="pControlaEstoque"|id="pEstoque"/.test(ler("admin.html")),
  "estoque pertence à tela de Estoque");
conf("o painel de Produtos não mexe em estoque",
  !/controla_estoque/.test(ler("assets/js/admin.js")));
conf("a tela de Estoque é quem liga e desliga o controle",
  /controla_estoque:\s*true/.test(ler("assets/js/estoque.js")) &&
  /controla_estoque:\s*false/.test(ler("assets/js/estoque.js")));
conf("o Caixa não duplica o formulário de perdas",
  !/registrarPerda/.test(ler("assets/js/caixa.js")),
  "a mesma regra em dois lugares acaba discordando");
conf("mas o Caixa leva até Perdas",
  /href="perdas\.html"/.test(ler("caixa.html")),
  "é no balcão que a garrafa quebra");

/* Cada tela interna precisa do seu próprio script — copiar o HTML sem
   criar o JS deixaria a página bonita e morta. */
["estoque", "perdas"].forEach((p) => {
  conf(p + ".html carrega o seu próprio script",
    ler(p + ".html").includes("assets/js/" + p + ".js"));
  conf("assets/js/" + p + ".js existe", existe("assets/js/" + p + ".js"));
  conf(p + ".html se identifica para o menu",
    new RegExp('data-pagina="' + p + '"').test(ler(p + ".html")));
});

/* ================================================================
   Perdas — custo e venda lado a lado, nunca somados
   ================================================================ */
suite("Telas — custo e venda na tela de Perdas");

{
  const html = ler("perdas.html");
  const js   = ler("assets/js/perdas.js");

  /* Quantas colunas o cabeçalho declara e quantas as linhas escrevem
     precisam bater. Uma célula a mais desalinha a tabela inteira e o
     dono acaba lendo o custo na coluna de venda. */
  const cabecalho = (html.match(/<thead>[\s\S]*?<\/thead>/) || [""])[0];
  /* `<th[ >]` e não `<th`: o próprio <thead> entraria na conta. */
  const colunas = (cabecalho.match(/<th[ >]/g) || []).length;
  const celulas = (js.match(/data-rotulo="/g) || []).length;

  conf("a tabela tem coluna de Custo", />\s*Custo\s*</.test(cabecalho));
  conf("a tabela tem coluna de Venda", />\s*Venda\s*</.test(cabecalho));
  conf("as células da linha batem com o cabeçalho", colunas === celulas,
    colunas + " colunas no cabeçalho e " + celulas + " células por linha");
  conf("o aviso de filtro vazio ocupa a largura certa",
    new RegExp('colspan="' + colunas + '"').test(js),
    "colspan errado deixa a linha torta");

  conf("o resumo tem um indicador para cada um",
    /id="kpiCusto"/.test(html) && /id="kpiVenda"/.test(html));
  conf("e cada indicador diz o que significa",
    /saiu do bolso/.test(html) && /deixou de faturar/.test(html),
    "dois valores em dinheiro lado a lado sem legenda serão somados de cabeça");
  conf("o percentual do faturamento se declara como sendo do custo",
    /pelo custo/.test(html));

  /* O bloqueio é o conserto do relato "registrei e apareceu 0,00". */
  conf("produto sem custo trava o botão de salvar",
    /btn\.disabled = true/.test(js) && /não tem custo cadastrado/.test(js));
  conf("e o aviso leva até onde se resolve",
    /href="admin\.html"/.test(js),
    "dizer que falta cadastro sem dizer onde é meio recado");
  conf("o envio por Enter também é barrado",
    /if \(!unitario\) \{[\s\S]{0,240}throw new Error/.test(js),
    "botão desabilitado é aparência; o formulário ainda envia pelo teclado");
  conf("o finally não reabre o botão por reflexo",
    !/finally \{\s*btn\.disabled = false;\s*\}/.test(js),
    "liberar no finally desfaria o bloqueio em produto sem custo");

  conf("registros antigos valendo zero são denunciados, não escondidos",
    /avisarSemCusto/.test(js) && /id="avisoSemCusto"/.test(html),
    "um total que exclui metade dos casos em silêncio é pior que total nenhum");
  conf("banco sem a coluna de preço explica a coluna Venda zerada",
    /avisarSemModulo/.test(js) && /perdas\.sql/.test(js),
    "sem isso o dono procura o defeito no cadastro de preço");
}

encerrar();
