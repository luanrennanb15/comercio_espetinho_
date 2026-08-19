/* =====================================================================
   CAMADA DE DADOS
   Funciona em dois modos:
     - "supabase" : quando supabaseUrl/supabaseAnonKey estão preenchidos
                    em config.js. Dados na nuvem, login real, RLS.
     - "demo"     : sem configuração. Dados ficam no localStorage deste
                    navegador. Serve para testar a interface. NÃO use em
                    produção: não há segurança real no modo demo.
   ===================================================================== */

const DB = (() => {
  const CFG = window.APP_CONFIG || {};
  const CHAVE_PRODUTOS = "espetinho:produtos";
  const CHAVE_SESSAO = "espetinho:sessao_demo";

  let modo = "demo";
  let sb = null;

  /* ---------------- Dados de exemplo (modo demo) ----------------
     Itens e preços meramente ilustrativos. O proprietário substitui
     tudo pelo painel — há um botão "Limpar cardápio" lá dentro.
  ---------------------------------------------------------------- */
  const SEED = [
    // --- Espetos ---
    { nome: "Espeto de Carne", descricao: "Alcatra temperada na brasa", categoria: "Espetos", preco: 10.0 },
    { nome: "Espeto de Frango", descricao: "Peito de frango marinado", categoria: "Espetos", preco: 9.0 },
    { nome: "Espeto de Linguiça", descricao: "Linguiça toscana", categoria: "Espetos", preco: 9.0 },
    { nome: "Espeto de Coração", descricao: "Coração de frango no sal grosso", categoria: "Espetos", preco: 11.0 },
    { nome: "Espeto de Queijo Coalho", descricao: "Com melaço de cana", categoria: "Espetos", preco: 10.0 },
    { nome: "Espeto de Cupim", descricao: "Fatiado, na brasa", categoria: "Espetos", preco: 13.0 },
    { nome: "Medalhão de Frango com Bacon", descricao: "Enrolado no bacon", categoria: "Espetos", preco: 13.0 },
    { nome: "Pão de Alho", descricao: "Na brasa, com manteiga de alho", categoria: "Espetos", preco: 8.0 },

    // --- Petiscos ---
    { nome: "Batata Frita", descricao: "Porção 400g", categoria: "Petiscos", preco: 28.0 },
    { nome: "Mandioca Frita", descricao: "Porção 400g", categoria: "Petiscos", preco: 26.0 },
    { nome: "Calabresa Acebolada", descricao: "Porção com pão de alho", categoria: "Petiscos", preco: 32.0 },
    { nome: "Torresmo Crocante", descricao: "Porção 300g", categoria: "Petiscos", preco: 30.0 },
    { nome: "Frango a Passarinho", descricao: "Porção 500g com alho e limão", categoria: "Petiscos", preco: 38.0 },
    { nome: "Amendoim Torrado", descricao: "Porção individual", categoria: "Petiscos", preco: 8.0 },

    // --- Cervejas (alcoólicas) ---
    { nome: "Cerveja Lata 269ml", descricao: "Latinha gelada", categoria: "Cervejas", preco: 5.0, alcoolico: true },
    { nome: "Cerveja Lata 350ml", descricao: "Gelada", categoria: "Cervejas", preco: 6.5, alcoolico: true },
    { nome: "Cerveja Lata 473ml", descricao: "Latão gelado", categoria: "Cervejas", preco: 9.0, alcoolico: true },
    { nome: "Cerveja Long Neck 330ml", descricao: "Gelada", categoria: "Cervejas", preco: 11.0, alcoolico: true },
    { nome: "Cerveja Garrafa 600ml", descricao: "Gelada", categoria: "Cervejas", preco: 14.0, alcoolico: true },
    { nome: "Cerveja Puro Malte 350ml", descricao: "Lata gelada", categoria: "Cervejas", preco: 7.5, alcoolico: true },

    // --- Destilados e doses (alcoólicas) ---
    { nome: "Dose de Cachaça", descricao: "50ml", categoria: "Doses e Destilados", preco: 7.0, alcoolico: true },
    { nome: "Dose de Vodka", descricao: "50ml", categoria: "Doses e Destilados", preco: 12.0, alcoolico: true },
    { nome: "Dose de Whisky", descricao: "50ml", categoria: "Doses e Destilados", preco: 18.0, alcoolico: true },
    { nome: "Caipirinha", descricao: "Limão, morango ou maracujá", categoria: "Doses e Destilados", preco: 18.0, alcoolico: true },
    { nome: "Gin Tônica", descricao: "Com limão siciliano", categoria: "Doses e Destilados", preco: 24.0, alcoolico: true },
    { nome: "Garrafa de Vodka", descricao: "1L — para levar", categoria: "Doses e Destilados", preco: 45.0, alcoolico: true },
    { nome: "Garrafa de Whisky", descricao: "1L — para levar", categoria: "Doses e Destilados", preco: 120.0, alcoolico: true },

    // --- Sem álcool ---
    { nome: "Refrigerante Lata 350ml", descricao: "Diversos sabores", categoria: "Sem Álcool", preco: 6.0 },
    { nome: "Refrigerante 2L", descricao: "Diversos sabores", categoria: "Sem Álcool", preco: 14.0 },
    { nome: "Energético 250ml", descricao: "Lata gelada", categoria: "Sem Álcool", preco: 12.0 },
    { nome: "Água Mineral 500ml", descricao: "Com ou sem gás", categoria: "Sem Álcool", preco: 4.0 },
    { nome: "Água de Coco 200ml", descricao: "Caixinha gelada", categoria: "Sem Álcool", preco: 6.0 },
    { nome: "Suco de Caixinha", descricao: "Diversos sabores", categoria: "Sem Álcool", preco: 7.0 },
  ].map((p, i) => ({
    id: "demo-" + (i + 1),
    imagem_url: "",
    ativo: true,
    esgotado: false,
    alcoolico: false,
    ordem: i + 1,
    ...p,
  }));

  /* ---------------- Helpers do modo demo ---------------- */
  function lerLocal() {
    try {
      const bruto = localStorage.getItem(CHAVE_PRODUTOS);
      if (!bruto) {
        localStorage.setItem(CHAVE_PRODUTOS, JSON.stringify(SEED));
        return JSON.parse(JSON.stringify(SEED));
      }
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados : [];
    } catch (e) {
      console.warn("Falha ao ler dados locais:", e);
      return [];
    }
  }

  function gravarLocal(lista) {
    localStorage.setItem(CHAVE_PRODUTOS, JSON.stringify(lista));
  }

  function carregarScript(src) {
    return new Promise((ok, erro) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => erro(new Error("Não foi possível carregar " + src));
      document.head.appendChild(s);
    });
  }

  /* ---------------- Normalização ---------------- */
  function normalizar(p) {
    return {
      id: p.id,
      nome: String(p.nome || "").trim(),
      descricao: String(p.descricao || "").trim(),
      categoria: String(p.categoria || "Outros").trim() || "Outros",
      preco: Number(p.preco) || 0,
      imagem_url: String(p.imagem_url || "").trim(),
      ativo: p.ativo !== false,
      esgotado: p.esgotado === true,
      alcoolico: p.alcoolico === true,
      ordem: Number(p.ordem) || 0,
    };
  }

  // Ordena pelo campo "ordem" (controlado no painel) e depois pelo nome.
  // As categorias aparecem no cardápio na ordem do primeiro item de cada uma.
  function ordenar(lista) {
    return lista.sort(
      (a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome, "pt-BR")
    );
  }

  /* ---------------- API pública ---------------- */
  return {
    get modo() {
      return modo;
    },

    async init() {
      const temConfig = CFG.supabaseUrl && CFG.supabaseAnonKey;
      if (!temConfig) {
        modo = "demo";
        return modo;
      }
      try {
        if (!window.supabase) {
          await carregarScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js");
        }
        sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
        modo = "supabase";
      } catch (e) {
        console.error("Supabase indisponível, usando modo demonstração.", e);
        modo = "demo";
      }
      return modo;
    },

    /* --- Produtos --- */

    // apenasVisiveis = true  -> só o que o cliente pode ver (cardápio)
    // apenasVisiveis = false -> tudo (painel interno)
    async listarProdutos(apenasVisiveis = true) {
      if (modo === "supabase") {
        let q = sb.from("produtos").select("*");
        if (apenasVisiveis) q = q.eq("ativo", true);
        const { data, error } = await q.order("ordem").order("nome");
        if (error) throw error;
        return (data || []).map(normalizar);
      }
      const lista = lerLocal().map(normalizar).filter((p) => (apenasVisiveis ? p.ativo : true));
      return ordenar(lista);
    },

    async salvarProduto(produto) {
      const p = normalizar(produto);
      if (!p.nome) throw new Error("O nome do produto é obrigatório.");
      if (p.preco < 0) throw new Error("O preço não pode ser negativo.");

      if (modo === "supabase") {
        const payload = {
          nome: p.nome,
          descricao: p.descricao,
          categoria: p.categoria,
          preco: p.preco,
          imagem_url: p.imagem_url,
          ativo: p.ativo,
          esgotado: p.esgotado,
          alcoolico: p.alcoolico,
          ordem: p.ordem,
        };
        const acao = p.id
          ? sb.from("produtos").update(payload).eq("id", p.id).select().single()
          : sb.from("produtos").insert(payload).select().single();
        const { data, error } = await acao;
        if (error) throw error;
        return normalizar(data);
      }

      const lista = lerLocal();
      if (p.id) {
        const i = lista.findIndex((x) => x.id === p.id);
        if (i === -1) throw new Error("Produto não encontrado.");
        lista[i] = { ...lista[i], ...p };
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
        if (error) throw error;
        return true;
      }
      gravarLocal(lerLocal().filter((p) => p.id !== id));
      return true;
    },

    async definirEsgotado(id, esgotado) {
      if (modo === "supabase") {
        const { error } = await sb.from("produtos").update({ esgotado: !!esgotado }).eq("id", id);
        if (error) throw error;
        return true;
      }
      const lista = lerLocal();
      const p = lista.find((x) => x.id === id);
      if (p) {
        p.esgotado = !!esgotado;
        gravarLocal(lista);
      }
      return true;
    },

    // Reajuste de preços em lote (percentual). Ex.: 10 = +10%, -5 = -5%
    async reajustarPrecos(percentual, categoria) {
      const fator = 1 + Number(percentual) / 100;
      const lista = await this.listarProdutos(false);
      const alvo = lista.filter((p) => !categoria || p.categoria === categoria);
      for (const p of alvo) {
        p.preco = Math.round(p.preco * fator * 100) / 100;
        await this.salvarProduto(p);
      }
      return alvo.length;
    },

    /* --- Autenticação (painel interno) --- */

    async login(email, senha) {
      if (modo === "supabase") {
        const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw new Error("E-mail ou senha inválidos.");
        return data.user;
      }
      // MODO DEMO: credencial fixa, apenas para testar a interface.
      if (email.trim().toLowerCase() === "admin@demo" && senha === "espetinho") {
        sessionStorage.setItem(CHAVE_SESSAO, "1");
        return { email: "admin@demo" };
      }
      throw new Error("E-mail ou senha inválidos.");
    },

    async logout() {
      if (modo === "supabase") await sb.auth.signOut();
      sessionStorage.removeItem(CHAVE_SESSAO);
    },

    async usuarioAtual() {
      if (modo === "supabase") {
        const { data } = await sb.auth.getUser();
        return data?.user || null;
      }
      return sessionStorage.getItem(CHAVE_SESSAO) ? { email: "admin@demo" } : null;
    },

    // Apaga TODOS os produtos — usado para o proprietário começar do zero,
    // sem os itens de exemplo.
    async limparCardapio() {
      if (modo === "supabase") {
        const { error } = await sb.from("produtos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        return true;
      }
      gravarLocal([]);
      return true;
    },

    async restaurarExemplos() {
      if (modo !== "demo") throw new Error("Disponível apenas no modo demonstração.");
      gravarLocal(JSON.parse(JSON.stringify(SEED)));
    },
  };
})();

window.DB = DB;

/* Util global: formatação em Real */
function moeda(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* Util global: escapa HTML (proteção contra XSS ao renderizar dados) */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* Util global: só aceita URLs de imagem http(s) — bloqueia javascript: */
function urlSegura(u) {
  const s = String(u || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

window.moeda = moeda;
window.esc = esc;
window.urlSegura = urlSegura;
