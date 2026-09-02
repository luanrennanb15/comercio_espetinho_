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
  const CHAVE_COMANDAS = "frontbeer:comandas";
  const CHAVE_CUSTOS   = "frontbeer:custos";
  const CHAVE_SESSAO   = "frontbeer:sessao";
  const CDN_SUPABASE   = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  const BALDE_FOTOS    = "produtos";           // bucket criado por supabase/storage.sql
  const LADO_MAXIMO    = 900;                  // maior lado da foto, em pixels
  const QUALIDADE      = 0.82;
  const TEMPO_LIMITE   = 12000;              // desistir de esperar a rede, em ms

  let modo = "demo";
  let sb = null;

  /* Aceita o nome novo e os antigos, para não quebrar configurações existentes */
  const CHAVE_API = CFG.supabaseChave || CFG.supabasePublishableKey || CFG.supabaseAnonKey || "";

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

  function lerComandasLocal() {
    try {
      const bruto = localStorage.getItem(CHAVE_COMANDAS);
      if (bruto === null) {
        const novas = [];
        for (let n = 1; n <= 20; n++) {
          novas.push({
            id: "c-" + n,
            numero: n,
            token: "demo" + String(n).padStart(2, "0") + "token",
            status: "livre",
            aberta_em: null,
            itens: [],
          });
        }
        localStorage.setItem(CHAVE_COMANDAS, JSON.stringify(novas));
        return novas;
      }
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados : [];
    } catch (e) {
      console.warn("Comandas locais ilegíveis.", e);
      return [];
    }
  }

  function gravarComandasLocal(lista) {
    localStorage.setItem(CHAVE_COMANDAS, JSON.stringify(lista));
  }

  /* Carrega a biblioteca do Supabase.

     O prazo existe porque `onerror` não cobre todos os casos: numa rede
     que aceita a conexão e nunca responde — wi-fi de bar, portal cativo,
     3G ruim — nem `onload` nem `onerror` disparam, e a promessa fica
     pendurada para sempre. Sem prazo, o cliente encara o "carregando"
     até desistir. Com prazo, o sistema desiste primeiro e explica. */
  function carregarScript(src, prazoMs) {
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      let encerrado = false;
      const relogio = setTimeout(() => {
        if (encerrado) return;
        encerrado = true;
        s.remove();
        falha(new Error("Tempo esgotado ao carregar " + src));
      }, prazoMs || TEMPO_LIMITE);

      s.src = src;
      s.onload = () => { if (!encerrado) { encerrado = true; clearTimeout(relogio); ok(); } };
      s.onerror = () => {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(relogio);
        falha(new Error("Falha ao carregar " + src));
      };
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
    if (p.imagem_url && !UI.urlSegura(p.imagem_url)) {
      throw new Error(
        "Foto inválida. Use um link da internet começando com https:// " +
        "ou um arquivo do próprio site, como assets/img/fotos/espeto.jpg"
      );
    }
  }

  /* ------------------------------------------------------------------
     Contas de custo e margem

     custo unitário = custo da compra / quantas unidades ela rende
     margem sobre a venda = (preço - custo) / preço

     Usamos margem sobre a venda, e não markup sobre o custo. Custo 4 e
     preço 6 dá 33% de margem (e 50% de markup) — confundir os dois faz
     o preço sair barato demais.
  ------------------------------------------------------------------ */
  function custoUnitario(custo) {
    if (!custo) return null;
    const compra = Number(custo.custo_compra);
    const rende = Number(custo.rende_unidades);
    if (!isFinite(compra) || !isFinite(rende) || rende <= 0) return null;
    /* Números válidos ainda podem gerar um quociente que estoura
       (1e308 dividido por 1e-308). Melhor não devolver nada do que
       devolver Infinity e escrever "R$ Infinity" na tela. */
    const unitario = Math.round((compra / rende) * 100) / 100;
    return isFinite(unitario) ? unitario : null;
  }

  function margemDe(preco, unitario) {
    const p = Number(preco);
    if (unitario == null || !isFinite(p) || p <= 0) return null;
    return Math.round(((p - unitario) / p) * 1000) / 10;      // uma casa decimal
  }

  /* Markup: lucro sobre o CUSTO — a régua do balcão.
     "Botei o dobro" é markup de 100%. É o que o sistema exibe. */
  function markupDe(preco, unitario) {
    const p = Number(preco);
    if (unitario == null || unitario <= 0 || !isFinite(p)) return null;
    return Math.round(((p - unitario) / unitario) * 1000) / 10;
  }

  /* Preço que atinge o markup desejado, arredondado para cima em
     múltiplos de R$ 0,50 — arredondar para baixo entregaria menos
     lucro que o pedido. */
  function precoParaMarkup(unitario, markupPercentual) {
    const u = Number(unitario);
    const k = Number(markupPercentual);
    if (!isFinite(u) || u <= 0 || !isFinite(k) || k < 0) return null;
    return Math.ceil(u * (1 + k / 100) * 2) / 2;
  }

  /* Preço que atinge a margem desejada, arredondado para valor de bar:
     nada de R$ 5,83 — sobe para R$ 6,00. */
  function precoParaMargem(unitario, margemPercentual) {
    const u = Number(unitario);
    const m = Number(margemPercentual);
    if (!isFinite(u) || u <= 0 || !isFinite(m) || m >= 100) return null;
    const bruto = u / (1 - m / 100);
    return Math.ceil(bruto * 2) / 2;                          // múltiplos de R$ 0,50
  }

  /* Redimensiona e recomprime a foto usando o próprio navegador */
  function reduzirImagem(arquivo) {
    return new Promise(function (ok, falha) {
      const leitor = new FileReader();
      leitor.onerror = function () { falha(new Error("Não foi possível ler o arquivo.")); };
      leitor.onload = function () {
        const img = new Image();
        img.onerror = function () { falha(new Error("Arquivo de imagem inválido ou corrompido.")); };
        img.onload = function () {
          let { width: l, height: a } = img;
          const maior = Math.max(l, a);
          if (maior > LADO_MAXIMO) {
            const fator = LADO_MAXIMO / maior;
            l = Math.round(l * fator);
            a = Math.round(a * fator);
          }
          const tela = document.createElement("canvas");
          tela.width = l;
          tela.height = a;
          const ctx = tela.getContext("2d");
          ctx.fillStyle = "#111";                    // fundo para PNG transparente
          ctx.fillRect(0, 0, l, a);
          ctx.drawImage(img, 0, 0, l, a);
          tela.toBlob(function (blob) {
            if (blob) ok(blob); else falha(new Error("Falha ao processar a imagem."));
          }, "image/jpeg", QUALIDADE);
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  function ordenar(lista) {
    return lista.sort((a, b) =>
      (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome, "pt-BR")
    );
  }

  /* Reconhece o erro do Postgres quando uma coluna ainda não existe.
     Acontece em banco criado antes de uma atualização do sistema. */
  function colunaAusente(erro) {
    const m = ((erro && (erro.message || erro.hint)) || "") + " " + ((erro && erro.code) || "");
    return /does not exist|42703|schema cache/i.test(m);
  }

  let bancoAntigo = false;

  function traduzirErro(e) {
    const m = (e && e.message) || String(e);
    if (/Invalid login credentials/i.test(m))
      return new Error("E-mail ou senha incorretos. Confira em Authentication > Users se o usuário existe com esse e-mail.");
    if (/Email not confirmed/i.test(m))
      return new Error("Usuário criado, mas o e-mail não foi confirmado. No Supabase, abra Authentication > Users, clique no usuário e use 'Confirm email' — ou recrie marcando 'Auto Confirm User'.");
    if (/signups? not allowed|disabled/i.test(m))
      return new Error("O login por e-mail está desativado no Supabase. Ative em Authentication > Sign In / Providers > Email.");
    if (/rate limit|too many/i.test(m))
      return new Error("Muitas tentativas seguidas. Aguarde um minuto e tente de novo.");
    if (/JWT|not authenticated|401/i.test(m)) return new Error("Sua sessão expirou. Entre novamente.");
    if (/Failed to fetch|NetworkError/i.test(m)) return new Error("Sem conexão com o servidor. Verifique a internet.");
    return new Error(m);
  }

  /* ---------------- Interface pública ---------------- */
  return {
    get modo() { return modo; },
    get bancoDesatualizado() { return bancoAntigo; },
    get exemplos() { return JSON.parse(JSON.stringify(EXEMPLOS)); },

    /* Sem chave configurada, o sistema roda em demonstração de propósito:
       é assim que se avalia a interface antes de contratar o banco.

       COM chave configurada, uma falha NÃO pode virar demonstração. O modo
       demo carrega um cardápio de exemplo com preços fictícios — mostrar
       isso a um cliente que acabou de ler o QR na mesa é pior do que
       mostrar erro: ele pediria pelo preço errado. Então aqui a falha
       sobe, e cada tela decide como avisar. */
    async init() {
      if (!CFG.supabaseUrl || !CHAVE_API) { modo = "demo"; return modo; }
      try {
        if (!window.supabase) await carregarScript(CDN_SUPABASE);
        sb = window.supabase.createClient(CFG.supabaseUrl, CHAVE_API, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
        modo = "supabase";
        return modo;
      } catch (e) {
        console.error("Não foi possível falar com o banco.", e);
        modo = "indisponivel";
        throw new Error(
          "Não foi possível conectar ao servidor. Verifique a internet e tente de novo."
        );
      }
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
    /* Reajuste de preços.

       O cardápio tem dezenas de itens. Salvar um por vez seria uma
       requisição por produto: lento no celular do balcão e, pior,
       sujeito a parar no meio — metade dos preços reajustada e metade
       não, sem ninguém perceber. Aqui vai tudo numa requisição só. */
    async reajustarPrecos(percentual, categoria) {
      const pct = Number(percentual);
      if (!isFinite(pct) || pct <= -100) throw new Error("Percentual inválido.");
      const fator = 1 + pct / 100;
      const lista = await this.listarProdutos(false);
      const alvo = lista.filter((p) => !categoria || p.categoria === categoria);
      if (!alvo.length) return 0;

      alvo.forEach((p) => { p.preco = Math.round(p.preco * fator * 100) / 100; });

      if (modo === "supabase") {
        const { error } = await sb.from("produtos").upsert(
          alvo.map((p) => ({
            id: p.id, nome: p.nome, descricao: p.descricao, categoria: p.categoria,
            preco: p.preco, imagem_url: p.imagem_url, ativo: p.ativo,
            esgotado: p.esgotado, alcoolico: p.alcoolico, ordem: p.ordem,
          }))
        );
        if (error) throw traduzirErro(error);
        return alvo.length;
      }

      const local = lerLocal();
      alvo.forEach((p) => {
        const i = local.findIndex((x) => x.id === p.id);
        if (i !== -1) local[i].preco = p.preco;
      });
      gravarLocal(local);
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
        /* Uma requisição só, pelo mesmo motivo do reajuste: 33 chamadas
           em sequência demoram e podem parar na décima. */
        const linhas = this.exemplos.map((p) => {
          const c = Object.assign({}, p);
          delete c.id;
          return c;
        });
        const { error } = await sb.from("produtos").insert(linhas);
        if (error) throw traduzirErro(error);
        return true;
      }
      gravarLocal(this.exemplos);
      return true;
    },

    /* ------------------------------------------------------------
       FOTOS DOS PRODUTOS
       A foto é reduzida no próprio navegador antes de subir: uma foto
       de celular de 5 MB vira algo em torno de 120 KB, o que economiza
       espaço e faz o cardápio abrir rápido no 4G do cliente.
    ------------------------------------------------------------ */

    async enviarFoto(arquivo, aoProgredir) {
      if (modo !== "supabase") {
        throw new Error("O envio de fotos exige o Supabase configurado. No modo demonstração, use um link de imagem.");
      }
      if (!arquivo) throw new Error("Nenhum arquivo selecionado.");
      if (!/^image\/(jpeg|png|webp)$/i.test(arquivo.type)) {
        throw new Error("Formato não aceito. Envie uma foto JPG, PNG ou WEBP.");
      }
      if (arquivo.size > 15 * 1024 * 1024) {
        throw new Error("Foto muito grande (acima de 15 MB).");
      }

      if (aoProgredir) aoProgredir("Preparando a foto...");
      const reduzida = await reduzirImagem(arquivo);

      if (aoProgredir) aoProgredir("Enviando...");
      const nome = "p-" + Date.now().toString(36) + "-" +
                   Math.random().toString(36).slice(2, 8) + ".jpg";

      const { error } = await sb.storage.from(BALDE_FOTOS).upload(nome, reduzida, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw traduzirErro(error);

      const { data } = sb.storage.from(BALDE_FOTOS).getPublicUrl(nome);
      return data.publicUrl;
    },

    /* Remove do armazenamento uma foto que o painel enviou */
    async apagarFoto(url) {
      if (modo !== "supabase" || !url) return false;
      const marca = "/object/public/" + BALDE_FOTOS + "/";
      const corte = String(url).indexOf(marca);
      if (corte === -1) return false;                  // foto de fora, não é nossa
      const caminho = decodeURIComponent(String(url).slice(corte + marca.length).split("?")[0]);
      const { error } = await sb.storage.from(BALDE_FOTOS).remove([caminho]);
      if (error) console.warn("Não foi possível apagar a foto antiga:", error.message);
      return !error;
    },

    /* ------------------------------------------------------------
       CUSTOS
       Guardados em tabela separada, sem acesso público: a tabela de
       produtos é lida por qualquer visitante do cardápio.
    ------------------------------------------------------------ */

    custoUnitario: custoUnitario,
    margemDe: margemDe,
    markupDe: markupDe,
    precoParaMargem: precoParaMargem,
    precoParaMarkup: precoParaMarkup,

    async listarCustos() {
      if (modo === "supabase") {
        const { data, error } = await sb.from("produto_custos")
          .select("produto_id, custo_compra, rende_unidades, embalagem, fornecedor, atualizado_em, medida_total, medida_porcao, medida_unidade");
        if (error) {
          if (colunaAusente(error) || /produto_custos/i.test(error.message || "")) {
            bancoAntigo = true;
            console.warn("Banco sem a tabela de custos — rode supabase/custos.sql.");
            return {};
          }
          throw traduzirErro(error);
        }
        const mapa = {};
        (data || []).forEach((c) => {
          mapa[c.produto_id] = {
            custo_compra: Number(c.custo_compra) || 0,
            rende_unidades: Number(c.rende_unidades) || 1,
            embalagem: c.embalagem || "",
            fornecedor: c.fornecedor || "",
            atualizado_em: c.atualizado_em,
            medida_total: c.medida_total == null ? null : Number(c.medida_total),
            medida_porcao: c.medida_porcao == null ? null : Number(c.medida_porcao),
            medida_unidade: c.medida_unidade || "",
          };
        });
        return mapa;
      }
      /* Custos são um mapa produto -> custo. Se o armazenamento guardar
         qualquer outra coisa (uma lista, um número, dado corrompido),
         gravar por cima falharia em silêncio: JSON.stringify de uma
         lista descarta propriedades nomeadas, e o custo do produto
         desapareceria sem nenhum erro na tela. */
      try {
        const bruto = JSON.parse(localStorage.getItem(CHAVE_CUSTOS) || "{}");
        const ehMapa = bruto && typeof bruto === "object" && !Array.isArray(bruto);
        if (!ehMapa) {
          console.warn("Custos locais em formato inesperado, recomeçando vazio.");
          return {};
        }
        return bruto;
      } catch (e) { return {}; }
    },

    async salvarCusto(produtoId, custo) {
      const dados = {
        custo_compra: Math.round((Number(custo.custo_compra) || 0) * 100) / 100,
        rende_unidades: Math.round((Number(custo.rende_unidades) || 0) * 1000) / 1000,
        embalagem: String(custo.embalagem || "").trim().slice(0, 40),
        fornecedor: String(custo.fornecedor || "").trim().slice(0, 60),
        medida_total: custo.medida_total == null ? null : Number(custo.medida_total),
        medida_porcao: custo.medida_porcao == null ? null : Number(custo.medida_porcao),
        medida_unidade: String(custo.medida_unidade || ""),
      };
      if (dados.custo_compra < 0) throw new Error("O custo não pode ser negativo.");
      if (dados.rende_unidades <= 0) throw new Error("Informe quantas unidades a compra rende.");

      if (modo === "supabase") {
        const { error } = await sb.from("produto_custos")
          .upsert(Object.assign({ produto_id: produtoId }, dados), { onConflict: "produto_id" });
        if (error) throw traduzirErro(error);
        return true;
      }
      const mapa = await this.listarCustos();
      mapa[produtoId] = Object.assign(dados, { atualizado_em: new Date().toISOString() });
      localStorage.setItem(CHAVE_CUSTOS, JSON.stringify(mapa));
      return true;
    },

    async apagarCusto(produtoId) {
      if (modo === "supabase") {
        const { error } = await sb.from("produto_custos").delete().eq("produto_id", produtoId);
        if (error) throw traduzirErro(error);
        return true;
      }
      const mapa = await this.listarCustos();
      delete mapa[produtoId];
      localStorage.setItem(CHAVE_CUSTOS, JSON.stringify(mapa));
      return true;
    },

    /* ------------------------------------------------------------
       COMANDAS
       Cartões numerados que o cliente leva para a mesa. Enquanto a
       comanda está aberta, os itens ficam em comanda_itens; ao fechar,
       viram uma venda só, preservando a hora de cada lançamento.
    ------------------------------------------------------------ */

    async listarComandas() {
      if (modo === "supabase") {
        const { data, error } = await sb
          .from("comandas")
          .select("id, numero, token, status, aberta_em, comanda_itens(id, nome, categoria, preco_unit, quantidade, criado_em, custo_unit)")
          .order("numero");
        if (error) throw traduzirErro(error);
        return (data || []).map((c) => ({
          id: c.id,
          numero: c.numero,
          token: c.token,
          status: c.status,
          aberta_em: c.aberta_em,
          itens: (c.comanda_itens || [])
            .map((i) => ({
              id: i.id, nome: i.nome, categoria: i.categoria,
              preco_unit: Number(i.preco_unit) || 0,
              quantidade: Number(i.quantidade) || 0,
              criado_em: i.criado_em,
              custo_unit: i.custo_unit == null ? null : Number(i.custo_unit),
            }))
            .sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em)),
        }));
      }
      return lerComandasLocal();
    },

    async abrirComanda(id) {
      const agora = new Date().toISOString();
      if (modo === "supabase") {
        const { error } = await sb.from("comandas")
          .update({ status: "em_uso", aberta_em: agora })
          .eq("id", id).eq("status", "livre");
        if (error) throw traduzirErro(error);
        return true;
      }
      const lista = lerComandasLocal();
      const c = lista.find((x) => x.id === id);
      if (!c) throw new Error("Comanda não encontrada.");
      if (c.status === "em_uso") return true;
      c.status = "em_uso";
      c.aberta_em = agora;
      c.itens = [];
      gravarComandasLocal(lista);
      return true;
    },

    async lancarItem(comandaId, item) {
      const dados = {
        produto_id: item.produto_id && String(item.produto_id).indexOf("ex-") !== 0 &&
                    String(item.produto_id).indexOf("loc-") !== 0 ? item.produto_id : null,
        nome:       String(item.nome || "").trim(),
        categoria:  String(item.categoria || "Outros").trim() || "Outros",
        preco_unit: Math.round((Number(item.preco_unit) || 0) * 100) / 100,
        quantidade: Math.max(1, Math.min(999, parseInt(item.quantidade, 10) || 1)),
        custo_unit: item.custo_unit == null ? null : Math.round(Number(item.custo_unit) * 100) / 100,
      };
      if (!dados.nome) throw new Error("Item inválido.");

      if (modo === "supabase") {
        const { error } = await sb.from("comanda_itens")
          .insert(Object.assign({ comanda_id: comandaId }, dados));
        if (error) throw traduzirErro(error);
        return true;
      }
      const lista = lerComandasLocal();
      const c = lista.find((x) => x.id === comandaId);
      if (!c) throw new Error("Comanda não encontrada.");
      c.itens.push(Object.assign({
        id: "i-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        criado_em: new Date().toISOString(),
      }, dados));
      gravarComandasLocal(lista);
      return true;
    },

    async removerItemComanda(comandaId, itemId) {
      if (modo === "supabase") {
        const { error } = await sb.from("comanda_itens").delete().eq("id", itemId);
        if (error) throw traduzirErro(error);
        return true;
      }
      const lista = lerComandasLocal();
      const c = lista.find((x) => x.id === comandaId);
      if (c) {
        c.itens = c.itens.filter((i) => i.id !== itemId);
        gravarComandasLocal(lista);
      }
      return true;
    },

    /* Fecha a comanda: gera a venda, limpa os itens e libera o cartão */
    async fecharComanda(comandaId, pagamento, observacao) {
      const comandas = await this.listarComandas();
      const c = comandas.find((x) => x.id === comandaId);
      if (!c) throw new Error("Comanda não encontrada.");
      if (!c.itens.length) throw new Error("A comanda está sem itens. Cancele-a em vez de fechar.");

      const venda = await this.registrarVenda({
        pagamento: pagamento,
        observacao: observacao,
        comanda_numero: c.numero,
        aberta_em: c.aberta_em,
        itens: c.itens.map((i) => ({
          nome: i.nome, categoria: i.categoria,
          preco_unit: i.preco_unit, quantidade: i.quantidade,
          criado_em: i.criado_em, custo_unit: i.custo_unit,
        })),
      });

      await this.liberarComanda(comandaId);
      return venda;
    },

    /* Devolve o cartão para o quadro, descartando o que houver em aberto */
    async liberarComanda(comandaId) {
      if (modo === "supabase") {
        const rem = await sb.from("comanda_itens").delete().eq("comanda_id", comandaId);
        if (rem.error) throw traduzirErro(rem.error);
        const { error } = await sb.from("comandas")
          .update({ status: "livre", aberta_em: null }).eq("id", comandaId);
        if (error) throw traduzirErro(error);
        return true;
      }
      const lista = lerComandasLocal();
      const c = lista.find((x) => x.id === comandaId);
      if (c) { c.status = "livre"; c.aberta_em = null; c.itens = []; gravarComandasLocal(lista); }
      return true;
    },

    /* Consulta pública usada pela página do cliente (só leitura) */
    async extratoComanda(token) {
      if (modo === "supabase") {
        const { data, error } = await sb.rpc("extrato_comanda", { p_token: token });
        if (error) throw traduzirErro(error);
        return data;
      }
      const c = lerComandasLocal().find((x) => x.token === token);
      if (!c) return { encontrada: false };
      if (c.status !== "em_uso") return { encontrada: true, aberta: false, numero: c.numero };
      const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return {
        encontrada: true, aberta: true, numero: c.numero,
        aberta_em: c.aberta_em ? hora(c.aberta_em) : "",
        itens: c.itens.map((i) => ({
          nome: i.nome, quantidade: i.quantidade, preco_unit: i.preco_unit,
          subtotal: Math.round(i.preco_unit * i.quantidade * 100) / 100,
          hora: hora(i.criado_em),
        })),
        total: Math.round(c.itens.reduce((s, i) => s + i.preco_unit * i.quantidade, 0) * 100) / 100,
      };
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
        criado_em:  i.criado_em || new Date().toISOString(),
        custo_unit: i.custo_unit == null ? null : Math.round(Number(i.custo_unit) * 100) / 100,
      })).filter((i) => i.nome);

      if (!itens.length) throw new Error("Adicione ao menos um item à venda.");

      const total = Math.round(itens.reduce((s, i) => s + i.preco_unit * i.quantidade, 0) * 100) / 100;

      if (modo === "supabase") {
        let { data, error } = await sb.from("vendas")
          .insert({
            total: total, pagamento: pagamento, observacao: observacao,
            comanda_numero: venda.comanda_numero || null,
            aberta_em: venda.aberta_em || null,
          })
          .select().single();

        if (error && colunaAusente(error)) {
          bancoAntigo = true;
          ({ data, error } = await sb.from("vendas")
            .insert({ total: total, pagamento: pagamento, observacao: observacao })
            .select().single());
        }
        if (error) throw traduzirErro(error);

        const linhas = itens.map((i) => Object.assign({ venda_id: data.id }, i));
        let res = await sb.from("venda_itens").insert(linhas);

        if (res.error && colunaAusente(res.error)) {
          bancoAntigo = true;
          const simples = itens.map((i) => ({
            venda_id: data.id, produto_id: i.produto_id, nome: i.nome,
            categoria: i.categoria, preco_unit: i.preco_unit, quantidade: i.quantidade,
          }));
          res = await sb.from("venda_itens").insert(simples);
        }
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
        comanda_numero: venda.comanda_numero || null,
        aberta_em: venda.aberta_em || null,
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
        /* Bancos criados antes da atualização de comandas não têm as colunas
           novas. Em vez de quebrar, o sistema tenta a consulta completa e
           cai para a reduzida se o banco ainda for antigo. */
        const consulta = (campos) => sb.from("vendas")
          .select(campos)
          .gte("criado_em", inicio.toISOString())
          .lte("criado_em", fim.toISOString())
          .order("criado_em", { ascending: false });

        let { data, error } = await consulta(
          "id, criado_em, total, pagamento, observacao, comanda_numero, aberta_em, " +
          "venda_itens(nome, categoria, preco_unit, quantidade, criado_em, custo_unit)"
        );

        if (error && colunaAusente(error)) {
          bancoAntigo = true;
          console.warn("Banco sem as colunas de comanda — rode supabase/comandas.sql.");
          ({ data, error } = await consulta(
            "id, criado_em, total, pagamento, observacao, " +
            "venda_itens(nome, categoria, preco_unit, quantidade)"
          ));
        }
        if (error) throw traduzirErro(error);
        return (data || []).map((v) => ({
          id: v.id, criado_em: v.criado_em, total: Number(v.total) || 0,
          pagamento: v.pagamento, observacao: v.observacao || "",
          comanda_numero: v.comanda_numero || null,
          aberta_em: v.aberta_em || null,
          itens: (v.venda_itens || []).map((i) => ({
            nome: i.nome, categoria: i.categoria,
            preco_unit: Number(i.preco_unit) || 0,
            quantidade: Number(i.quantidade) || 0,
            criado_em: i.criado_em || v.criado_em,
            custo_unit: i.custo_unit == null ? null : Number(i.custo_unit),
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
      const usuario = String(email || "").trim();
      if (!usuario) throw new Error("Informe o e-mail cadastrado.");
      if (usuario.indexOf("@") === -1) throw new Error("E-mail inválido — confira se digitou o endereço completo.");
      if (!senha) throw new Error("Informe a senha.");

      if (modo === "supabase") {
        const { data, error } = await sb.auth.signInWithPassword({
          email: usuario, password: senha,
        });
        if (error) throw traduzirErro(error);
        return data.user;
      }
      if (usuario.toLowerCase() === "admin@demo" && senha === "frontbeer") {
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
