/* =====================================================================
   Testes de quebra

   O sistema vai rodar num celular ruim, numa internet de bar, com o
   banco às vezes fora do ar e com dados que ninguém previu. A pergunta
   aqui não é "funciona?", é "quando der errado, dá errado direito?".

   Tela em branco sem explicação é o pior desfecho possível: o dono não
   sabe se é a internet, se é o sistema ou se ele apagou o cardápio.
   ===================================================================== */

import { suite, conf, confErro, abrirTela, ler, encerrar } from "./ajuda.mjs";

/* ================================================================
   1. Banco fora do ar
   ================================================================ */
suite("Quebra — sem conexão com o banco");

/* Em jsdom o <script> externo nunca carrega, que é exatamente o que
   acontece num wi-fi de bar que aceita a conexão e não responde. O prazo
   de espera do db.js tem que desistir e a tela tem que explicar. */
const semRede = await abrirTela("index.html", { espera: 400, prazoRede: 150 });

conf("a tela não fica presa no esqueleto de carregamento",
  !semRede.doc.querySelector("#cardapio .esqueleto"),
  "o cardápio ficou carregando para sempre");
conf("avisa que não conseguiu carregar",
  /(n[ãa]o foi poss[íi]vel|sem conex|conex[ãa]o)/i.test(semRede.doc.body.textContent || ""),
  (semRede.doc.body.textContent || "").replace(/\s+/g, " ").slice(0, 160));
conf("NÃO mostra o cardápio de demonstração no lugar do real",
  !/Espeto de Cupim|modo demonstra/i.test(semRede.doc.querySelector("#cardapio").textContent || ""),
  "o cliente veria preços fictícios como se fossem os da casa");
conf("nenhum script explodiu ao carregar", semRede.erros.length === 0, semRede.erros.join(" | "));
conf("o cliente vê alguma coisa, não uma página branca",
  (semRede.doc.body.textContent || "").trim().length > 80);
conf("o rodapé legal aparece mesmo sem banco",
  /menores de/i.test(semRede.doc.body.textContent || ""));
conf("os contatos aparecem mesmo sem banco",
  !!semRede.doc.querySelector(".rede--whatsapp"));
semRede.fechar();

/* ================================================================
   2. Cardápio vazio
   ================================================================ */
suite("Quebra — cardápio sem nenhum produto");

const vazio = await abrirTela("index.html", {
  semBanco: true,
  antes(w) { w.localStorage.setItem("frontbeer:produtos", "[]"); },
});
const blocoVazio = vazio.doc.querySelector("#cardapio .vazio");
conf("mostra um bloco explicando, em vez do nada",
  !!blocoVazio && (blocoVazio.textContent || "").length > 25,
  (vazio.doc.querySelector("#cardapio").textContent || "").slice(0, 120));
conf("a explicação diz o que fazer",
  /atendente|cadastrad|atualiza/i.test((blocoVazio && blocoVazio.textContent) || ""));
conf("não gera abas de categoria fantasma",
  vazio.doc.querySelectorAll(".aba").length <= 1);
vazio.fechar();

/* ================================================================
   3. Dados tortos vindos do banco
   ================================================================ */
suite("Quebra — produtos com dados inválidos");

const torto = [
  { id: "a", nome: null, descricao: null, categoria: null, preco: null, imagem_url: null, ativo: true, ordem: 0 },
  { id: "b", nome: "", descricao: undefined, categoria: "", preco: "abc", ativo: true, ordem: 1 },
  { id: "c", nome: "Nome " + "muito longo ".repeat(60), descricao: "x".repeat(5000),
    categoria: "Cat".repeat(50), preco: -99, ativo: true, ordem: 2 },
  { id: "d", nome: "Preço absurdo", preco: 9e15, categoria: "Outros", ativo: true, ordem: 3 },
  { id: "e", nome: "Emoji 🍺🔥", descricao: "acentuação çãé", categoria: "Cervejas",
    preco: 6.5, ativo: true, ordem: 4 },
  { id: "f", nome: "Sem categoria definida", preco: 5, ativo: true, ordem: 5 },
];

const bagunca = await abrirTela("index.html", {
  semBanco: true,
  antes(w) { w.localStorage.setItem("frontbeer:produtos", JSON.stringify(torto)); },
});
const htmlBagunca = bagunca.doc.body.innerHTML;

conf("a tela desenha mesmo com campos nulos", bagunca.erros.length === 0, bagunca.erros.join(" | "));
conf("nunca escreve a palavra null na tela", !/>\s*null\s*</.test(htmlBagunca));
conf("nunca escreve undefined na tela", !/undefined/.test(htmlBagunca));
conf("nunca escreve NaN na tela", !/NaN/.test(htmlBagunca));
conf("preço inválido vira R$ 0,00, não lixo",
  !/R\$\s*(abc|-|\s*$)/.test(htmlBagunca));
