/* =====================================================================
   FRONT BEER — Relatórios de venda
   Toda a agregação acontece aqui, a partir das vendas cruas.
   ===================================================================== */

(function () {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const { esc, moeda, $, $$, avisar } = UI;

  const ROTULO_PAGAMENTO = {
    dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito: "Crédito", outro: "Outro",
  };
  const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const CORES = { ouro: "#D8A43A", ouroClaro: "#F2CE79", linha: "#2C2722", texto: "#A89E92" };

  let vendas = [];
  const graficos = {};

  /* Menu lateral + ações próprias desta tela na barra superior */
  NAV.montar(
    '<button type="button" class="btn btn--fantasma btn--pequeno" id="btnExportar">Exportar CSV</button>' +
    '<button type="button" class="btn btn--fantasma btn--pequeno" id="btnImprimir">Imprimir</button>'
  );

  /* ---------------- Datas ---------------- */
  function paraCampo(d) {
    const x = new Date(d);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  function doCampo(valor) {
    const [a, m, d] = String(valor).split("-").map(Number);
    return new Date(a, m - 1, d);
  }
  function diaCurto(d) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  /* ---------------- Acesso ---------------- */
  $("#formAcesso").addEventListener("submit", async function (e) {
    e.preventDefault();
    ["#erroAcesso", "#erroAcessoBaixo"].forEach(function (sel) {
      const el = $(sel); if (el) el.classList.add("oculto");
    });
    const btn = $("#btnEntrar");
    btn.disabled = true;
    try {
      const usuario = await DB.login($("#email").value, $("#senha").value);
      $("#senha").value = "";
      await abrirRelatorios(usuario);
    } catch (err) {
      ["#erroAcesso", "#erroAcessoBaixo"].forEach(function (sel) {
        const el = $(sel);
        if (el) { el.textContent = err.message || "Não foi possível entrar."; el.classList.remove("oculto"); }
      });
      console.error("Falha no login:", err);
    } finally {
      btn.disabled = false;
    }
  });

  $("#btnSair").addEventListener("click", async function () {
    await DB.logout();
    location.reload();
  });

  async function abrirRelatorios(usuario) {
    NAV.definirUsuario(usuario || (await DB.usuarioAtual()));
    $("#telaAcesso").classList.add("oculto");
    $("#telaRel").classList.remove("oculto");
    definirPeriodo(29);
  }

  /* ---------------- Período ---------------- */
  function definirPeriodo(dias) {
    const ate = new Date();
    const de = new Date();
    de.setDate(de.getDate() - dias);
    $("#dataDe").value = paraCampo(de);
    $("#dataAte").value = paraCampo(ate);
    carregar();
  }

  $("#atalhos").addEventListener("click", function (e) {
    const btn = e.target.closest(".atalho");
    if (!btn) return;
    $$(".atalho").forEach((b) => b.classList.toggle("ativo", b === btn));
    definirPeriodo(Number(btn.getAttribute("data-dias")));
  });

  ["#dataDe", "#dataAte"].forEach((sel) => {
    $(sel).addEventListener("change", function () {
      $$(".atalho").forEach((b) => b.classList.remove("ativo"));
      carregar();
    });
  });

  /* ---------------- Carregamento ---------------- */
  async function carregar() {
    const de = doCampo($("#dataDe").value);
    const ate = doCampo($("#dataAte").value);
    if (isNaN(de) || isNaN(ate)) return;
    if (de > ate) { avisar("A data inicial é posterior à final.", "erro"); return; }

    try {
      vendas = await DB.listarVendas(de, ate);
      desenhar(de, ate);
    } catch (e) {
      avisar(e.message || "Falha ao carregar as vendas.", "erro");
    }
  }

  /* ---------------- Agregações ---------------- */
  function resumo() {
    const faturamento = vendas.reduce((s, v) => s + v.total, 0);
    const unidades = vendas.reduce((s, v) => s + (v.itens || []).reduce((t, i) => t + i.quantidade, 0), 0);
    return {
      faturamento: faturamento,
      vendas: vendas.length,
      ticket: vendas.length ? faturamento / vendas.length : 0,
      itens: unidades,
    };
  }

  /* Custo da mercadoria vendida e lucro bruto.
     Itens sem custo cadastrado entram como zero no custo — por isso o
     relatório informa quantos ficaram de fora, para o número não ser
     lido como verdade absoluta. */
  function resumoLucro() {
    let custo = 0;
    let receitaComCusto = 0;
    let unidadesComCusto = 0;
    let unidadesSemCusto = 0;

    vendas.forEach((v) => (v.itens || []).forEach((i) => {
      if (i.custo_unit == null) {
        unidadesSemCusto += i.quantidade;
      } else {
        custo += i.custo_unit * i.quantidade;
        receitaComCusto += i.preco_unit * i.quantidade;
        unidadesComCusto += i.quantidade;
      }
    }));

    custo = Math.round(custo * 100) / 100;
    receitaComCusto = Math.round(receitaComCusto * 100) / 100;
    const lucro = Math.round((receitaComCusto - custo) * 100) / 100;

    return {
      custo: custo,
      receitaComCusto: receitaComCusto,
      lucro: lucro,
      /* Mesma régua do cadastro: ganho sobre o CUSTO da mercadoria.
         "Cada R$ 1 de mercadoria virou R$ 1 de lucro" são 100%. */
      markup: custo > 0 ? Math.round((lucro / custo) * 1000) / 10 : null,
      unidadesComCusto: unidadesComCusto,
      unidadesSemCusto: unidadesSemCusto,
    };
  }

  /* Itens que giram muito com margem apertada — os que drenam dinheiro
     sem ninguém perceber, porque aparecem no topo do ranking de vendas. */
  function itensDeAtencao() {
    const mapa = {};
    vendas.forEach((v) => (v.itens || []).forEach((i) => {
      if (i.custo_unit == null) return;
      if (!mapa[i.nome]) mapa[i.nome] = { nome: i.nome, qtd: 0, receita: 0, custo: 0 };
      mapa[i.nome].qtd += i.quantidade;
      mapa[i.nome].receita += i.preco_unit * i.quantidade;
      mapa[i.nome].custo += i.custo_unit * i.quantidade;
    }));

    return Object.keys(mapa).map((k) => {
      const it = mapa[k];
      it.lucro = Math.round((it.receita - it.custo) * 100) / 100;
      it.markup = it.custo > 0 ? Math.round((it.lucro / it.custo) * 1000) / 10 : 0;
      return it;
    })
    .filter((it) => it.markup < 100)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 6);
  }

  function porDia(de, ate) {
    const mapa = {};
    const cursor = new Date(de);
    while (cursor <= ate) {
      mapa[paraCampo(cursor)] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    vendas.forEach((v) => {
      const k = paraCampo(new Date(v.criado_em));
      if (k in mapa) mapa[k] += v.total;
    });
    return Object.keys(mapa).map((k) => ({ dia: k, total: Math.round(mapa[k] * 100) / 100 }));
  }

  function ranking() {
    const mapa = {};
    vendas.forEach((v) => (v.itens || []).forEach((i) => {
      if (!mapa[i.nome]) mapa[i.nome] = { nome: i.nome, qtd: 0, valor: 0 };
      mapa[i.nome].qtd += i.quantidade;
      mapa[i.nome].valor += i.quantidade * i.preco_unit;
    }));
    return Object.keys(mapa).map((k) => mapa[k]).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
  }

  function porPagamento() {
    const mapa = {};
    vendas.forEach((v) => {
      const k = v.pagamento || "outro";
      if (!mapa[k]) mapa[k] = { chave: k, total: 0, contagem: 0 };
      mapa[k].total += v.total;
      mapa[k].contagem += 1;
    });
    return Object.keys(mapa).map((k) => mapa[k]).sort((a, b) => b.total - a.total);
  }

  function porHora() {
    const faixas = new Array(24).fill(0);
    vendas.forEach((v) => { faixas[new Date(v.criado_em).getHours()] += v.total; });
    return faixas;
  }

  function porDiaSemana() {
    const dias = new Array(7).fill(0);
    vendas.forEach((v) => { dias[new Date(v.criado_em).getDay()] += v.total; });
    return dias;
  }

  /* ---------------- Gráficos ---------------- */
  function baseOpcoes() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1A1817",
          borderColor: CORES.linha,
          borderWidth: 1,
          titleColor: "#EFE7DC",
          bodyColor: CORES.ouroClaro,
          padding: 10,
          callbacks: { label: (c) => moeda(c.parsed.y) },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: CORES.texto, font: { size: 11 } }, border: { color: CORES.linha } },
        y: {
          beginAtZero: true,
          grid: { color: CORES.linha },
          border: { display: false },
          ticks: {
            color: CORES.texto,
            font: { size: 11 },
            callback: (v) => "R$ " + v.toLocaleString("pt-BR"),
          },
        },
      },
    };
  }

  function montarGrafico(id, tipo, rotulos, valores) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === "undefined") return;
    if (graficos[id]) graficos[id].destroy();
    graficos[id] = new Chart(el, {
      type: tipo,
      data: {
        labels: rotulos,
        datasets: [{
          data: valores,
          backgroundColor: tipo === "line" ? "rgba(216,164,58,.14)" : CORES.ouro,
          borderColor: CORES.ouro,
          borderWidth: tipo === "line" ? 2 : 0,
          borderRadius: tipo === "bar" ? 4 : 0,
          fill: tipo === "line",
          tension: .32,
          pointRadius: rotulos.length > 45 ? 0 : 3,
          pointBackgroundColor: CORES.ouro,
        }],
      },
      options: baseOpcoes(),
    });
  }

  /* ---------------- Desenho ---------------- */
  function desenhar(de, ate) {
    const alvo = $("#conteudo");

    if (!vendas.length) {
      alvo.innerHTML = '<div class="sem-dados"><strong>Nenhuma venda no período</strong>' +
        "Registre vendas no Caixa para que os relatórios sejam gerados.</div>";
      return;
    }

    alvo.innerHTML = "";
    alvo.appendChild(document.getElementById("modeloRelatorio").content.cloneNode(true));

    const r = resumo();
    const dias = porDia(de, ate);
    const diasComVenda = dias.filter((d) => d.total > 0).length;

    $("#kFaturamento").textContent = moeda(r.faturamento);
    $("#kFaturamentoApoio").textContent = diasComVenda
      ? "Média de " + moeda(r.faturamento / diasComVenda) + " por dia com movimento"
      : "";
    $("#kVendas").textContent = r.vendas;
    $("#kVendasApoio").textContent = diasComVenda + (diasComVenda === 1 ? " dia" : " dias") + " com movimento";
    $("#kTicket").textContent = moeda(r.ticket);
    $("#kTicketApoio").textContent = "Valor médio por venda";
    $("#kItens").textContent = r.itens;
    $("#kItensApoio").textContent = r.vendas
      ? (r.itens / r.vendas).toFixed(1).replace(".", ",") + " itens por venda"
      : "";

    /* Custo, lucro e margem */
    const L = resumoLucro();
    const temCusto = L.unidadesComCusto > 0;

    $("#kCusto").textContent = temCusto ? moeda(L.custo) : "—";
    $("#kCustoApoio").textContent = temCusto
      ? "Referente a " + L.unidadesComCusto + " unidade(s) com custo cadastrado"
      : "Nenhum produto vendido tem custo cadastrado";

    const blocoLucro = $("#kLucro").closest(".bloco");
    $("#kLucro").textContent = temCusto ? moeda(L.lucro) : "—";
    blocoLucro.classList.toggle("prejuizo", temCusto && L.lucro < 0);
    $("#kLucroApoio").innerHTML = temCusto
      ? "Faturamento menos custo da mercadoria." +
        (L.unidadesSemCusto
          ? '<span class="sem-custo">' + L.unidadesSemCusto +
            " unidade(s) ficaram de fora por não ter custo cadastrado.</span>"
          : "")
      : "Cadastre o custo dos produtos em Produtos para ver o lucro.";

    $("#kMargem").textContent = L.markup == null ? "—" : String(L.markup).replace(".", ",") + "%";
    $("#kMargemApoio").textContent = temCusto
      ? "Lucro sobre o custo da mercadoria vendida"
      : "";

    /* Itens que vendem muito e rendem pouco */
    const atencao = itensDeAtencao();
    const painelAtencao = $("#painelAtencao");
    if (atencao.length) {
      painelAtencao.classList.remove("oculto");
      const maior = atencao[0].qtd || 1;
      $("#listaAtencao").innerHTML = atencao.map((it, i) =>
        '<div class="rank-linha">' +
          '<div class="rank-pos">' + (i + 1) + "</div>" +
          '<div class="rank-corpo">' +
            '<div class="rank-nome">' + esc(it.nome) + "</div>" +
            '<div class="rank-barra"><i style="width:' + Math.max(3, (it.qtd / maior) * 100) + '%"></i></div>' +
          "</div>" +
          '<div class="rank-valor"><strong>' + it.qtd + "x</strong>" +
            '<small class="' + (it.markup < 0 ? "ruim" : "baixa") + '">' +
              String(it.markup).replace(".", ",") + "% · " + moeda(it.lucro) +
            "</small></div>" +
        "</div>"
      ).join("");
    } else {
      painelAtencao.classList.add("oculto");
    }

    /* Faturamento por dia */
    $("#legendaFaturamento").textContent = diaCurto(de) + " a " + diaCurto(ate);
    montarGrafico("graficoDias", dias.length > 14 ? "line" : "bar",
      dias.map((d) => diaCurto(doCampo(d.dia))), dias.map((d) => d.total));

    /* Ranking */
    const rank = ranking();
    const maiorQtd = rank.length ? rank[0].qtd : 1;
    $("#ranking").innerHTML = rank.slice(0, 10).map((item, i) =>
      '<div class="rank-linha">' +
        '<div class="rank-pos">' + (i + 1) + "</div>" +
        '<div class="rank-corpo">' +
          '<div class="rank-nome">' + esc(item.nome) + "</div>" +
          '<div class="rank-barra"><i style="width:' + Math.max(3, (item.qtd / maiorQtd) * 100) + '%"></i></div>' +
        "</div>" +
        '<div class="rank-valor"><strong>' + item.qtd + "x</strong><small>" + moeda(item.valor) + "</small></div>" +
      "</div>"
    ).join("");

    /* Pagamentos */
    const pgs = porPagamento();
    const totalPg = pgs.reduce((s, p) => s + p.total, 0) || 1;
    $("#legendaPagamento").textContent = pgs.length + (pgs.length === 1 ? " forma" : " formas");
    $("#pagamentos").innerHTML = pgs.map((p) =>
      '<div class="pg-linha">' +
        '<div class="pg-nome">' + esc(ROTULO_PAGAMENTO[p.chave] || p.chave) + "</div>" +
        '<div class="pg-barra"><i style="width:' + ((p.total / totalPg) * 100).toFixed(1) + '%"></i></div>' +
        '<div class="pg-valor">' + moeda(p.total) +
          "<small>" + ((p.total / totalPg) * 100).toFixed(0) + "% · " + p.contagem + " venda(s)</small>" +
        "</div>" +
      "</div>"
    ).join("");

    /* Horários — mostra só as faixas com movimento, com folga de uma hora */
    const horas = porHora();
    let ini = horas.findIndex((v) => v > 0);
    let fim = horas.length - 1 - horas.slice().reverse().findIndex((v) => v > 0);
    if (ini === -1) { ini = 18; fim = 23; }
    ini = Math.max(0, ini - 1);
    fim = Math.min(23, fim + 1);
    const rotulosHora = [];
    const valoresHora = [];
    for (let h = ini; h <= fim; h++) {
      rotulosHora.push(String(h).padStart(2, "0") + "h");
      valoresHora.push(Math.round(horas[h] * 100) / 100);
    }
    montarGrafico("graficoHoras", "bar", rotulosHora, valoresHora);

    /* Dias da semana */
    const semana = porDiaSemana();
    montarGrafico("graficoSemana", "bar",
      DIAS_SEMANA.map((d) => d.slice(0, 3)),
      semana.map((v) => Math.round(v * 100) / 100));

    /* Lista de vendas */
    $("#legendaVendas").textContent = vendas.length + (vendas.length === 1 ? " venda" : " vendas");
    $("#listaVendas").innerHTML = vendas.map((v) => {
      const data = new Date(v.criado_em);
      const itens = (v.itens || []).map((i) => i.quantidade + "x " + i.nome).join(", ");
      return "<tr>" +
        "<td>" + data.toLocaleDateString("pt-BR") + " · " +
          data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "</td>" +
        '<td class="col-itens">' + esc(itens || "—") +
          (v.observacao ? "<br><em>" + esc(v.observacao) + "</em>" : "") + "</td>" +
        "<td>" + esc(ROTULO_PAGAMENTO[v.pagamento] || v.pagamento) + "</td>" +
        '<td class="col-valor">' + moeda(v.total) + "</td>" +
      "</tr>";
    }).join("");
  }

  /* ---------------- Exportação ---------------- */
  $("#btnExportar").addEventListener("click", function () {
    if (!vendas.length) { avisar("Não há vendas no período para exportar.", "erro"); return; }

    const linhas = [["Data", "Hora", "Produto", "Categoria", "Quantidade", "Preco unitario",
                     "Subtotal", "Custo unitario", "Lucro", "Pagamento", "Comanda", "Venda"]];
    vendas.slice().reverse().forEach((v) => {
      const d = new Date(v.criado_em);
      (v.itens || []).forEach((i) => {
        linhas.push([
          d.toLocaleDateString("pt-BR"),
          d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          i.nome, i.categoria, i.quantidade,
          i.preco_unit.toFixed(2).replace(".", ","),
          (i.preco_unit * i.quantidade).toFixed(2).replace(".", ","),
          i.custo_unit == null ? "" : i.custo_unit.toFixed(2).replace(".", ","),
          i.custo_unit == null ? "" : ((i.preco_unit - i.custo_unit) * i.quantidade).toFixed(2).replace(".", ","),
          ROTULO_PAGAMENTO[v.pagamento] || v.pagamento,
          v.comanda_numero || "",
          v.id,
        ]);
      });
    });

    const csv = "﻿" + linhas.map((l) =>
      l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(";")
    ).join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "front-beer-vendas-" + $("#dataDe").value + "-a-" + $("#dataAte").value + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    avisar("Arquivo exportado. Abre no Excel.", "ok");
  });

  $("#btnImprimir").addEventListener("click", () => window.print());

  /* ---------------- Início ---------------- */
  (async function iniciar() {
    const nome = CFG.nome || "";
    const d = CFG.nomeDestaque || "";
    $$("[data-marca]").forEach((el) => {
      el.innerHTML = d && nome.indexOf(d) !== -1
        ? esc(nome).replace(esc(d), "<em>" + esc(d) + "</em>")
        : esc(nome);
    });
    document.title = "Relatórios | " + nome;
    await DB.init();
    const usuario = await DB.usuarioAtual();
    if (usuario) await abrirRelatorios(usuario);
  })();
})();
