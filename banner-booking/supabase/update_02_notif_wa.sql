-- =====================================================================
-- Update 02 (OPSIONAL): notifikasi WhatsApp OTOMATIS ke admin/tim PPGOS
-- lewat CallMeBot (gratis, untuk notifikasi ke nomor sendiri).
--
-- Dikirim saat:
--   • ada booking baru
--   • ada akun baru mendaftar (menunggu persetujuan)
--
-- Cara aktivasi (sekali per nomor HP penerima):
--   1. Buka https://www.callmebot.com/blog/free-api-whatsapp-messages/ dan
--      simpan nomor WhatsApp CallMeBot yang tertera di sana ke kontak HP.
--   2. Dari WhatsApp HP penerima, kirim pesan yang diminta di halaman itu
--      (biasanya: I allow callmebot to send me messages).
--   3. Balasan berisi "apikey" (angka). Catat.
--   4. Jalankan file ini di Supabase SQL Editor, lalu daftarkan penerima:
--        insert into public.notify_recipients (name, phone, apikey)
--        values ('Admin PPGOS', '+6281234567890', '123456');
--      (bisa beberapa baris untuk beberapa admin; masing-masing aktivasi sendiri)
--
-- Nomor & apikey disimpan di tabel yang TIDAK bisa dibaca dari web.
-- Kalau CallMeBot sedang gangguan, booking tetap berhasil (notif saja yang gagal).
-- =====================================================================

create extension if not exists pg_net;

create table if not exists public.notify_recipients (
  id         bigserial primary key,
  name       text,
  phone      text not null,
  apikey     text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.notify_recipients enable row level security;   -- tanpa policy = tertutup untuk web
revoke all on public.notify_recipients from anon, authenticated;

create table if not exists public.notify_settings (
  id      int primary key default 1 check (id = 1),
  app_url text not null default 'https://yoyo4jazz.github.io/JUN-AI-Companion/banner-booking/'
);
alter table public.notify_settings enable row level security;
revoke all on public.notify_settings from anon, authenticated;
insert into public.notify_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.send_wa_notification(msg text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select phone, apikey from notify_recipients where active loop
    begin
      perform net.http_get(
        url    := 'https://api.callmebot.com/whatsapp.php',
        params := jsonb_build_object('phone', r.phone, 'text', msg, 'apikey', r.apikey)
      );
    exception when others then
      raise warning 'Notifikasi WA gagal: %', sqlerrm;
    end;
  end loop;
end $$;
revoke all on function public.send_wa_notification(text) from public, anon, authenticated;

create or replace function public.notify_new_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text; prin text; url text;
begin
  select name into pname from placements where id = new.placement_id;
  select coalesce(nullif(company, ''), '-') || ' (' || coalesce(nullif(full_name, ''), email, '') || ')'
    into prin from profiles where id = new.principal_id;
  select app_url into url from notify_settings where id = 1;
  perform send_wa_notification(format(
    E'🔔 *Booking baru — %s*\nCampaign: %s\nPrincipal: %s\nTanggal: %s s/d %s\nStatus: %s\n\nReview: %s#booking/%s',
    pname, new.campaign, prin,
    to_char(new.start_date, 'DD-MM-YYYY'), to_char(new.end_date, 'DD-MM-YYYY'),
    case new.status when 'approved' then 'Disetujui' else 'Diajukan' end,
    coalesce(url, ''), new.id));
  return null;
exception when others then
  raise warning 'notify_new_booking: %', sqlerrm;
  return null;
end $$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify after insert on public.bookings
  for each row execute function public.notify_new_booking();

create or replace function public.notify_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare url text;
begin
  select app_url into url from notify_settings where id = 1;
  perform send_wa_notification(format(
    E'👤 *Akun baru menunggu persetujuan*\nNama: %s\nPerusahaan: %s\nEmail: %s\n\nSetujui di menu Admin → Pengguna: %s#admin',
    coalesce(new.full_name, '-'), coalesce(new.company, '-'), coalesce(new.email, '-'), coalesce(url, '')));
  return null;
exception when others then
  raise warning 'notify_new_user: %', sqlerrm;
  return null;
end $$;

drop trigger if exists profiles_notify on public.profiles;
create trigger profiles_notify after insert on public.profiles
  for each row execute function public.notify_new_user();