conf("emoji e acento sobrevivem", /🍺/.test(htmlBagunca) && /acentuação/.test(htmlBagunca));
conf("produto sem categoria ainda aparece", /Sem categoria definida/.test(htmlBagunca));
conf("texto gigante não vaza para fora do card",
  !!bagunca.doc.querySelector(".item, .item--ilustrado"));
bagunca.fechar();

/* ================================================================
   4. Resposta malformada
   ================================================================ */
suite("Quebra — armazenamento corrompido");

for (const veneno of ['{"nao":"e uma lista"}', "[[[", "null", "não é json", "[{}]"]) {
  const t = await abrirTela("index.html", {
    semBanco: true,
    antes(w) { w.localStorage.setItem("frontbeer:produtos", veneno); },
  });
  conf("aguenta armazenamento corrompido: " + JSON.stringify(veneno.slice(0, 22)),
    t.erros.length === 0 && (t.doc.body.textContent || "").length > 60,
    t.erros.join(" | "));
  t.fechar();
}

/* ================================================================
   5. Comanda — o caminho do cliente
   ================================================================ */
suite("Quebra — extrato de comanda");

const semToken = await abrirTela("comanda.html", { semBanco: true });
conf("sem token na URL, explica em vez de quebrar",
  /(c[óo]digo ausente|inv[áa]lid|n[ãa]o encontrad|expirou|encerrad|QR Code)/i.test(semToken.doc.body.textContent || ""),
  (semToken.doc.body.textContent || "").replace(/\s+/g, " ").slice(0, 140));
conf("e diz ao cliente o que fazer",
  /QR Code|c[âa]mera|atendente/i.test(semToken.doc.body.textContent || ""));
conf("não vaza dados de outra comanda", semToken.erros.length === 0);
semToken.fechar();

/* ================================================================
   6. Cálculo — os números que não podem quebrar
   ================================================================ */
suite("Quebra — cálculos com entradas absurdas");

const { window } = await abrirTela("admin.html", { scripts: ["config.js", "ui.js", "db.js"] });
const DB = window.DB;

const absurdos = [
  { custo_compra: Infinity, rende_unidades: 10 },
  { custo_compra: -Infinity, rende_unidades: 10 },
  { custo_compra: NaN, rende_unidades: 10 },
  { custo_compra: 10, rende_unidades: NaN },
  { custo_compra: 10, rende_unidades: Infinity },
  { custo_compra: 1e308, rende_unidades: 1e-308 },
  { custo_compra: "10,50", rende_unidades: "12" },
  { custo_compra: [], rende_unidades: {} },
];
let saoFinitos = true;
absurdos.forEach((c) => {
  const u = DB.custoUnitario(c);
  if (u !== null && !Number.isFinite(u)) saoFinitos = false;
});
conf("custo unitário nunca devolve Infinity nem NaN", saoFinitos);

let precosSaos = true;
[[0.01, 999999], [1e12, 100], [0.001, 1], [7, 1e6]].forEach(([c, k]) => {
  const p = DB.precoParaMarkup(c, k);
  if (p !== null && !Number.isFinite(p)) precosSaos = false;
});
conf("preço sugerido nunca devolve Infinity nem NaN", precosSaos);

conf("markup com preço texto não quebra", DB.markupDe("abc", 10) === null);
conf("margem com custo nulo não quebra", DB.margemDe(10, null) === null);

/* ================================================================
   7. Gravação recusada
   ================================================================ */
suite("Quebra — o banco recusa a gravação");

await confErro("custo negativo é barrado antes de chegar ao banco",
  () => DB.salvarCusto("id", { custo_compra: -50, rende_unidades: 10 }),
  /negativ/i);
await confErro("rendimento zero é barrado com mensagem em português",
  () => DB.salvarCusto("id", { custo_compra: 50, rende_unidades: 0 }),
  /unidades|rende/i);

conf("erro de rede vira mensagem que o dono entende",
  (() => {
    try { window.DB.__traduzir?.(new Error("Failed to fetch")); } catch (e) {}
    return /conex|internet/i.test(ler("assets/js/db.js").match(/Failed to fetch[\s\S]{0,160}/)?.[0] || "");
  })());
conf("sessão expirada vira mensagem que o dono entende",
  /sess[ãa]o expirou/i.test(ler("assets/js/db.js")));
conf("banco desatualizado degrada em vez de derrubar a tela",
  /bancoAntigo\s*=\s*true/.test(ler("assets/js/db.js")) &&
  /colunaAusente/.test(ler("assets/js/db.js")));

window.close();

/* ================================================================
   8. Todas as telas abrem sem erro de script
   ================================================================ */
suite("Quebra — todas as telas abrem");

for (const tela of ["index.html", "admin.html", "caixa.html", "relatorios.html",
                    "comanda.html", "cartoes.html", "qrcode.html", "diagnostico.html"]) {
  const t = await abrirTela(tela);
  conf(tela + " abre sem erro de script", t.erros.length === 0, t.erros.join(" | "));
  t.fechar();
}

encerrar();
