/* =====================================================================
   CONFIGURAÇÃO DO ESTABELECIMENTO
   Edite este arquivo para personalizar o cardápio.
   ===================================================================== */

window.APP_CONFIG = {
  // --- Identidade ---
  nome: "Front Beer",
  slogan: "Adega e Petiscaria",
  // Telefone só para contato/dúvidas (não há pedido nem entrega online).
  // Deixe "" para ocultar o link.
  whatsapp: "",
  endereco: "",
  horario: "",

  // Mensagem fixa no rodapé do cardápio
  aviso: "Consumo e retirada no local. Não realizamos entregas.",

  // --- Supabase (deixe vazio para rodar em MODO DEMONSTRAÇÃO no navegador) ---
  // Pegue em: Supabase > Project Settings > API
  // A "anon key" é pública POR DESIGN. A proteção real vem das políticas RLS
  // definidas em supabase/schema.sql. Nunca coloque a service_role key aqui.
  supabaseUrl: "",
  supabaseAnonKey: "",
};
