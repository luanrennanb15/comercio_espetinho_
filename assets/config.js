/* =====================================================================
   CONFIGURAÇÃO DO ESTABELECIMENTO
   Edite este arquivo para personalizar o cardápio.
   ===================================================================== */

window.APP_CONFIG = {
  // --- Identidade ---
  nome: "Espetinho do Luan",
  slogan: "Na brasa, do jeito que você gosta",
  // Telefone só para contato/dúvidas (não há pedido online). Deixe "" para ocultar.
  whatsapp: "5511999999999",
  endereco: "Rua das Brasas, 123 - Centro",
  horario: "Ter a Dom, 18h às 23h",

  // --- Supabase (deixe vazio para rodar em MODO DEMONSTRAÇÃO no navegador) ---
  // Pegue em: Supabase > Project Settings > API
  // A "anon key" é pública POR DESIGN. A proteção real vem das políticas RLS
  // definidas em supabase/schema.sql. Nunca coloque a service_role key aqui.
  supabaseUrl: "",
  supabaseAnonKey: "",
};
