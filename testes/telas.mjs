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

encerrar();
