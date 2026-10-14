// Isi dengan data dari Supabase: Project Settings → API.
// "anon public key" memang aman ditaruh di sini — keamanan data dijaga oleh
// Row Level Security di database (lihat supabase/schema.sql).
// JANGAN pernah menaruh "service_role key" di file ini.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://wzxmlissmywpgeyhzlsw.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Fvudle6hAlOY5X9MdChCkw_b4wHNSAo',
  APP_NAME: 'PPGOS Banner Booking',
  // Nomor WhatsApp tim PPGOS (format 628xxx). Principal yang klik tombol
  // WhatsApp di detail booking akan langsung chat ke nomor ini.
  // Kosongkan = pilih kontak/grup sendiri saat membuka WhatsApp.
  WA_TEAM_NUMBER: '',
};
