// config.js — configuração compartilhada (index.html e admin.html)
// A chave "publishable" é segura para ficar aqui: o que ela pode ou não
// fazer é controlado pelas políticas de RLS do banco.
// Pegue a SUA em: Supabase > Project Settings > API Keys > Publishable key.
const SUPABASE_URL = "https://mjvcapqwqieihttiwugm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zDMh4jnJhDlehpg6HiRpUQ_FiN57uM4";

// Número da loja para o botão opcional "enviar resumo pelo WhatsApp"
const NUMERO_LOJA_WHATSAPP = "5561900000000";

// Botão extra após confirmar a compra: o cliente envia o resumo para o
// WhatsApp da loja. Deixe false até colocar o número real acima.
const MOSTRAR_BOTAO_WHATSAPP_LOJA = false;

// Endereço do BACK-END (quem faz o cálculo e registra o histórico).
// Sem barra no final. Ex.: "https://cimdp-backend.onrender.com"
// Em teste local: "http://localhost:3000"
   const API_URL = "https://cimdp-api.onrender.com";