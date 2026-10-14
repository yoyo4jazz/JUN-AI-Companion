-- =====================================================================
-- PPGOS Banner Booking — skema database Supabase
-- Jalankan SEKALI di Supabase: SQL Editor → New query → paste → Run.
-- Aman dijalankan ulang untuk bagian fungsi/policy (create or replace /
-- drop if exists), tapi tabel tidak akan dibuat ulang bila sudah ada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profil pengguna & peran
--    pending   : baru daftar, belum disetujui admin (tidak bisa booking)
--    principal : bisa booking & upload materi untuk booking miliknya
--    internal  : tim internal, lihat semua booking & ubah status
--    admin     : semua akses + kelola tahun, event, placement, pengguna
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  company    text,
  role       text not null default 'pending'
             check (role in ('pending','principal','internal','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, company)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'company')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.my_role() in ('internal','admin');
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.my_role() = 'admin';
$$;

-- Pengguna biasa hanya boleh mengubah nama & perusahaan miliknya.
-- auth.uid() kosong = dijalankan dari SQL Editor (pemilik project), dibiarkan.
create or replace function public.guard_profile()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role  := old.role;
    new.email := old.email;
  end if;
  new.id := old.id;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------------------------------------------------------------------
-- 2. Placement (jenis slot tayang)
--    capacity_per_day = berapa principal boleh tayang di hari yang sama
-- ---------------------------------------------------------------------
create table if not exists public.placements (
  id               serial primary key,
  name             text not null,
  description      text,
  capacity_per_day int  not null default 1 check (capacity_per_day >= 1),
  spec_width       int,
  spec_height      int,
  max_mb           numeric not null default 5 check (max_mb > 0 and max_mb <= 50),
  formats          text not null default 'jpg,jpeg,png,webp,gif',
  color            text not null default '#0b76d1',
  active           boolean not null default true,
  sort             int not null default 0
);

-- ---------------------------------------------------------------------
-- 3. Tahun kalender & event (libur nasional, cuti bersama, event PPGOS)
--    Booking hanya bisa dibuat untuk tahun yang sudah dibuka admin.
-- ---------------------------------------------------------------------
create table if not exists public.calendar_years (
  year       int primary key check (year between 2020 and 2100),
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id         bigserial primary key,
  year       int  not null references public.calendar_years(year) on delete cascade,
  start_date date not null,
  end_date   date not null,
  title      text not null,
  kind       text not null check (kind in ('holiday','cuti','ppgos')),
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (extract(year from start_date)::int = year)
);
create index if not exists calendar_events_range on public.calendar_events (start_date, end_date);

-- ---------------------------------------------------------------------
-- 4. Booking
--    Status aktif (mengunci slot): pending, approved, live
--    Status selesai/tidak aktif  : done, rejected, cancelled
--    'done' tidak dihitung karena tanggalnya pasti sudah lewat.
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  placement_id int  not null references public.placements(id),
  principal_id uuid not null,
  created_by   uuid,
  campaign     text not null check (length(trim(campaign)) > 0),
  notes        text,
  start_date   date not null,
  end_date     date not null,
  status       text not null default 'pending'
               check (status in ('pending','approved','live','done','rejected','cancelled')),
  review_note  text,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint bookings_principal_fk foreign key (principal_id) references public.profiles(id),
  constraint bookings_creator_fk   foreign key (created_by)   references public.profiles(id),
  constraint bookings_reviewer_fk  foreign key (reviewed_by)  references public.profiles(id),
  check (end_date >= start_date),
  check (end_date - start_date <= 92)
);
create index if not exists bookings_range on public.bookings (placement_id, start_date, end_date);
create index if not exists bookings_principal on public.bookings (principal_id);

create or replace function public.jakarta_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- Semua aturan bisnis booking ada di sini supaya tidak bisa dilewati dari
-- browser: tanggal lewat, tahun belum dibuka, kapasitas penuh, hak peran.
create or replace function public.guard_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  r     text := public.my_role();
  today date := public.jakarta_today();
  cap   int;
  act   boolean;
  d     date;
  used  int;
  dup   int;
  pname text;
  slot_changed boolean;
begin
  if uid is not null then
    if tg_op = 'INSERT' then
      if r not in ('principal','internal','admin') then
        raise exception 'Akun Anda belum disetujui admin untuk melakukan booking.';
      end if;
      new.created_by := uid;
      new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
      if r = 'principal' then
        new.principal_id := uid;
        new.status := 'pending';
      elsif new.status not in ('pending','approved') then
        new.status := 'pending';
      end if;
      if (select role from profiles where id = new.principal_id) is distinct from 'principal' then
        raise exception 'Booking harus atas nama akun principal.';
      end if;
      if new.start_date < today then
        raise exception 'Tanggal % sudah lewat dan tidak bisa dibooking.', to_char(new.start_date,'DD-MM-YYYY');
      end if;
    else
      if r = 'principal' then
        if old.principal_id <> uid then
          raise exception 'Booking ini bukan milik Anda.';
        end if;
        if new.status <> old.status
           and not (new.status = 'cancelled' and old.status in ('pending','approved')) then
          raise exception 'Principal hanya bisa membatalkan booking yang belum tayang.';
        end if;
        new.placement_id := old.placement_id;
        new.start_date   := old.start_date;
        new.end_date     := old.end_date;
        new.principal_id := old.principal_id;
        new.review_note  := old.review_note;
        new.reviewed_by  := old.reviewed_by;
        new.reviewed_at  := old.reviewed_at;
      elsif r in ('internal','admin') then
        if new.status <> old.status and new.status in ('approved','rejected') then
          new.reviewed_by := uid;
          new.reviewed_at := now();
        end if;
        if (new.start_date <> old.start_date or new.end_date <> old.end_date)
           and new.start_date < today and new.start_date <> old.start_date then
          raise exception 'Tanggal mulai baru sudah lewat.';
        end if;
      else
        raise exception 'Akses ditolak.';
      end if;
      new.created_by := old.created_by;
      new.created_at := old.created_at;
    end if;
  end if;

  new.updated_at := now();

  slot_changed := tg_op = 'INSERT'
               or new.placement_id <> old.placement_id
               or new.start_date   <> old.start_date
               or new.end_date     <> old.end_date
               or new.principal_id <> old.principal_id
               or old.status not in ('pending','approved','live');

  if new.status in ('pending','approved','live') and slot_changed then
    if not exists (select 1 from calendar_years where year = extract(year from new.start_date)::int)
       or not exists (select 1 from calendar_years where year = extract(year from new.end_date)::int) then
      raise exception 'Kalender tahun tersebut belum dibuka oleh admin.';
    end if;

    -- Kunci per placement: dua booking bersamaan untuk slot yang sama
    -- diproses bergantian, sehingga pop up tidak mungkin dobel.
    perform pg_advisory_xact_lock(4242, new.placement_id);

    select capacity_per_day, active, name into cap, act, pname
      from placements where id = new.placement_id;
    if not act then
      raise exception 'Placement % sedang tidak aktif.', pname;
    end if;

    for d in select generate_series(new.start_date, new.end_date, interval '1 day')::date loop
      select count(*),
             count(*) filter (where b.principal_id = new.principal_id)
        into used, dup
        from bookings b
       where b.placement_id = new.placement_id
         and b.status in ('pending','approved','live')
         and b.id <> new.id
         and d between b.start_date and b.end_date;
      if dup > 0 then
        raise exception 'Principal ini sudah punya booking % pada %.', pname, to_char(d,'DD-MM-YYYY');
      end if;
      if used >= cap then
        raise exception 'Slot % pada % sudah penuh.', pname, to_char(d,'DD-MM-YYYY');
      end if;
    end loop;
  end if;

  return new;
end $$;

drop trigger if exists bookings_guard on public.bookings;
create trigger bookings_guard before insert or update on public.bookings
  for each row execute function public.guard_booking();

-- Ketersediaan per hari untuk satu placement. Boleh dipanggil tanpa login:
-- hanya mengembalikan jumlah terisi, tanpa nama principal.
create or replace function public.get_availability(p_placement int, p_from date, p_to date)
returns table (day date, used int, capacity int)
language sql stable security definer set search_path = public as $$
  select d::date,
         (select count(*)::int from bookings b
           where b.placement_id = p.id
             and b.status in ('pending','approved','live')
             and d::date between b.start_date and b.end_date),
         p.capacity_per_day
    from placements p
    cross join generate_series(p_from, p_to, interval '1 day') d
   where p.id = p_placement
     and p_to >= p_from
     and p_to - p_from <= 400
   order by 1;
$$;

-- ---------------------------------------------------------------------
-- 5. Materi digital (file disimpan di Storage bucket "materials",
--    path: <booking_id>/<nama file>)
-- ---------------------------------------------------------------------
create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null,
  mime         text,
  size_bytes   bigint,
  width        int,
  height       int,
  note         text,
  status       text not null default 'submitted'
               check (status in ('submitted','approved','revision')),
  uploaded_by  uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint materials_uploader_fk foreign key (uploaded_by) references public.profiles(id)
);
create index if not exists materials_booking on public.materials (booking_id);

