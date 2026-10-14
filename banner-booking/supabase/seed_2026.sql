-- =====================================================================
-- Data awal: placement + kalender 2026 (libur nasional & event PPGOS)
-- Jalankan setelah schema.sql. Aman dijalankan ulang.
--
-- Libur nasional 2026 diambil dari tanggal merah di Kalender PPGOS 2026.
-- Cuti bersama BELUM dimasukkan — tambahkan lewat menu Admin sesuai SKB.
-- =====================================================================

insert into public.placements (id, name, description, capacity_per_day, max_mb, color, sort)
values
  (1, 'Pop Up Banner', 'Tampil saat aplikasi dibuka. Hanya 1 principal per hari.', 1, 5, '#e8590c', 1),
  (2, 'Banner',        'Banner slider. Bisa beberapa principal per hari.',          5, 5, '#0b76d1', 2)
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.placements','id'),
              greatest((select max(id) from public.placements), 1));

insert into public.calendar_years (year) values (2026) on conflict do nothing;

delete from public.calendar_events where year = 2026;

insert into public.calendar_events (year, start_date, end_date, title, kind) values
  (2026, '2026-01-01', '2026-01-01', 'Tahun Baru Masehi',            'holiday'),
  (2026, '2026-01-16', '2026-01-16', 'Isra Mikraj',                  'holiday'),
  (2026, '2026-02-17', '2026-02-17', 'Tahun Baru Imlek',             'holiday'),
  (2026, '2026-03-19', '2026-03-19', 'Hari Suci Nyepi',              'holiday'),
  (2026, '2026-03-21', '2026-03-22', 'Idul Fitri 1447 H',            'holiday'),
  (2026, '2026-04-03', '2026-04-03', 'Wafat Yesus Kristus',          'holiday'),
  (2026, '2026-04-05', '2026-04-05', 'Paskah',                       'holiday'),
  (2026, '2026-05-01', '2026-05-01', 'Hari Buruh',                   'holiday'),
  (2026, '2026-05-14', '2026-05-14', 'Kenaikan Yesus Kristus',       'holiday'),
  (2026, '2026-05-27', '2026-05-27', 'Idul Adha 1447 H',             'holiday'),
  (2026, '2026-05-31', '2026-05-31', 'Waisak',                       'holiday'),
  (2026, '2026-06-01', '2026-06-01', 'Hari Lahir Pancasila',         'holiday'),
  (2026, '2026-06-16', '2026-06-16', 'Tahun Baru Islam 1448 H',      'holiday'),
  (2026, '2026-08-17', '2026-08-17', 'Hari Kemerdekaan RI',          'holiday'),
  (2026, '2026-08-25', '2026-08-25', 'Maulid Nabi Muhammad SAW',     'holiday'),
  (2026, '2026-12-25', '2026-12-25', 'Hari Raya Natal',              'holiday'),

  (2026, '2026-01-14', '2026-01-14', 'Flash Sale',            'ppgos'),
  (2026, '2026-01-21', '2026-01-23', 'Hot Sale',              'ppgos'),
  (2026, '2026-02-11', '2026-02-11', 'Flash Sale',            'ppgos'),
  (2026, '2026-02-18', '2026-02-20', 'Special Imlek',         'ppgos'),
  (2026, '2026-02-25', '2026-02-27', 'Hot Sale',              'ppgos'),
  (2026, '2026-03-11', '2026-03-11', 'Flash Sale',            'ppgos'),
  (2026, '2026-03-16', '2026-03-20', 'Idul Fitri',            'ppgos'),
  (2026, '2026-03-26', '2026-03-26', 'Flash Sale',            'ppgos'),
  (2026, '2026-04-08', '2026-04-08', 'Flash Sale',            'ppgos'),
  (2026, '2026-04-15', '2026-04-17', 'PPGOS Community Day',   'ppgos'),
  (2026, '2026-04-22', '2026-04-22', 'Flash Sale',            'ppgos'),
  (2026, '2026-04-28', '2026-04-30', 'Hot Sale',              'ppgos'),
  (2026, '2026-05-06', '2026-05-06', 'Flash Sale',            'ppgos'),
  (2026, '2026-05-18', '2026-05-22', 'HUT PPGOS',             'ppgos'),
  (2026, '2026-05-29', '2026-05-29', 'Flash Sale',            'ppgos'),
  (2026, '2026-06-10', '2026-06-12', 'PPGOS Community Day',   'ppgos'),
  (2026, '2026-06-17', '2026-06-19', 'Hot Sale',              'ppgos'),
  (2026, '2026-06-24', '2026-06-24', 'Flash Sale',            'ppgos'),
  (2026, '2026-07-08', '2026-07-08', 'Flash Sale',            'ppgos'),
  (2026, '2026-07-15', '2026-07-17', 'Hot Sale',              'ppgos'),
  (2026, '2026-07-22', '2026-07-24', 'Hari Anak Nasional',    'ppgos'),
  (2026, '2026-08-06', '2026-08-08', 'Super Sale 8.8',        'ppgos'),
  (2026, '2026-08-14', '2026-08-18', 'Hari Kemerdekaan',      'ppgos'),
  (2026, '2026-08-20', '2026-08-24', 'PPGOS Community Day',   'ppgos'),
  (2026, '2026-08-27', '2026-08-27', 'Flash Sale',            'ppgos'),
  (2026, '2026-09-04', '2026-09-07', 'Hari Pelanggan',        'ppgos'),
  (2026, '2026-09-08', '2026-09-10', 'Super Sale 9.9',        'ppgos'),
  (2026, '2026-09-15', '2026-09-19', 'PPGOS Community Day',   'ppgos'),
  (2026, '2026-09-23', '2026-09-25', 'Hot Sale',              'ppgos'),
  (2026, '2026-10-09', '2026-10-12', 'Super Sale 10.10',      'ppgos'),
  (2026, '2026-10-21', '2026-10-21', 'Flash Sale',            'ppgos'),
  (2026, '2026-10-28', '2026-10-30', 'Hot Sale',              'ppgos'),
  (2026, '2026-11-04', '2026-11-06', 'Hot Sale',              'ppgos'),
  (2026, '2026-11-10', '2026-11-12', 'Super Sale 11.11',      'ppgos'),
  (2026, '2026-11-17', '2026-11-22', 'PPGOS Community Day',   'ppgos'),
  (2026, '2026-11-25', '2026-11-25', 'Flash Sale',            'ppgos'),
  (2026, '2026-12-02', '2026-12-04', 'Deal-Cember',           'ppgos'),
  (2026, '2026-12-11', '2026-12-14', 'Super Sale 12.12',      'ppgos'),
  (2026, '2026-12-21', '2026-12-25', 'Nataru',                'ppgos');
