/* Teste da capa do cardápio: identidade, redes e botão flutuante. */
import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";
import fs from "fs";

const raiz = "/tmp/fb2";
let falhas = 0;
const conf = (nome, ok, extra = "") => {
  if (!ok) falhas++;
  console.log((ok ? "OK    " : "FALHA ") + nome + (extra ? "  → " + extra : ""));
};

for (const tema of ["escuro", "claro"]) {
  console.log("\n--- tema " + tema + " ---");
  const html = fs.readFileSync(raiz + "/index.html", "utf8");
  const dom = new JSDOM(html, {
    url: "https://exemplo.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.localStorage.setItem("frontbeer:tema", tema);
  window.document.documentElement.setAttribute("data-tema", tema);

  for (const f of ["config.js", "ui.js", "tema.js", "db.js", "cardapio.js"]) {
    window.eval(fs.readFileSync(raiz + "/assets/js/" + f, "utf8"));
  }
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await new Promise((r) => setTimeout(r, 120));

  const $ = (s) => window.document.querySelector(s);
  const cfg = window.APP_CONFIG;

  conf("capa usa a foto nova da marca", $(".capa__imagem img")?.getAttribute("src") === "assets/img/capa.jpg");
  conf("versão leve para o celular", $(".capa__imagem source")?.getAttribute("srcset") === "assets/img/capa-900.jpg");
  conf("a foto tem texto alternativo", ($(".capa__imagem img")?.alt || "").length > 20);
  conf("h1 existe para busca e leitor de tela", ($("h1.sr-only")?.textContent || "").includes("Front Beer"));
  conf("marca não aparece duplicada na capa", !$(".capa__nome") && !$(".capa__emblema"));

  const zap = $(".rede--whatsapp");
  const insta = $(".rede--instagram");
  conf("botão de WhatsApp na capa", !!zap);
  conf("botão de Instagram na capa", !!insta);
  conf("WhatsApp aponta para o número certo", (zap?.href || "").includes("wa.me/" + cfg.whatsapp), zap?.href);
  conf("WhatsApp leva mensagem pronta", (zap?.href || "").includes("?text="));
  conf("mensagem não promete pedido", !decodeURIComponent(zap?.href || "").toLowerCase().match(/pedid|entreg|deliver/));
  conf("Instagram aponta para o perfil", (insta?.href || "").includes("instagram.com/" + cfg.instagram));
  conf("links externos abrem seguros", [zap, insta].every((a) => a?.rel.includes("noopener") && a?.rel.includes("noreferrer")));

  const flut = $(".zap-flutuante");
  conf("botão flutuante de WhatsApp existe", !!flut);
  conf("botão flutuante tem rótulo acessível", (flut?.getAttribute("aria-label") || "").length > 5);
  conf("botão flutuante fala em dúvida, não pedido", (flut?.textContent || "").includes("dúvida"));

  const dados = $("#dadosLoja")?.textContent || "";
  conf("endereço na capa", dados.includes(cfg.endereco));
  conf("horário na capa", dados.includes(cfg.horario));
  conf("telefone na capa", dados.includes(cfg.telefone));
  conf("redes saíram da linha de dados", !dados.includes("@" + cfg.instagram));

  conf("lema preenchido", ($("#lema")?.textContent || "") === cfg.lema);
  conf("aviso de não entrega no rodapé", ($("#avisoOperacao")?.textContent || "").includes("Não realizamos entregas"));
  conf("idade mínima no rodapé", ($("#idadeMinima")?.textContent || "") === "18");
  conf("alternador de tema presente", !!$(".btn-tema, #acoesTopo button"));

  window.close();
}

/* --- Verificações de arquivo --- */
console.log("\n--- arquivos ---");
const css = fs.readFileSync(raiz + "/assets/css/cardapio.css", "utf8");
const tokens = fs.readFileSync(raiz + "/assets/css/tokens.css", "utf8");
const idx = fs.readFileSync(raiz + "/index.html", "utf8");
conf("nenhuma regra órfã da capa antiga", !/capa__fundo|capa__veu|capa__emblema|capa__nome|capa__sub\b/.test(css));
conf("foto sangra de ponta a ponta", !/\.capa__imagem \{[^}]*max-width/.test(css));
conf("degradê no pé da foto", /capa__imagem::after/.test(css) && /height: 28%/.test(css));
conf("corte só na vertical em todo tamanho", ["1.9", "2", "2.5"].every((r) => css.includes("aspect-ratio: " + r) && parseFloat(r) > 1.5));
{ /* a regra base é a primeira; as seguintes vivem dentro de @media */
  const base = css.slice(css.indexOf(".capa__imagem img {"));
  conf("no celular a foto sai inteira", !base.slice(0, base.indexOf("}")).includes("aspect-ratio"));
}
conf("altura da capa não depende da janela", !/\.capa__imagem img \{[^}]*vh/.test(css));
conf("degradê do Instagram definido", tokens.includes("--instagram-degrade"));
conf("botão flutuante some na impressão", /@media print \{ \.zap-flutuante \{ display: none/.test(css));
conf("prévia do link declara tamanho", idx.includes('og:image:width'));
for (const f of ["capa.jpg", "capa-900.jpg", "og.jpg"]) {
  conf("imagem gerada: " + f, fs.existsSync(raiz + "/assets/img/" + f) || fs.existsSync("/sessions/friendly-funny-mayer/mnt/comercio_espetinho/assets/img/" + f));
}

console.log(falhas === 0 ? "\n>>> TUDO PASSOU" : "\n>>> " + falhas + " FALHA(S)");
process.exit(falhas ? 1 : 0);
