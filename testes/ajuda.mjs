/* =====================================================================
   FRONT BEER — Apoio dos testes

   Um único lugar que sabe carregar uma tela do sistema num navegador
   de mentira (jsdom) e contar acertos e erros. As suítes só descrevem
   o que deve ser verdade; a mecânica mora aqui.
   ===================================================================== */

import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const ler = (relativo) => fs.readFileSync(path.join(RAIZ, relativo), "utf8");
export const existe = (relativo) => fs.existsSync(path.join(RAIZ, relativo));

/* ---------------- Contagem ---------------- */
const estado = { total: 0, falhas: 0, avisos: 0, pendencias: [], suite: "" };

export function suite(nome) {
  estado.suite = nome;
  console.log("\n\x1b[1m" + nome + "\x1b[0m");
}

export function conf(descricao, condicao, detalhe) {
  estado.total++;
  const ok = !!condicao;
  if (!ok) estado.falhas++;
  const marca = ok ? "\x1b[32m  ok  \x1b[0m" : "\x1b[31mFALHA \x1b[0m";
  console.log(marca + descricao + (detalhe && !ok ? "\n         → " + detalhe : ""));
  return ok;
}

/* Verifica que algo REALMENTE explode. Um teste que espera erro e não
   recebe nenhum é um teste que passou por acidente. */
export async function confErro(descricao, fn, padrao) {
  try {
    await fn();
    return conf(descricao, false, "nenhum erro foi lançado");
  } catch (e) {
    const msg = (e && e.message) || String(e);
    return conf(descricao, padrao ? padrao.test(msg) : true, "mensagem recebida: " + msg);
  }
}

/* Recomendação: não reprova a suíte, mas fica registrada. Serve para o
   que depende de uma decisão ou de um passo manual do dono. */
export function aviso(descricao, condicao, comoResolver) {
  const ok = !!condicao;
  if (!ok) {
    estado.avisos++;
    estado.pendencias.push(descricao + (comoResolver ? " — " + comoResolver : ""));
  }
  console.log((ok ? "\x1b[32m  ok  \x1b[0m" : "\x1b[33m aviso\x1b[0m") + descricao);
  return ok;
}

export function placar() {
  return { ...estado };
}

export function encerrar() {
  const { total, falhas, avisos, pendencias } = estado;
  console.log(
    "\n" + (falhas === 0
      ? "\x1b[32m\x1b[1m" + total + " verificações, tudo passou.\x1b[0m"
      : "\x1b[31m\x1b[1m" + falhas + " de " + total + " falharam.\x1b[0m")
  );
  if (avisos) {
    console.log("\x1b[33m" + avisos + " recomendação(ões) em aberto:\x1b[0m");
    pendencias.forEach((p) => console.log("  · " + p));
  }
  process.exit(falhas ? 1 : 0);
}

/* ---------------- Navegador de mentira ----------------
   Carrega uma tela real do sistema, com os scripts reais, e devolve a
   janela pronta para inspeção. O banco nunca é chamado de verdade:
   `window.fetch` é substituído para que nenhum teste dependa da rede.
   ------------------------------------------------------------------ */
export async function abrirTela(arquivo, opcoes = {}) {
  const {
    tema = "escuro",
    scripts = null,
    antes = null,
    sessao = null,
    espera = 350,          // tempo para a tela terminar de desenhar antes de olhar
    semBanco = false,      // roda em modo demonstração, sem tentar o Supabase
    prazoRede = null,      // encurta o prazo de espera da rede, para o teste não demorar
  } = opcoes;

  const dom = new JSDOM(ler(arquivo), {
    url: "https://frontbeer.test/" + arquivo,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;

  /* Nada de rede durante os testes. */
  window.fetch = async () => {
    throw new Error("Failed to fetch");
  };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;

  try { window.localStorage.setItem("frontbeer:tema", tema); } catch (e) {}
  window.document.documentElement.setAttribute("data-tema", tema);

  if (sessao) window.localStorage.setItem("frontbeer:sessao", JSON.stringify(sessao));
  if (antes) antes(window);

  const lista = scripts || [...ler(arquivo).matchAll(/src="assets\/js\/([\w.-]+)\.js/g)].map((m) => m[1] + ".js");
  const erros = [];
  for (const f of lista) {
    let codigo = ler("assets/js/" + f);
    /* Modo demonstração: apago as credenciais para o db.js nem tentar a
       rede. É o mesmo caminho de um site ainda não configurado. */
    if (semBanco && f === "config.js") {
      codigo = codigo
        .replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl:   ""')
        .replace(/supabaseChave:\s*"[^"]*"/, 'supabaseChave: ""');
    }
    if (prazoRede && f === "db.js") {
      codigo = codigo.replace(/const TEMPO_LIMITE\s*=\s*\d+/, "const TEMPO_LIMITE   = " + prazoRede);
    }
    try {
      window.eval(codigo);
    } catch (e) {
      erros.push(f + ": " + e.message);
    }
  }

  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await new Promise((r) => setTimeout(r, espera));

  return { window, doc: window.document, erros, fechar: () => window.close() };
}

/* Lista das telas do sistema, separadas por quem pode abrir. */
export const TELAS_PUBLICAS = ["index.html", "comanda.html"];
export const TELAS_INTERNAS = ["admin.html", "caixa.html", "relatorios.html", "cartoes.html", "qrcode.html"];
export const TODAS_TELAS = [...TELAS_PUBLICAS, ...TELAS_INTERNAS, "manual.html", "diagnostico.html"];
