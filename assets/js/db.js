/* =====================================================================
   FRONT BEER — Camada de dados
   Dois modos, mesma interface:
     supabase : nuvem, com login e políticas RLS (produção)
     demo     : localStorage do navegador (apenas para testes)
   ===================================================================== */

const DB = (() => {
  "use strict";

  const CFG = window.APP_CONFIG || {};
  const CHAVE_PRODUTOS = "frontbeer:produtos";
  const CHAVE_VENDAS   = "frontbeer:vendas";
  const CHAVE_SESSAO   = "frontbeer:sessao";
  const CDN_SUPABASE   = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

  let modo = "demo";
  let sb = null;

  /* ------------------------------------------------------------------
     Cardápio de exemplo — valores ilustrativos.
     O proprietário limpa tudo no painel e cadastra o cardápio real.
  ------------------------------------------------------------------ */
  const EXEMPLOS = [
    { nome: "Espeto de Carne",              descricao: "Alcatra temperada na brasa",       categoria: "Espetos", preco: 10 },
    { nome: "Espeto de Frango",             descricao: "Peito de frango marinado",         categoria: "Espetos", preco: 9 },
    { nome: "Espeto de Linguiça",           descricao: "Linguiça toscana",                 categoria: "Espetos", preco: 9 },
    { nome: "Espeto de Coração",            descricao: "Coração de frango no sal grosso",  categoria: "Espetos", preco: 11 },
    { nome: "Espeto de Queijo Coalho",      descricao: "Com melaço de cana",               categoria: "Espetos", preco: 10 },
    { nome: "Espeto de Cupim",              descricao: "Fatiado, na brasa",                categoria: "Espetos", preco: 13 },
    { nome: "Medalhão de Frango com Bacon", descricao: "Enrolado no bacon",                categoria: "Espetos", preco: 13 },
    { nome: "Pão de Alho",                  descricao: "Na brasa, com manteiga de alho",   categoria: "Espetos", preco: 8 },

    { nome: "Batata Frita",                 descricao: "Porção 400g",                      categoria: "Petiscos", preco: 28 },
    { nome: "Mandioca Frita",               descricao: "Porção 400g",                      categoria: "Petiscos", preco: 26 },
    { nome: "Calabresa Acebolada",          descricao: "Porção com pão de alho",           categoria: "Petiscos", preco: 32 },
    { nome: "Torresmo Crocante",            descricao: "Porção 300g",                      categoria: "Petiscos", preco: 30 },
    { nome: "Frango a Passarinho",          descricao: "Porção 500g com alho e limão",     categoria: "Petiscos", preco: 38 },
    { nome: "Amendoim Torrado",             descricao: "Porção individual",                categoria: "Petiscos", preco: 8 },

    { nome: "Cerveja Lata 269ml",           descricao: "Gelada",                           categoria: "Cervejas", preco: 5,   alcoolico: true },
    { nome: "Cerveja Lata 350ml",           descricao: "Gelada",                           categoria: "Cervejas", preco: 6.5, alcoolico: true },
    { nome: "Cerveja Lata 473ml",           descricao: "Latão gelado",                     categoria: "Cervejas", preco: 9,   alcoolico: true },
    { nome: "Cerveja Long Neck 330ml",      descricao: "Gelada",                           categoria: "Cervejas", preco: 11,  alcoolico: true },
    { nome: "Cerveja Garrafa 600ml",        descricao: "Gelada",                           categoria: "Cervejas", preco: 14,  alcoolico: true },
    { nome: "Cerveja Puro Malte 350ml",     descricao: "Lata gelada",                      categoria: "Cervejas", preco: 7.5, alcoolico: true },

    { nome: "Dose de Cachaça",              descricao: "50ml",                             categoria: "Doses e Destilados", preco: 7,   alcoolico: true },
    { nome: "Dose de Vodka",                descricao: "50ml",                             categoria: "Doses e Destilados", preco: 12,  alcoolico: true },
    { nome: "Dose de Whisky",               descricao: "50ml",                             categoria: "Doses e Destilados", preco: 18,  alcoolico: true },
    { nome: "Caipirinha",                   descricao: "Limão, morango ou maracujá",       categoria: "Doses e Destilados", preco: 18,  alcoolico: true },
    { nome: "Gin Tônica",                   descricao: "Com limão siciliano",              categoria: "Doses e Destilados", preco: 24,  alcoolico: true },
    { nome: "Garrafa de Vodka",             descricao: "1L — para levar",                  categoria: "Doses e Destilados", preco: 45,  alcoolico: true },
    { nome: "Garrafa de Whisky",            descricao: "1L — para levar",                  categoria: "Doses e Destilados", preco: 120, alcoolico: true },

    { nome: "Refrigerante Lata 350ml",      descricao: "Diversos sabores",                 categoria: "Sem Álcool", preco: 6 },
    { nome: "Refrigerante 2L",              descricao: "Diversos sabores",                 categoria: "Sem Álcool", preco: 14 },
    { nome: "Energético 250ml",             descricao: "Lata gelada",                      categoria: "Sem Álcool", preco: 12 },
    { nome: "Água Mineral 500ml",           descricao: "Com ou sem gás",                   categoria: "Sem Álcool", preco: 4 },
    { nome: "Água de Coco 200ml",           descricao: "Caixinha gelada",                  categoria: "Sem Álcool", preco: 6 },
    { nome: "Suco de Caixinha",             descricao: "Diversos sabores",                 categoria: "Sem Álcool", preco: 7 },
  ].map((p, i) => Object.assign(
    { id: "ex-" + (i + 1), imagem_url: "", ativo: true, esgotado: false, alcoolico: false, ordem: i + 1 },
    p
  ));

  /* ---------------- Armazenamento local (modo demo) ---------------- */
  function lerLocal() {
    try {
      const bruto = localStorage.getItem(CHAVE_PRODUTOS);
      if (bruto === null) {
        const copia = JSON.parse(JSON.stringify(EXEMPLOS));
        localStorage.setItem(CHAVE_PRODUTOS, JSON.stringify(copia));
        return copia;
      }
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados : [];
    } catch (e) {
      console.warn("Dados locais ilegíveis, recomeçando vazio.", e);
      return [];
    }
  }

  function gravarLocal(lista) {
    localStorage.setItem(CHAVE_PRODUTOS, JSON.stringify(lista));
  }

  function lerVendasLocal() {
    try {
      const bruto = localStorage.getItem(CHAVE_VENDAS);
      const dados = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(dados) ? dados : [];
    } catch (e) {
      console.warn("Vendas locais ilegíveis.", e);
      return [];
    }
  }

  function gravarVendasLocal(lista) {
    localStorage.setItem(CHAVE_VENDAS, JSON.stringify(lista));
  }

  function carregarScript(src) {
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => falha(new Error("Falha ao carregar " + src));
      document.head.appendChild(s);
    });
  }

  /* ---------------- Normalização e validação ---------------- */
  function normalizar(p) {
    return {
      id:         p.id,
      nome:       String(p.nome || "").trim(),
      descricao:  String(p.descricao || "").trim(),
      categoria:  String(p.categoria || "").trim(),
      preco:      Math.round((Number(p.preco) || 0) * 100) / 100,
      imagem_url: String(p.imagem_url || "").trim(),
      ativo:      p.ativo !== false,
      esgotado:   p.esgotado === true,
      alcoolico:  p.alcoolico === true,
      ordem:      Number(p.ordem) || 0,
    };
  }

  /* Cadastros antigos sem categoria caem em "Outros" ao serem exibidos */
  function comCategoria(p) {
    if (!p.categoria) p.categoria = "Outros";
    return p;
  }

  function validar(p) {
    if (!p.nome) throw new Error("Informe o nome do produto.");
    if (p.nome.length > 80) throw new Error("O nome deve ter no máximo 80 caracteres.");
    if (p.descricao.length > 180) throw new Error("A descrição deve ter no máximo 180 caracteres.");
    if (!p.categoria) throw new Error("Informe a categoria.");
    if (!isFinite(p.preco) || p.preco < 0) throw new Error("Informe um preço válido.");
    if (p.preco > 100000) throw new Error("Preço acima do limite permitido.");
    if (p.imagem_url && !/^https?:\/\//i.test(p.imagem_url)) {
      throw new Error("A URL da foto deve começar com http:// ou https://");
    }
  }

  function ordenar(lista) {
    return lista.sort((a, b) =>
      (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome, "pt-BR")
    );
  }

  function traduzirErro(e) {
    const m = (e && e.message) || String(e);
    if (/Invalid login credentials/i.test(m)) return new Error("E-mail ou senha incorretos.");
    if (/Email not confirmed/i.test(m))       return new Error("E-mail ainda não confirmado.");
    if (/JWT|not authenticated|401/i.test(m)) return new Error("Sua sessão expirou. Entre novamente.");
    if (/Failed to fetch|NetworkError/i.test(m)) return new Error("Sem conexão com o servidor. Verifique a internet.");
    return new Error(m);
  }

  /* ---------------- Interface pública ---------------- */
  return {
    get modo() { return modo; },
    get exemplos() { return JSON.parse(JSON.stringify(EXEMPLOS)); },

    async init() {
      if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) { modo = "demo"; return modo; }
      try {
        if (!window.supabase) await carregarScript(CDN_SUPABASE);
        sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
        modo = "supabase";
      } catch (e) {
        console.error("Supabase indisponível; caindo para modo demonstração.", e);
        modo = "demo";
      }
      return modo;
    },

    /* --- Leitura --- */
    async listarProdutos(apenasVisiveis) {
      const visiveis = apenasVisiveis !== false;
      if (modo === "supabase") {
        let q = sb.from("produtos").select("*");
        if (visiveis) q = q.eq("ativo", true);
        const { data, error } = await q.order("ordem").order("nome");
        if (error) throw traduzirErro(error);
        return (data || []).map(normalizar).map(comCategoria);
      }
      return ordenar(lerLocal().map(normalizar).map(comCategoria).filter((p) => (visiveis ? p.ativo : true)));
    },

    /* --- Escrita --- */
    async salvarProduto(entrada) {
      const p = normalizar(entrada);
      validar(p);

      if (modo === "supabase") {
        const dados = {
          nome: p.nome, descricao: p.descricao, categoria: p.categoria,
          preco: p.preco, imagem_url: p.imagem_url, ativo: p.ativo,
          esgotado: p.esgotado, alcoolico: p.alcoolico, ordem: p.ordem,
        };
        const req = p.id
          ? sb.from("produtos").update(dados).eq("id", p.id).select().single()
          : sb.from("produtos").insert(dados).select().single();
        const { data, error } = await req;
        if (error) throw traduzirErro(error);
        return normalizar(data);
      }

      const lista = lerLocal();
      if (p.id) {
        const i = lista.findIndex((x) => x.id === p.id);
        if (i === -1) throw new Error("Produto não encontrado.");
        lista[i] = Object.assign({}, lista[i], p);
      } else {
        p.id = "loc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        if (!p.ordem) p.ordem = lista.length + 1;
        lista.push(p);
      }
      gravarLocal(lista);
      return p;
    },

    async excluirProduto(id) {
      if (modo === "supabase") {
        const { error } = await sb.from("produtos").delete().eq("id", id);
        if (error) throw traduzirErro(error);
        return true;
      }
      gravarLocal(lerLocal().filter((p) => p.id !== id));
      return true;
    },

    async definirEsgotado(id, esgotado) {
      if (modo === "supabase") {
        const { error } = await sb.from("produtos").update({ esgotado: !!esgotado }).eq("id", id);
        if (error) throw traduzirErro(error);
        return true;
      }
      const lista = lerLocal();
      const p = lista.find((x) => x.id === id);
      if (p) { p.esgotado = !!esgotado; gravarLocal(lista); }
      return true;
    },

    async definirAtivo(id, ativo) {
      if (modo === "supabase") {
        const { error } = await sb.from("produtos").update({ ativo: !!ativo }).eq("id", id);
        if (error) throw traduzirErro(error);
        return true;
      }
      const lista = lerLocal();
      const p = lista.find((x) => x.id === id);
      if (p) { p.ativo = !!ativo; gravarLocal(lista); }
      return true;
    },

    /* Repõe todos os itens esgotados de uma vez (rotina de abertura) */
    async reporTodos() {
      if (modo === "supabase") {
        const { error } = await sb.from("produtos").update({ esgotado: false }).eq("esgotado", true);
        if (error) throw traduzirErro(error);
        return true;
      }
      const lista = lerLocal();
      lista.forEach((p) => { p.esgotado = false; });
      gravarLocal(lista);
      return true;
    },

    /* Reajuste percentual, opcionalmente restrito a uma categoria */
    async reajustarPrecos(percentual, categoria) {
      const pct = Number(percentual);
      if (!isFinite(pct) || pct <= -100) throw new Error("Percentual inválido.");
      const fator = 1 + pct / 100;
      const lista = await this.listarProdutos(false);
      const alvo = lista.filter((p) => !categoria || p.categoria === categoria);
      for (const p of alvo) {
        p.preco = Math.round(p.preco * fator * 100) / 100;
        await this.salvarProduto(p);
      }
      return alvo.length;
    },

    async limparCardapio() {
      if (modo === "supabase") {
        const { error } = await sb.from("produtos").delete().not("id", "is", null);
        if (error) throw traduzirErro(error);
        return true;
      }
      gravarLocal([]);
      return true;
    },

    async restaurarExemplos() {
      if (modo === "supabase") {
        for (const p of this.exemplos) { delete p.id; await this.salvarProduto(p); }
        return true;
      }
      gravarLocal(this.exemplos);
      return true;
    },

    /* ------------------------------------------------------------
       VENDAS
       Nome, categoria e preço são congelados no momento da venda,
       para que reajustes futuros não alterem o histórico.
    ------------------------------------------------------------ */

    async registrarVenda(venda) {
      const pagamentosValidos = ["dinheiro", "pix", "debito", "credito", "outro"];
      const pagamento = pagamentosValidos.indexOf(venda.pagamento) !== -1 ? venda.pagamento : "dinheiro";
      const observacao = String(venda.observacao || "").trim().slice(0, 200);

      const itens = (venda.itens || []).map((i) => ({
        produto_id: i.produto_id && String(i.produto_id).indexOf("ex-") !== 0 && String(i.produto_id).indexOf("loc-") !== 0
          ? i.produto_id : null,
        nome:       String(i.nome || "").trim(),
        categoria:  String(i.categoria || "Outros").trim() || "Outros",
        preco_unit: Math.round((Number(i.preco_unit) || 0) * 100) / 100,
        quantidade: Math.max(1, Math.min(999, parseInt(i.quantidade, 10) || 1)),
      })).filter((i) => i.nome);

      if (!itens.length) throw new Error("Adicione ao menos um item à venda.");

      const total = Math.round(itens.reduce((s, i) => s + i.preco_unit * i.quantidade, 0) * 100) / 100;

      if (modo === "supabase") {
        const { data, error } = await sb.from("vendas")
          .insert({ total: total, pagamento: pagamento, observacao: observacao })
          .select().single();
        if (error) throw traduzirErro(error);

        const linhas = itens.map((i) => Object.assign({ venda_id: data.id }, i));
        const res = await sb.from("venda_itens").insert(linhas);
        if (res.error) {
          await sb.from("vendas").delete().eq("id", data.id);   // desfaz a venda incompleta
          throw traduzirErro(res.error);
        }
        return Object.assign({}, data, { itens: itens });
      }

      const lista = lerVendasLocal();
      const registro = {
        id: "v-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        criado_em: new Date().toISOString(),
        total: total,
        pagamento: pagamento,
        observacao: observacao,
        itens: itens,
      };
      lista.push(registro);
      gravarVendasLocal(lista);
      return registro;
    },

    /* de e ate são objetos Date; ate é inclusivo até o fim do dia */
    async listarVendas(de, ate) {
      const inicio = de ? new Date(de) : new Date(0);
      const fim = ate ? new Date(ate) : new Date();
      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);

      if (modo === "supabase") {
        const { data, error } = await sb.from("vendas")
          .select("id, criado_em, total, pagamento, observacao, venda_itens(nome, categoria, preco_unit, quantidade)")
          .gte("criado_em", inicio.toISOString())
          .lte("criado_em", fim.toISOString())
          .order("criado_em", { ascending: false });
        if (error) throw traduzirErro(error);
        return (data || []).map((v) => ({
          id: v.id, criado_em: v.criado_em, total: Number(v.total) || 0,
          pagamento: v.pagamento, observacao: v.observacao || "",
          itens: (v.venda_itens || []).map((i) => ({
            nome: i.nome, categoria: i.categoria,
            preco_unit: Number(i.preco_unit) || 0,
            quantidade: Number(i.quantidade) || 0,
          })),
        }));
      }

      return lerVendasLocal()
        .filter((v) => {
          const d = new Date(v.criado_em);
          return d >= inicio && d <= fim;
        })
        .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    },

    async excluirVenda(id) {
      if (modo === "supabase") {
        const { error } = await sb.from("vendas").delete().eq("id", id);
        if (error) throw traduzirErro(error);
        return true;
      }
      gravarVendasLocal(lerVendasLocal().filter((v) => v.id !== id));
      return true;
    },

    /* --- Sessão --- */
    async login(email, senha) {
      if (modo === "supabase") {
        const { data, error } = await sb.auth.signInWithPassword({
          email: String(email).trim(), password: senha,
        });
        if (error) throw traduzirErro(error);
        return data.user;
      }
      if (String(email).trim().toLowerCase() === "admin@demo" && senha === "frontbeer") {
        sessionStorage.setItem(CHAVE_SESSAO, "1");
        return { email: "admin@demo" };
      }
      throw new Error("E-mail ou senha incorretos.");
    },

    async logout() {
      if (modo === "supabase") await sb.auth.signOut();
      sessionStorage.removeItem(CHAVE_SESSAO);
    },

    async usuarioAtual() {
      if (modo === "supabase") {
        const { data } = await sb.auth.getUser();
        return (data && data.user) || null;
      }
      return sessionStorage.getItem(CHAVE_SESSAO) ? { email: "admin@demo" } : null;
    },
  };
})();

window.DB = DB;
