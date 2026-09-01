/* =====================================================================
   Testes de segurança

   A regra do projeto é simples: o site inteiro roda no navegador do
   visitante, então o código é público por natureza. Quem protege os
   dados é o banco. Estes testes cobram as duas pontas:

     1. O navegador não pode receber nada que o visitante não possa ver.
     2. Nada vindo do banco pode virar código executável na tela.
   ===================================================================== */

import { suite, conf, aviso, encerrar, abrirTela, ler, existe, RAIZ, TODAS_TELAS, TELAS_INTERNAS } from "./ajuda.mjs";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

/* Remove comentários: um aviso escrito "nunca use service_role" não é
   um vazamento de service_role. */
const semComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

const arquivosJs = fs.readdirSync(path.join(RAIZ, "assets/js")).filter((f) => f.endsWith(".js"));
const todoJs = arquivosJs.map((f) => ler("assets/js/" + f)).join("\n");
const sql = fs.readdirSync(path.join(RAIZ, "supabase"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => ({ nome: f, texto: ler("supabase/" + f) }));
const sqlTudo = sql.map((s) => s.texto).join("\n");
const tudoCliente = todoJs + TODAS_TELAS.map((t) => ler(t)).join("\n");

/* ================================================================
   1. Segredos
   ================================================================ */
suite("Segurança — segredos fora do navegador");

conf("nenhuma chave secreta do Supabase no código do site",
  !/sb_secret_[A-Za-z0-9_-]/.test(tudoCliente));
conf("nenhuma service_role no código executável",
  !/service_role/i.test(semComentarios(tudoCliente)), "aparece fora de comentário");

/* Um JWT de service_role é um token longo cujo corpo declara esse papel.
   Procuro pelo formato, não pela palavra, porque ela pode vir codificada. */
const jwts = tudoCliente.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || [];
const jwtsRuins = jwts.filter((t) => {
  try {
    const corpo = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
    return corpo.role && corpo.role !== "anon";
  } catch (e) { return false; }
});
conf("nenhum token JWT privilegiado embutido", jwtsRuins.length === 0, jwtsRuins.join(", "));

conf("a chave publicável é do tipo certo",
  /supabaseChave:\s*"(sb_publishable_[^"]+|eyJ[^"]*|)"/.test(ler("assets/js/config.js")));
conf("nenhuma senha literal no código",
  !/(senha|password)\s*[:=]\s*["'][^"']{4,}["']/i.test(todoJs.replace(/senha do painel|senha forte/gi, "")));

/* ================================================================
   2. XSS — texto do banco não pode virar código
   ================================================================ */
suite("Segurança — XSS com dados do banco");

const VENENO = '<img src=x onerror="window.__invadido=1">';
const produtosMalignos = [
  {
    id: "1", nome: VENENO, descricao: '"><script>window.__invadido=1<\/script>',
    categoria: '<svg onload="window.__invadido=1">', preco: 10,
    imagem_url: "javascript:window.__invadido=1", ativo: true, esgotado: false, alcoolico: true, ordem: 1,
  },
  {
    id: "2", nome: "Espeto ' OR 1=1 --", descricao: "onmouseover=alert(1)",
    categoria: "Espetos", preco: 9, imagem_url: "//evil.com/x.jpg",
    ativo: true, esgotado: false, alcoolico: false, ordem: 2,
  },
];

/* Em modo demonstração o cardápio lê do armazenamento local, então planto
   os produtos venenosos ali antes de a tela desenhar. */
const tela = await abrirTela("index.html", {
  semBanco: true,
  antes(w) {
    w.localStorage.setItem("frontbeer:produtos", JSON.stringify(produtosMalignos));
  },
});

const corpo = tela.doc.body;

/* Guarda contra teste que passa por acaso: se a tela não desenhou nada,
   todos os testes de XSS abaixo passariam sem terem olhado para nada. */
conf("os produtos venenosos realmente foram desenhados na tela",
  /OR 1=1/.test(corpo.textContent || ""),
  "a tela não renderizou — os testes de XSS abaixo não provariam nada");

conf("nenhum script injetado foi executado", tela.window.__invadido === undefined);
conf("nenhuma tag <script> nasceu do conteúdo do banco",
  ![...corpo.querySelectorAll("script")].some((s) => /__invadido/.test(s.textContent || "")));
/* Procuro no DOM montado, não no texto do HTML: escapado corretamente, a
   sequência onload="..." APARECE no innerHTML como texto inofensivo. O que
   importa é se algum elemento de verdade ganhou um manipulador de evento. */
const comEvento = [...corpo.querySelectorAll("*")]
  .filter((e) => e.getAttributeNames().some((a) => a.toLowerCase().startsWith("on")));
conf("nenhum elemento ganhou manipulador de evento vindo do banco",
  comEvento.length === 0,
  comEvento.map((e) => e.tagName + "[" + e.getAttributeNames().join(",") + "]").join(" | "));

const comJs = [...corpo.querySelectorAll("*")].filter((e) =>
  e.getAttributeNames().some((a) => /^javascript:/i.test((e.getAttribute(a) || "").trim())));
conf("nenhum atributo virou endereço javascript:", comJs.length === 0);
conf("o nome perigoso aparece como texto, escapado",
  corpo.innerHTML.includes("&lt;img") || !corpo.innerHTML.includes("<img src=x"));
conf("imagem com javascript: não virou src",
  ![...corpo.querySelectorAll("img")].some((i) => /^javascript:/i.test(i.getAttribute("src") || "")));
conf("imagem com // não virou src externo",
  ![...corpo.querySelectorAll("img")].some((i) => (i.getAttribute("src") || "").startsWith("//")));

/* ================================================================
   Auditoria de innerHTML
   ================================================================ */
suite("Segurança — auditoria de innerHTML");

/* Uma linha solta não diz nada: `alvo.innerHTML = itens.map((i) =>`
   parece perigoso e é seguro, porque o escape está nas linhas seguintes.
   Então recorto a INSTRUÇÃO inteira — de `innerHTML =` até o ponto e
   vírgula que a fecha — e nela apago tudo que comprovadamente sanitiza. */
function instrucoes(texto) {
  const achadas = [];
  const re = /(\w[\w$.\[\]()"'-]*)\.innerHTML\s*\+?=/g;
  let m;
  while ((m = re.exec(texto))) {
    let i = re.lastIndex, prof = 0, fim = -1;
    while (i < texto.length) {
      const c = texto[i];
      if (c === "(" || c === "[" || c === "{") prof++;
      else if (c === ")" || c === "]" || c === "}") prof--;
      else if (c === ";" && prof <= 0) { fim = i; break; }
      i++;
    }
    achadas.push({
      linha: texto.slice(0, m.index).split("\n").length,
      codigo: texto.slice(m.index, fim === -1 ? texto.length : fim),
    });
  }
  return achadas;
}

/* O risco não é concatenar — é concatenar COM HTML. `i.quantidade + "x " +
   i.nome` monta um texto comum, que depois passa por esc(). Já
   `'<span>' + c.numero` injeta direto na marcação. Então marco os
   literais que contêm sinal de HTML e só acuso o que encosta neles. */
function sobras(codigo) {
  let c = codigo.replace(/\/\*[\s\S]*?\*\//g, " ");

  c = c.replace(/(["'])((?:\\.|(?!\1)[^\\])*)\1/g, (_, __, texto) =>
    /[<>]/.test(texto) ? " HTMLLIT " : " TXTLIT ");

  /* Colapsa chamadas de dentro para fora. O retorno de uma função é
     código que alguém escreveu; o perigo real é o campo cru do banco
     caindo direto na marcação. */
  let antes;
  do {
    antes = c;
    c = c.replace(/[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*\([^()]*\)/g, " SEGURO ");
    c = c.replace(/\([^()]*\)/g, " GRUPO ");
  } while (c !== antes);
  c = c.replace(/\.length\b/g, " SEGURO ");

  const ident = "[A-Za-z_$][\\w$]*(?:\\.[\\w$]+)*";
  const achados = new Set();
  let m;
  const depois = new RegExp("HTMLLIT\\s*\\+\\s*(" + ident + ")", "g");
  const antesRe = new RegExp("(" + ident + ")\\s*\\+\\s*HTMLLIT", "g");
  while ((m = depois.exec(c))) achados.add(m[1]);
  while ((m = antesRe.exec(c))) achados.add(m[1]);

  const seguros = /^(SEGURO|GRUPO|HTMLLIT|TXTLIT|MARCAS|ICONES|ROTULO_\w+|CFG|marcado|marcaFormatada|opcoes|grupos|itens|linhas|corpo|html|partes|conteudo|blocos)/;
  return [...achados].filter((r) => !seguros.test(r));
}

/* Um teste de segurança que nunca acusa nada é decoração. Antes de
   confiar no auditor, provo que ele reprova código sabidamente furado. */
const ISCA = `alvo.innerHTML = '<div class="x">' + produto.nome + '</div>';`;
conf("o auditor realmente detecta injeção (autoteste)",
  sobras(instrucoes(ISCA)[0].codigo).includes("produto.nome"),
  "o auditor deixou passar uma injeção óbvia — os resultados abaixo não valem nada");

const brutos = [];
arquivosJs.forEach((f) => {
  instrucoes(ler("assets/js/" + f)).forEach(({ linha, codigo }) => {
    const s = sobras(codigo);
    if (s.length) brutos.push(f + ":" + linha + "  concatena sem escape: " + s.join(", "));
  });
});
conf("nenhuma escrita de HTML sem escape", brutos.length === 0, brutos.join("\n         → "));

conf("todo dado do banco passa por esc em algum ponto de cada tela",
  ["cardapio.js", "admin.js", "caixa.js", "relatorios.js", "comanda.js"]
    .every((f) => /esc\(/.test(ler("assets/js/" + f))));

/* ================================================================
   3. Banco — permissões e RLS
   ================================================================ */
suite("Segurança — permissões do banco");

const tabelasSensiveis = ["vendas", "venda_itens", "comandas", "comanda_itens", "produto_custos"];
tabelasSensiveis.forEach((t) => {
  const criada = new RegExp("create table if not exists public\\." + t, "i").test(sqlTudo);
  if (!criada) return;
  conf(t + ": row level security ligado",
    new RegExp("alter table public\\." + t + "\\s+enable row level security", "i").test(sqlTudo));
  conf(t + ": o público não recebe permissão de leitura",
    !new RegExp("grant[^;]*\\bselect\\b[^;]*on public\\." + t + "[^;]*to anon", "is").test(sqlTudo),
    "há um grant para anon nesta tabela");
});

conf("produtos: o público lê apenas os itens ativos",
  /create policy[^;]*for select\s+to anon\s+using \(ativo = true\)/is.test(sqlTudo));
conf("produtos: gravar exige login",
  /create policy[^;]*for insert\s+to authenticated/is.test(sqlTudo));
conf("faturamento: permissões do público explicitamente revogadas",
  /revoke all on public\.vendas\s+from anon/i.test(sqlTudo) &&
  /revoke all on public\.venda_itens\s+from anon/i.test(sqlTudo));
conf("custos nunca ficam na tabela pública de produtos",
  !/alter table public\.produtos add column[^;]*custo/i.test(sqlTudo));
conf("a view de resumo respeita quem consulta, não quem criou",
  /security_invoker\s*=\s*on/i.test(sqlTudo));

/* O extrato da comanda é o único caminho público para dados de consumo.
   Ele existe porque o cliente lê o QR do cartão sem estar logado — então
   precisa ser estreito: uma função só, que recebe o token e nada mais. */
suite("Segurança — extrato público da comanda");

const comandasSql = (sql.find((s) => s.nome === "comandas.sql") || {}).texto || "";
if (comandasSql) {
  conf("o extrato é uma função, não acesso direto à tabela",
    /create or replace function public\.extrato_comanda/i.test(comandasSql));
  conf("a função roda com privilégio elevado (por isso precisa ser estreita)",
    /security definer/i.test(comandasSql));
  conf("a função fixa o search_path (evita sequestro de esquema)",
    /set search_path/i.test(comandasSql));
  conf("a função exige o token como parâmetro",
    /extrato_comanda\s*\(\s*p_token/i.test(comandasSql));
  conf("o token é aleatório, não sequencial",
    /gen_random_uuid|gen_random_bytes/i.test(comandasSql),
    "token previsível deixaria adivinhar a comanda do vizinho");
  conf("comanda fechada deixa de responder pelo token",
    /status\s*<>\s*'em_uso'/i.test(comandasSql));
}

/* ================================================================
   4. Telas internas e recursos externos
   ================================================================ */
suite("Segurança — telas internas");

TELAS_INTERNAS.forEach((t) => {
  conf(t + " pede para não ser indexada pelo Google",
    /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(ler(t)));
});
conf("o cardápio público continua indexável",
  !/name=["']robots["'][^>]+noindex/i.test(ler("index.html")));

conf("nenhuma tela usa eval ou Function em texto vindo de fora",
  !/\beval\s*\(|new Function\s*\(/.test(todoJs));
conf("links externos levam noopener e noreferrer",
  (tudoCliente.match(/target="_blank"[^>]*/g) || [])
    .every((a) => /noopener/.test(a) && /noreferrer/.test(a)));

/* Todo domínio de onde a página busca código ou fonte precisa ser
   conhecido. Um domínio novo aparecendo aqui é dependência entrando
   sem ninguém ter decidido. */
const PERMITIDOS = [
  "fonts.googleapis.com", "fonts.gstatic.com",
  "cdnjs.cloudflare.com", "cdn.jsdelivr.net",
  "frzxmsouzrayitixirad.supabase.co",
  "wa.me", "instagram.com", "espetinho-front-beer.vercel.app",
  "frontbeer.com.br", "xxxx.supabase.co", "site.com", "exemplo.com",
  "www.w3.org", "schema.org", "www.google.com",
];
const dominios = [...new Set((tudoCliente.match(/https?:\/\/([^/"'\s<>)]+)/g) || [])
  .map((u) => u.replace(/^https?:\/\//, "")))]
  .filter((d) => d && !PERMITIDOS.includes(d));
conf("nenhum domínio externo inesperado", dominios.length === 0, dominios.join(", "));

suite("Segurança — código de terceiros");

const scriptsExternos = TODAS_TELAS.flatMap((t) =>
  [...ler(t).matchAll(/<script[^>]+src="https:\/\/[^"]+"[^>]*>/g)].map((m) => ({ tela: t, tag: m[0] })));

conf("scripts de terceiros não enviam o endereço da página",
  scriptsExternos.every((s) => /referrerpolicy="no-referrer"/.test(s.tag)),
  scriptsExternos.filter((s) => !/referrerpolicy/.test(s.tag)).map((s) => s.tela).join(", "));

scriptsExternos.forEach(({ tela, tag }) => {
  const lib = ((tag.match(/\/([\w.-]+\.js)/g) || []).pop() || "/script").slice(1);
  aviso(tela + ": " + lib + " com verificação de integridade (SRI)",
    /integrity="sha\d{3}-/.test(tag), "no cdnjs, botão 'Copy Script Tag'");
});

aviso("supabase-js preso a uma versão exata",
  !/supabase-js@2\/dist/.test(ler("assets/js/db.js")),
  "hoje usa @2, que muda sozinho quando a biblioteca é atualizada");

/* ================================================================
   5. Cabeçalhos de segurança da hospedagem
   ================================================================ */
suite("Segurança — cabeçalhos da hospedagem");

if (existe("vercel.json")) {
  const vercel = JSON.parse(ler("vercel.json"));
  const todos = (vercel.headers || []).flatMap((h) => h.headers || []);
  const valor = (nome) => (todos.find((h) => h.key.toLowerCase() === nome.toLowerCase()) || {}).value || "";

  conf("Content-Security-Policy definida", !!valor("Content-Security-Policy"));
  conf("a CSP parte de 'self'", /default-src 'self'/.test(valor("Content-Security-Policy")));
  conf("a CSP bloqueia quem tentar embutir o site num iframe",
    /frame-ancestors 'none'/.test(valor("Content-Security-Policy")),
    "sem isto o site pode ser embutido numa página falsa (clickjacking)");
  conf("a CSP não libera scripts inline em geral",
    !/script-src[^;]*'unsafe-inline'/.test(valor("Content-Security-Policy")),
    "liberaria qualquer script injetado, anulando a proteção");
  conf("navegador proibido de adivinhar o tipo do arquivo",
    /nosniff/.test(valor("X-Content-Type-Options")));
  conf("HTTPS obrigatório (HSTS)", /max-age=\d{7,}/.test(valor("Strict-Transport-Security")));
  conf("endereço da página não vaza para sites externos",
    /no-referrer|strict-origin/.test(valor("Referrer-Policy")));
  conf("câmera, microfone e localização negados",
    /camera=\(\)/.test(valor("Permissions-Policy")) &&
    /microphone=\(\)/.test(valor("Permissions-Policy")) &&
    /geolocation=\(\)/.test(valor("Permissions-Policy")));

  /* ---- A parte que realmente pega erro no dia a dia ----
     A CSP autoriza os scripts escritos dentro do HTML por hash. Mexer
     numa única vírgula desses trechos muda o hash, e o navegador passa
     a recusar o script — a tela quebra em produção, não aqui. Então
     recalculo os hashes a partir do HTML e comparo com o autorizado. */
  const csp = valor("Content-Security-Policy");
  const autorizados = new Set((csp.match(/'sha256-[A-Za-z0-9+/=]+'/g) || []).map((h) => h.slice(1, -1)));

  const naHtml = new Map();
  TODAS_TELAS.forEach((t) => {
    for (const m of ler(t).matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/application\/ld\+json/.test(m[1])) continue;      // dado, não código
      const h = "sha256-" + createHash("sha256").update(m[2], "utf8").digest("base64");
      if (!naHtml.has(h)) naHtml.set(h, []);
      naHtml.get(h).push(t);
    }
  });

  const semAutorizacao = [...naHtml.entries()].filter(([h]) => !autorizados.has(h));
  conf("todo script inline está autorizado na CSP", semAutorizacao.length === 0,
    semAutorizacao.map(([h, telas]) => telas.join(", ") + " -> " + h).join(" | ") +
    "  (recalcule o hash e atualize o vercel.json)");

  const sobrando = [...autorizados].filter((h) => !naHtml.has(h));
  aviso("nenhum hash sobrando na CSP", sobrando.length === 0,
    "autorizado mas não usado: " + sobrando.join(", "));

  conf("a CSP permite o banco do cliente",
    csp.includes((ler("assets/js/config.js").match(/supabaseUrl:\s*"(https:\/\/[\w-]+\.supabase\.co)"/) || [, ""])[1]),
    "sem isto o site não consegue falar com o Supabase");
  conf("a CSP permite as bibliotecas de terceiros que as telas usam",
    ["cdnjs.cloudflare.com", "cdn.jsdelivr.net"].every((d) => !tudoCliente.includes(d) || csp.includes(d)));
  conf("a CSP permite as fontes do Google",
    csp.includes("fonts.googleapis.com") && csp.includes("fonts.gstatic.com"));
} else {
  aviso("vercel.json com cabeçalhos de segurança", false, "arquivo ausente");
}

/* ================================================================
   6. Indexação
   ================================================================ */
suite("Segurança — o que o Google pode ver");

if (existe("robots.txt")) {
  const robots = ler("robots.txt");
  TELAS_INTERNAS.concat("comanda.html").forEach((t) =>
    conf("robots.txt bloqueia " + t, robots.includes("Disallow: /" + t)));
  conf("robots.txt aponta o sitemap", /Sitemap: https?:\/\//.test(robots));
  conf("o arquivo do sitemap existe", existe("sitemap.xml"));
  conf("o sitemap não expõe telas internas",
    !TELAS_INTERNAS.some((t) => ler("sitemap.xml").includes(t)));
}

/* ================================================================
   7. Ficha do estabelecimento (schema.org)
   ================================================================ */
suite("Segurança — ficha do estabelecimento não pode divergir do config");

const ld = (ler("index.html").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
if (ld) {
  let ficha = null;
  try { ficha = JSON.parse(ld); } catch (e) {}
  conf("a ficha é JSON válido", !!ficha, "JSON quebrado é ignorado pelo Google sem avisar");
  if (ficha) {
    const cfgTexto = ler("assets/js/config.js");
    const doCfg = (campo) => (cfgTexto.match(new RegExp(campo + ':\\s*"([^"]*)"')) || [, ""])[1];

    conf("o nome bate com o config.js", ficha.name === doCfg("nome"));
    conf("o endereço bate com o config.js",
      ficha.address && ficha.address.streetAddress === doCfg("endereco"),
      "ficha: " + (ficha.address || {}).streetAddress + " | config: " + doCfg("endereco"));
    conf("o telefone bate com o config.js",
      (ficha.telephone || "").replace(/\D/g, "") === doCfg("whatsapp").replace(/\D/g, ""),
      "ficha: " + ficha.telephone + " | config: " + doCfg("whatsapp"));
    conf("o site bate com o config.js",
      (ficha.url || "").replace(/\/$/, "") === doCfg("siteUrl").replace(/\/$/, ""));
    conf("o Instagram está declarado",
      (ficha.sameAs || []).some((u) => u.includes(doCfg("instagram"))));
    conf("o horário está declarado", Array.isArray(ficha.openingHoursSpecification));
    conf("a imagem da ficha é endereço absoluto", /^https:\/\//.test(ficha.image || ""));
    aviso("endereço com cidade na ficha", !!(ficha.address || {}).addressLocality,
      "sem cidade o Google tem dificuldade de casar o site com a ficha do Maps");
  }
}

tela.fechar();
encerrar();