create or replace function public.can_see_booking(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
     where b.id = bid
       and (b.principal_id = auth.uid() or public.is_staff())
  );
$$;

create or replace function public.path_booking(path text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create or replace function public.guard_material()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.uploaded_by := auth.uid();
      new.status := 'submitted';
      if public.path_booking(new.storage_path) is distinct from new.booking_id then
        raise exception 'Path file tidak sesuai booking.';
      end if;
    elsif not public.is_staff() then
      raise exception 'Hanya tim internal yang bisa mereview materi.';
    else
      new.booking_id   := old.booking_id;
      new.storage_path := old.storage_path;
      new.uploaded_by  := old.uploaded_by;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists materials_guard on public.materials;
create trigger materials_guard before insert or update on public.materials
  for each row execute function public.guard_material();

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.placements      enable row level security;
alter table public.calendar_years  enable row level security;
alter table public.calendar_events enable row level security;
alter table public.bookings        enable row level security;
alter table public.materials       enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists placements_read on public.placements;
create policy placements_read on public.placements for select to anon, authenticated using (true);
drop policy if exists placements_admin on public.placements;
create policy placements_admin on public.placements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists years_read on public.calendar_years;
create policy years_read on public.calendar_years for select to anon, authenticated using (true);
drop policy if exists years_admin on public.calendar_years;
create policy years_admin on public.calendar_years for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists events_read on public.calendar_events;
create policy events_read on public.calendar_events for select to anon, authenticated using (true);
drop policy if exists events_admin on public.calendar_events;
create policy events_admin on public.calendar_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings for select to authenticated
  using (principal_id = auth.uid() or public.is_staff());
drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings for insert to authenticated
  with check (public.my_role() in ('principal','internal','admin'));
drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings for update to authenticated
  using (principal_id = auth.uid() or public.is_staff());
drop policy if exists bookings_delete on public.bookings;
create policy bookings_delete on public.bookings for delete to authenticated
  using (public.is_admin());

drop policy if exists materials_select on public.materials;
create policy materials_select on public.materials for select to authenticated
  using (public.can_see_booking(booking_id));
drop policy if exists materials_insert on public.materials;
create policy materials_insert on public.materials for insert to authenticated
  with check (public.can_see_booking(booking_id)
              and public.my_role() in ('principal','internal','admin'));
drop policy if exists materials_update on public.materials;
create policy materials_update on public.materials for update to authenticated
  using (public.is_staff());
drop policy if exists materials_delete on public.materials;
create policy materials_delete on public.materials for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

grant select on public.placements, public.calendar_years, public.calendar_events to anon;
grant select, insert, update, delete on
  public.profiles, public.placements, public.calendar_years, public.calendar_events,
  public.bookings, public.materials to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.get_availability(int, date, date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Storage bucket materi (privat, maks 50 MB per file = batas paket free)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800)
on conflict (id) do nothing;

drop policy if exists materials_files_read on storage.objects;
create policy materials_files_read on storage.objects for select to authenticated
  using (bucket_id = 'materials' and public.can_see_booking(public.path_booking(name)));

drop policy if exists materials_files_insert on storage.objects;
create policy materials_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'materials'
              and public.can_see_booking(public.path_booking(name))
              and public.my_role() in ('principal','internal','admin'));

drop policy if exists materials_files_delete on storage.objects;
create policy materials_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials'
         and public.can_see_booking(public.path_booking(name))
         and (public.is_admin()
              or exists (select 1 from public.materials m
                          where m.storage_path = name and m.uploaded_by = auth.uid())));
