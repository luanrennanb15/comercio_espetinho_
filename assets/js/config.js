/* =====================================================================
   FRONT BEER — Configuração
   Único arquivo que precisa ser editado para personalizar o site.
   ===================================================================== */

window.APP_CONFIG = {
  /* --- Identidade --- */
  nome:        "Front Beer",
  nomeDestaque:"Beer",                       // parte do nome exibida em dourado
  segmento:    "Adega e Petiscaria",
  lema:        "Bons amigos, boas cervejas, bons momentos.",

  /* --- Contato e localização (deixe "" para ocultar) --- */
  endereco:    "Antônio Silva Saladino, 875",
  horario:     "Todos os dias, 16h às 2h",
  telefone:    "(15) 98142-7143",
  whatsapp:    "5515981427143",               // só dígitos, com 55 na frente
  instagram:   "frontbeer_adega",             // sem o @
  mapaUrl:     "",                            // link do Google Maps

  /* --- Regras de operação --- */
  avisoOperacao: "Consumo e retirada no local. Não realizamos entregas.",
  idadeMinima:   18,

  /* --- Endereço público do cardápio (usado no QR Code e na prévia do link) --- */
  siteUrl: "",

  /* --- Assinatura discreta no rodapé (opcional) --- */
  credito:    "",
  creditoUrl: "",

  /* --- Supabase ---------------------------------------------------
     Vazio = MODO DEMONSTRAÇÃO (dados só neste navegador).
     Preenchido = dados na nuvem, com login e regras de segurança.
     Pegue em: Supabase > Project Settings > API.
     A "anon key" é pública por design; quem protege os dados são as
     políticas RLS de supabase/schema.sql. Nunca use a service_role.
  ------------------------------------------------------------------ */
  supabaseUrl:     "",
  supabaseAnonKey: "",
};
