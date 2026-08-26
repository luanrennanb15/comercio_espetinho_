/* =====================================================================
   Testes de segurança

   A regra do projeto é simples: o site inteiro roda no navegador do
   visitante, então o código é público por natureza. Quem protege os
   dados é o banco. Estes testes cobram as duas pontas:

     1. O navegador não pode receber nada que o visitante não possa ver.
     2. Nada vindo do banco pode virar código executável na tela.
   ===================================================================== */

import { suite, conf, aviso, abrirTela, ler, RAIZ, TODAS_TELAS, TELAS_INTERNAS } from "./ajuda.mjs";
import fs from "fs";

import path from "path";

const arquivosJs = fs.readdirSync(path.join(RAIZ, "assets/js")).filter((f) => f.endsWith(".js"));
const todoJs = arquivosJs.map((f) => ler("assets/js/" + f)).join("\n");
const sql = fs.readdirSync(path.join(RAIZ, "supabase"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => ({ nome: f, texto: ler("supabase/" + f) }));
const sqlTudo = sql.map((s) => s.texto).join("\n");

/* ================================================================
   1. Segredos
   ================================================================ */
suite("Segurança — segredos fora do navegador");

const tudoCliente = todoJs + TODAS_TELAS.map((t) => ler(t)).join("\n");

conf("nenhuma chave secreta do Supabase no código do site",
  !/sb_secret_[A-Za-z0-9_-]/.test(tudoCliente));
conf("nenhuma service_role no código do site",
  !/service_role/i.test(todoJs) && !/service_role/i.test(TODAS_TELAS.map((t) => ler(t)).join("\n")));

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

const cardapio = await abrirTela("index.html", {
  antes(w) {
    w.__semearProdutos = produtosMalignos;
  },
});
/* O cardápio busca no banco; em modo demo ele usa o armazenamento local,
   então planto os produtos venenosos ali antes de a tela desenhar. */
const tela = await abrirTela("index.html", {
  antes(w) {
    w.localStorage.setItem("frontbeer:demo:produtos", JSON.stringify(produtosMalignos));
  },
});
cardapio.fechar();

const corpo = tela.doc.body;
conf("nenhum script injetado foi executado", tela.window.__invadido === undefined);
conf("nenhuma tag <script> nasceu do conteúdo do banco",
  ![...corpo.querySelectorAll("script")].some((s) => /__invadido/.test(s.textContent || "")));
conf("nenhum atributo onerror/onload veio do banco",
  !/on(error|load|mouseover)\s*=/i.test(corpo.innerHTML.replace(/<svg[^>]*>/g, "")));
conf("o nome perigoso aparece como texto, escapado",
  corpo.innerHTML.includes("&lt;img") || !corpo.innerHTML.includes("<img src=x"));
conf("imagem com javascript: não virou src",
  ![...corpo.querySelectorAll("img")].some((i) => /^javascript:/i.test(i.getAttribute("src") || "")));
conf("imagem com // não virou src externo",
  ![...corpo.querySelectorAll("img")].some((i) => (i.getAttribute("src") || "").startsWith("//")));

/* Toda escrita direta em innerHTML precisa passar por esc() ou por uma
   função de segurança. Isto pega o descuido antes de ele virar falha. */
suite("Segurança — auditoria de innerHTML");

let brutos = [];
arquivosJs.forEach((f) => {
  const texto = ler("assets/js/" + f);
  texto.split("\n").forEach((linha, i) => {
    if (!/innerHTML\s*(\+)?=/.test(linha)) return;
    if (/innerHTML\s*=\s*""/.test(linha)) return;                 // limpar a tela é seguro
    const temVariavel = /\$\{|\+\s*\w|\(\s*\w+\s*\)/.test(linha);
    const protegido = /esc\(|moeda\(|urlSegura\(|icone\(|MARCAS\.|\.join\(|montar|desenhar|linha\w*\(|cartao|render/i.test(linha);
    if (temVariavel && !protegido) brutos.push(f + ":" + (i + 1) + "  " + linha.trim().slice(0, 90));
  });
});
conf("nenhuma escrita de HTML sem escape aparente", brutos.length === 0, brutos.join("\n         → "));

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
    /set search_path/i.test(comandasSql),
    "sem search_path fixo, uma função security definer pode ser enganada");
  conf("a função exige o token como parâmetro",
    /extrato_comanda\s*\(\s*p_token/i.test(comandasSql));
  conf("o token é aleatório, não sequencial",
    /gen_random_uuid|gen_random_bytes/i.test(comandasSql),
    "token previsível deixaria adivinhar a comanda do vizinho");
  conf("comanda fechada deixa de responder pelo token",
    /status\s*<>\s*'em_uso'/i.test(comandasSql),
    "a função precisa devolver aberta:false quando a comanda não está em uso");
}

/* ================================================================
   4. Telas internas
   ================================================================ */
suite("Segurança — telas internas");

TELAS_INTERNAS.forEach((t) => {
  const html = ler(t);
  conf(t + " pede para não ser indexada pelo Google",
    /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html));
});
conf("o cardápio público continua indexável",
  !/name=["']robots["'][^>]+noindex/i.test(ler("index.html")));

conf("nenhuma tela usa eval ou Function em texto vindo de fora",
  !/\beval\s*\(|new Function\s*\(/.test(todoJs));
conf("links externos levam noopener e noreferrer",
  (() => {
    const alvos = tudoCliente.match(/target="_blank"[^>]*/g) || [];
    return alvos.every((a) => /noopener/.test(a) && /noreferrer/.test(a));
  })());
/* Todo domínio de onde a página busca código ou fonte precisa ser
   conhecido. Um domínio novo aparecendo aqui é sinal de dependência
   entrando sem ninguém decidir. */
const PERMITIDOS = [
  "fonts.googleapis.com", "fonts.gstatic.com",       // tipografia
  "cdnjs.cloudflare.com", "cdn.jsdelivr.net",        // QR Code, gráficos, Supabase
  "frzxmsouzrayitixirad.supabase.co",                // o banco do cliente
  "wa.me", "instagram.com",                          // contato
  "frontbeer.com.br", "xxxx.supabase.co", "site.com", "exemplo.com", // exemplos em comentário
  "www.w3.org", "schema.org",
];
const dominios = [...new Set((tudoCliente.match(/https?:\/\/([^/"'\s<>)]+)/g) || [])
  .map((u) => u.replace(/^https?:\/\//, "")))]
  .filter((d) => d && !PERMITIDOS.includes(d));
conf("nenhum domínio externo inesperado", dominios.length === 0, dominios.join(", "));

suite("Segurança — código de terceiros");

const scriptsExternos = [...TODAS_TELAS.flatMap((t) =>
  [...ler(t).matchAll(/<script[^>]+src="https:\/\/[^"]+"[^>]*>/g)].map((m) => ({ tela: t, tag: m[0] })))];

conf("scripts de terceiros vêm sem enviar o endereço da página",
  scriptsExternos.every((s) => /referrerpolicy="no-referrer"/.test(s.tag)),
  scriptsExternos.filter((s) => !/referrerpolicy/.test(s.tag)).map((s) => s.tela).join(", "));

scriptsExternos.forEach(({ tela, tag }) => {
  const lib = (tag.match(/\/([\w.-]+\.min\.js|[\w.-]+\.umd\.min\.js)/) || [])[1] || "script";
  aviso(tela + ": " + lib + " com verificação de integridade (SRI)",
    /integrity="sha\d{3}-/.test(tag),
    "abra o cdnjs, use o botão 'Copy Script Tag' e cole o atributo integrity");
});

aviso("supabase-js preso a uma versão exata",
  !/supabase-js@2\/dist/.test(ler("assets/js/db.js")),
  "hoje usa @2, que muda sozinho; trocar por uma versão fixa deixa o comportamento previsível");

/* ================================================================
   5. Limites — o banco não pode confiar no navegador
   ================================================================ */
suite("Segurança — validação também no banco");

conf("tamanho do nome do produto limitado no banco",
  /char_length\(nome\)\s*between/i.test(sqlTudo));
conf("preço tem teto e piso no banco",
  /check\s*\(preco >= 0 and preco <= \d+\)/i.test(sqlTudo));
conf("quantidade da venda tem limite no banco",
  /quantidade > 0 and quantidade <= \d+/i.test(sqlTudo));
conf("forma de pagamento é lista fechada",
  /pagamento in \('dinheiro'/i.test(sqlTudo));
conf("upload limitado por tipo e tamanho",
  /image\/jpeg/i.test(sqlTudo) && /\d{6,}/.test((sql.find((s) => s.nome === "storage.sql") || {}).texto || ""));

tela.fechar();

tela.fechar();
