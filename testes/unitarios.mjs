/* =====================================================================
   Testes unitários — as funções que decidem dinheiro e texto na tela.

   Erro de centavo aqui vira prejuízo no balcão todo dia, então cada
   função é testada também nos casos absurdos: zero, negativo, texto
   no lugar de número, campo vazio.
   ===================================================================== */

import { suite, conf, abrirTela, encerrar } from "./ajuda.mjs";

const { window } = await abrirTela("admin.html", { scripts: ["config.js", "ui.js", "db.js"] });
const UI = window.UI;
const DB = window.DB;

const perto = (a, b) => a != null && Math.abs(a - b) < 0.005;

/* ================= Custo unitário ================= */
suite("Unitários — custo por unidade");

conf("fardo de 12 latas por R$ 77,88 dá R$ 6,49 cada",
  perto(DB.custoUnitario({ custo_compra: 77.88, rende_unidades: 12 }), 6.49));
conf("pacote de 15 espetos por R$ 45,00 dá R$ 3,00",
  perto(DB.custoUnitario({ custo_compra: 45, rende_unidades: 15 }), 3));
conf("garrafa de 1L em doses de 150ml rende 6,67 doses",
  perto(DB.custoUnitario({ custo_compra: 100, rende_unidades: 1000 / 150 }), 15));
conf("arredonda para o centavo",
  perto(DB.custoUnitario({ custo_compra: 10, rende_unidades: 3 }), 3.33));

conf("sem custo cadastrado devolve nulo", DB.custoUnitario(null) === null);
conf("rendimento zero não vira divisão por zero",
  DB.custoUnitario({ custo_compra: 50, rende_unidades: 0 }) === null);
conf("rendimento negativo é recusado",
  DB.custoUnitario({ custo_compra: 50, rende_unidades: -3 }) === null);
conf("texto no lugar de número devolve nulo",
  DB.custoUnitario({ custo_compra: "abc", rende_unidades: 10 }) === null);
conf("custo zero é válido (brinde) e dá unitário zero",
  DB.custoUnitario({ custo_compra: 0, rende_unidades: 10 }) === 0);

/* ================= Markup ================= */
suite("Unitários — markup (lucro sobre o custo)");

conf("vender pelo dobro do custo é 100% de markup",
  perto(DB.markupDe(20, 10), 100));
conf("custo 6,49 vendido a 11,00 dá 69,5%",
  perto(DB.markupDe(11, 6.49), 69.5));
conf("vender pelo custo dá 0%", perto(DB.markupDe(10, 10), 0));
conf("vender abaixo do custo dá markup negativo",
  DB.markupDe(8, 10) < 0);
conf("custo zero não vira infinito", DB.markupDe(10, 0) === null);
conf("sem custo não calcula markup", DB.markupDe(10, null) === null);

suite("Unitários — margem (lucro sobre o preço)");
conf("custo 10 vendido a 20 dá margem de 50%", perto(DB.margemDe(20, 10), 50));
conf("preço zero não calcula margem", DB.margemDe(0, 10) === null);
conf("margem e markup são coisas diferentes",
  DB.margemDe(20, 10) !== DB.markupDe(20, 10));

/* ================= Preço sugerido ================= */
suite("Unitários — preço sugerido");

conf("custo 6,49 com 100% de markup sugere 13,00",
  perto(DB.precoParaMarkup(6.49, 100), 13));
conf("custo 3,00 com 50% sugere 4,50", perto(DB.precoParaMarkup(3, 50), 4.5));
conf("markup 0% devolve o próprio custo arredondado",
  perto(DB.precoParaMarkup(3, 0), 3));

/* Este é o teste que protege o lucro: arredondar para baixo entregaria
   menos do que o dono pediu. */
/* 6,49 com 70% dá 11,033. Arredondar para 11,00 pareceria mais bonito,
   mas entregaria menos lucro que o pedido — tem que subir para 11,50. */
const sugerido = DB.precoParaMarkup(6.49, 70);
conf("arredonda para CIMA em múltiplos de R$ 0,50",
  sugerido === 11.5,
  "sugerido = " + sugerido + ", esperado 11.5 (11,00 ficaria abaixo de " + (6.49 * 1.7).toFixed(2) + ")");

let semQuebra = true;
for (let c = 0.5; c <= 60; c += 0.37) {
  for (const k of [10, 33, 50, 80, 100, 150, 220]) {
    const p = DB.precoParaMarkup(c, k);
    if (p < c * (1 + k / 100) - 0.0001) { semQuebra = false; break; }
    if (Math.abs(p * 2 - Math.round(p * 2)) > 1e-9) { semQuebra = false; break; }
  }
}
conf("em 1.100 combinações, nunca sugere menos que o markup pedido", semQuebra);

conf("custo zero não gera preço", DB.precoParaMarkup(0, 100) === null);
conf("markup negativo é recusado", DB.precoParaMarkup(10, -20) === null);
conf("margem de 100% é impossível e devolve nulo",
  DB.precoParaMargem(10, 100) === null);

/* ================= Escape de HTML ================= */
suite("Unitários — escape de texto");

conf("converte os cinco caracteres perigosos",
  UI.esc(`<&>"'`) === "&lt;&amp;&gt;&quot;&#39;");
conf("nulo vira texto vazio, não a palavra null", UI.esc(null) === "");
conf("indefinido vira texto vazio", UI.esc(undefined) === "");
conf("zero continua sendo zero", UI.esc(0) === "0");
conf("texto normal passa intacto", UI.esc("Espeto de Cupim") === "Espeto de Cupim");
conf("acento não é destruído", UI.esc("Caipirinha de maracujá") === "Caipirinha de maracujá");

/* ================= URLs de imagem ================= */
suite("Unitários — allowlist de URLs de imagem");

const aceitas = [
  "https://exemplo.com/foto.jpg",
  "http://exemplo.com/foto.png",
  "assets/img/fotos/carne.png",
  "assets/img/fotos/pao-de-alho.webp",
];
const recusadas = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  "//evil.com/a.jpg",
  "../../etc/passwd",
  "assets/../../../segredo.jpg",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "",
  "   ",
];

aceitas.forEach((u) => conf("aceita " + u, UI.urlSegura(u) === u));
recusadas.forEach((u) => conf("recusa " + JSON.stringify(u), UI.urlSegura(u) === "", "devolveu: " + UI.urlSegura(u)));

/* ================= Moeda e busca ================= */
suite("Unitários — moeda e busca");

conf("formata em real brasileiro", /R\$\s?11,00/.test(UI.moeda(11)));
conf("texto inválido não vira NaN na tela", /R\$\s?0,00/.test(UI.moeda("abc")));
conf("nulo vira R$ 0,00", /R\$\s?0,00/.test(UI.moeda(null)));
conf("centavos aparecem", /R\$\s?6,49/.test(UI.moeda(6.49)));

conf("busca ignora acento", UI.chave("Caipirinha de Açaí") === "caipirinha de acai");
conf("busca ignora maiúscula", UI.chave("CERVEJA") === "cerveja");
conf("busca ignora espaço nas pontas", UI.chave("  gin  ") === "gin");
conf("busca com nulo não quebra", UI.chave(null) === "");

window.close();
encerrar();
