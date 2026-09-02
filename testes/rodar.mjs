/* =====================================================================
   FRONT BEER — Executor dos testes

   Como usar, na pasta do projeto:

       npm install jsdom     (só na primeira vez)
       node testes/rodar.mjs

   Sai com código 0 se tudo passou e 1 se algo falhou, para poder ser
   ligado a uma automação depois.
   ===================================================================== */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const SUITES = [
  ["unitarios.mjs", "Cálculos de preço, escape de texto e utilidades"],
  ["seguranca.mjs", "Segredos, XSS, permissões do banco e código de terceiros"],
  ["funcionais.mjs","Cadastro, venda, comanda, cardápio, custos e relatórios"],
  ["quebra.mjs",    "Banco fora do ar, dados tortos e entradas absurdas"],
  ["telas.mjs",     "Arquivos, cache, acessibilidade, temas e obrigações legais"],
  ["capa.mjs",      "Enquadramento da capa e botões de contato"],
];

function rodar(arquivo) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [path.join(AQUI, arquivo)], { stdio: "inherit" });
    p.on("close", (codigo) => ok(codigo === 0));
  });
}

/* Guarda contra suíte muda: se um arquivo de teste não termina chamando
   encerrar() ou process.exit(), ele sai com código 0 mesmo tendo falhas,
   e o executor daria tudo certo enquanto o sistema estava quebrado.
   Já aconteceu neste projeto. */
import fs from "fs";
const mudas = SUITES
  .map(([a]) => a)
  .filter((a) => !/encerrar\(\)|process\.exit/.test(fs.readFileSync(path.join(AQUI, a), "utf8")));
if (mudas.length) {
  console.log("\x1b[31mSuítes que não sabem reprovar: " + mudas.join(", ") + "\x1b[0m");
  process.exit(1);
}

console.log("\n\x1b[1m═══ FRONT BEER — bateria de testes ═══\x1b[0m");

const reprovadas = [];
for (const [arquivo, descricao] of SUITES) {
  console.log("\n\x1b[1m\x1b[36m▶ " + arquivo + "\x1b[0m  " + descricao);
  if (!(await rodar(arquivo))) reprovadas.push(arquivo);
}

console.log("\n\x1b[1m═══ Resultado ═══\x1b[0m");
if (reprovadas.length === 0) {
  console.log("\x1b[32m\x1b[1mTodas as suítes passaram.\x1b[0m\n");
  process.exit(0);
}
console.log("\x1b[31m\x1b[1mSuítes reprovadas: " + reprovadas.join(", ") + "\x1b[0m\n");
process.exit(1);
