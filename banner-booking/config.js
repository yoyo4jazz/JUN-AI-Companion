// Isi dengan data dari Supabase: Project Settings → API.
// "anon public key" memang aman ditaruh di sini — keamanan data dijaga oleh
// Row Level Security di database (lihat supabase/schema.sql).
// JANGAN pernah menaruh "service_role key" di file ini.
window.APP_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  APP_NAME: 'PPGOS Banner Booking',
};
