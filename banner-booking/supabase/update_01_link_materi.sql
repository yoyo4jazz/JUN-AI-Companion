-- =====================================================================
-- Update 01: materi bisa berupa LINK (Google Drive, Dropbox, WeTransfer, dll.)
-- Jalankan SEKALI di Supabase SQL Editor bila schema.sql sudah pernah
-- dijalankan sebelum update ini. Aman dijalankan ulang.
-- =====================================================================
alter table public.materials add column if not exists url text;
alter table public.materials alter column storage_path drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'materials_url_http') then
    alter table public.materials add constraint materials_url_http check (url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'materials_has_target') then
    alter table public.materials add constraint materials_has_target
      check (storage_path is not null or url is not null);
  end if;
end $$;

create or replace function public.guard_material()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.uploaded_by := auth.uid();
      new.status := 'submitted';
      if new.storage_path is not null
         and public.path_booking(new.storage_path) is distinct from new.booking_id then
        raise exception 'Path file tidak sesuai booking.';
      end if;
    elsif not public.is_staff() then
      raise exception 'Hanya tim internal yang bisa mereview materi.';
    else
      new.booking_id   := old.booking_id;
      new.storage_path := old.storage_path;
      new.url          := old.url;
      new.uploaded_by  := old.uploaded_by;
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
