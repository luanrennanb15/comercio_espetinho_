/* =====================================================================
   FRONT BEER — Extrato da comanda (tela do cliente)

   Aberta pelo QR Code do cartão. É SOMENTE LEITURA: mostra o que já foi
   consumido naquela comanda e nada mais. O código do cartão vai na URL
   e é a única chave — sem ele, não há como consultar.

   Nenhuma tabela do banco é exposta aqui: a consulta passa por uma
   função fechada que devolve apenas a comanda aberta correspondente.
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, moeda, $ } = UI;

  const INTERVALO = 20000;       // atualiza a cada 20 segundos
  let semBanco = false;          // o banco não respondeu na abertura
  let timer = null;

  function codigoDaUrl() {
    const busca = new URLSearchParams(location.search);
    return (busca.get("c") || busca.get("token") || "").trim();
  }

  function mensagem(titulo, texto) {
    $("#caixaNumero").classList.add("oculto");
    $("#conteudo").innerHTML =
      '<div class="estado-msg"><strong>' + esc(titulo) + "</strong><p>" + esc(texto) + "</p></div>";
  }

  function desenhar(dados) {
    if (!dados || !dados.encontrada) {
      mensagem("Comanda não encontrada",
        "Este código não corresponde a nenhum cartão. Confira com o atendente.");
      return;
    }

    if (!dados.aberta) {
      $("#caixaNumero").classList.add("oculto");
      $("#conteudo").innerHTML =
        '<div class="estado-msg"><strong>Comanda encerrada</strong>' +
        "<p>Este cartão não está em uso no momento. Se você acabou de receber a comanda, " +
        "peça ao atendente para abri-la e aponte a câmera novamente.</p></div>";
      return;
    }

    $("#numero").textContent = dados.numero;
    $("#caixaNumero").classList.remove("oculto");

    const itens = dados.itens || [];
    if (!itens.length) {
      $("#conteudo").innerHTML =
        '<div class="estado-msg"><strong>Nada lançado ainda</strong>' +
        "<p>Assim que o atendente lançar o primeiro item, ele aparece aqui.</p></div>";
      return;
    }

    $("#conteudo").innerHTML =
      '<div class="lista">' + itens.map(function (i) {
        return '<div class="linha-item">' +
          '<span class="linha-item__qtd">' + esc(i.quantidade) + "x</span>" +
          '<span class="linha-item__nome">' + esc(i.nome) + "</span>" +
          '<span class="linha-item__valor">' + moeda(i.subtotal) + "</span>" +
          '<span class="linha-item__hora">' + esc(i.hora) +
            " · " + moeda(i.preco_unit) + " a unidade</span>" +
        "</div>";
      }).join("") + "</div>" +
      '<div class="total"><span>Total até agora</span><strong>' + moeda(dados.total) + "</strong></div>" +
      '<p class="aviso-leitura">Confira com o atendente antes de pagar. ' +
      "Se algo estiver diferente do que você consumiu, avise na hora — só a equipe pode corrigir.</p>";
  }

  async function atualizar() {
    const codigo = codigoDaUrl();
    if (!codigo) {
      mensagem("Código ausente",
        "Abra esta página apontando a câmera para o QR Code do cartão que está na sua mesa.");
      return;
    }
    try {
      const dados = await DB.extratoComanda(codigo);
      desenhar(dados);
      $("#atualizado").textContent =
        "Atualizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      console.error(e);
      mensagem("Não foi possível carregar",
        "Verifique sua conexão. A tela tenta de novo automaticamente.");
    }
  }

  /* Para de consultar quando a tela sai de vista, para poupar bateria.
     Se o banco nunca chegou a responder, não adianta voltar a consultar:
     a camada de dados não foi iniciada e cada tentativa daria erro. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      clearInterval(timer);
      timer = null;
    } else if (!timer && !semBanco) {
      atualizar();
      timer = setInterval(atualizar, INTERVALO);
    }
  });

  (async function iniciar() {
    document.getElementById("acoesExtrato").innerHTML = TEMA.botao();
    const nome = CFG.nome || "";
    const d = CFG.nomeDestaque || "";
    document.querySelectorAll("[data-marca]").forEach(function (el) {
      el.innerHTML = d && nome.indexOf(d) !== -1
        ? esc(nome).replace(esc(d), "<em>" + esc(d) + "</em>")
        : esc(nome);
    });
    try {
      await DB.init();
    } catch (e) {
      /* O cliente está de pé, com o celular na mão, olhando a tela.
         Ficar em "Carregando..." é o pior desfecho: ele não sabe se
         esperar ou chamar o garçom. */
      /* Tenta de novo algumas vezes e desiste.

         Recarregar para sempre parece prestativo, mas é o contrário: o
         celular fica no bolso do cliente gastando bateria e dados a noite
         inteira, e se o sinal do bar não voltar isso nunca termina.
         Depois de algumas tentativas é mais honesto parar e dizer para
         chamar o atendente, que é quem resolve de verdade. */
      semBanco = true;
      const TENTATIVAS = 4;
      let tentativa = Number(sessionStorage.getItem("frontbeer:tentativas") || 0);

      if (tentativa >= TENTATIVAS) {
        sessionStorage.removeItem("frontbeer:tentativas");
        mensagem("Sem conexão",
          "Não conseguimos carregar o seu consumo. Chame o atendente — ele tem a sua conta no caixa.");
        return;
      }

      sessionStorage.setItem("frontbeer:tentativas", tentativa + 1);
      mensagem("Sem conexão", e.message + " Tentando de novo…");
      timer = setTimeout(function () { location.reload(); }, INTERVALO);
      return;
    }
    sessionStorage.removeItem("frontbeer:tentativas");   // conectou: recomeça a contagem
    await atualizar();
    timer = setInterval(atualizar, INTERVALO);
  })();
})();
