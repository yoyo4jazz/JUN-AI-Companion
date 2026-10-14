# PPGOS Banner Booking

Kalender jadwal & booking **Pop Up Banner** dan **Banner** untuk principal dan tim internal,
lengkap dengan upload materi digital. Web statis (GitHub Pages) + database Supabase paket gratis.

## Fitur

- **Kalender bulanan & tahunan** per placement. Tanggal yang sudah lewat dan slot yang penuh berwarna abu-abu dan tidak bisa diklik. Yang aktif hanya hari ini dan ke depan.
- **Pop Up Banner**: 1 principal per hari. **Banner**: beberapa principal per hari (kapasitas diatur admin).
- Libur nasional (merah) dan event PPGOS tampil di setiap tanggal.
- **Booking**: klik tanggal mulai, lalu tanggal selesai, lalu *Lanjut Booking*. Slot langsung terkunci dengan status *Diajukan*.
- Status booking: Diajukan → Disetujui → Tayang → Selesai (atau Ditolak / Dibatalkan).
- **Materi digital**: upload gambar/video per booking (dengan cek format, ukuran file, dan dimensi), **atau tempel link** Google Drive/Dropbox/WeTransfer. Tim internal bisa memberi status *Materi OK* atau *Perlu revisi*.
- **Tombol WhatsApp** di detail booking membuka WhatsApp dengan pesan ringkasan booking dan link langsung ke detailnya. Fitur ini gratis karena hanya click-to-chat, tanpa API. Isi `WA_TEAM_NUMBER` di `config.js` supaya principal langsung chat ke nomor tim PPGOS.
- **Setelah booking**, principal langsung melihat tombol hijau **"Kabari Tim PPGOS via WhatsApp"**. Admin dan tim internal melihat jumlah booking yang menunggu persetujuan di menu *Semua Booking*.
- **(Opsional) Notifikasi WA otomatis** ke HP admin setiap ada booking baru atau akun baru, lewat CallMeBot (gratis). Lihat `supabase/update_02_notif_wa.sql`.
- **Peran pengguna**:
  - Pengunjung tanpa login hanya melihat ketersediaan slot, tanpa nama principal.
  - Principal hanya melihat booking dan materi miliknya sendiri.
  - Tim internal melihat semua booking dan bisa mengubah status.
  - Admin bisa mengelola tahun, event, placement, dan pengguna.
- **Admin → Tahun & Event**: tombol *Buat tahun* membuka kalender tahun baru dan otomatis mengambil libur nasional Indonesia. Event PPGOS bisa ditambah satu per satu atau di-import banyak sekaligus (copy-paste).

Semua aturan (slot penuh, tanggal lewat, hak akses) dijaga oleh database, bukan hanya oleh tampilan.
Jadi tidak bisa diakali dari browser, dan dua orang yang booking pop up bersamaan tidak mungkin dapat slot yang sama.

## Setup (sekali saja, ±15 menit, gratis)

### 1. Buat project Supabase
1. Daftar di <https://supabase.com> (gratis, tidak perlu kartu kredit). Klik **New project**, pilih region **Southeast Asia (Singapore)**.
2. Buka **SQL Editor → New query**. Paste seluruh isi `supabase/schema.sql`, lalu klik **Run**.
3. Buat query baru lagi, paste isi `supabase/seed_2026.sql`, lalu klik **Run**. Ini mengisi placement dan kalender 2026.

Kalau project dibuat **sebelum** fitur link materi ada, jalankan juga `supabase/update_01_link_materi.sql`.

### 2. Atur login
Buka **Authentication → URL Configuration**:
- **Site URL**: `https://yoyo4jazz.github.io/JUN-AI-Companion/banner-booking/`
- **Redirect URLs**: tambahkan URL yang sama.

Buka **Authentication → Providers → Email** (atau *Sign In / Providers*):
- Disarankan **matikan "Confirm email"**. Email bawaan Supabase gratis dibatasi hanya beberapa email per jam, dan akun baru tetap harus disetujui admin, jadi konfirmasi email tidak wajib.

### 3. Hubungkan web ke Supabase
Buka **Project Settings → API**, lalu salin:
- **Project URL** ke `SUPABASE_URL` di `config.js`
- **anon public key** ke `SUPABASE_ANON_KEY` di `config.js`

> `anon key` memang boleh publik. **Jangan pernah** memasukkan `service_role key` ke `config.js`.

### 4. Publish
Workflow `.github/workflows/deploy.yml` otomatis mem-publish repo ke GitHub Pages setiap ada push ke `main`.
Setelah merge, aplikasi bisa dibuka di:
**https://yoyo4jazz.github.io/JUN-AI-Companion/banner-booking/**

### 5. Jadikan diri Anda admin
1. Buka web tersebut, klik **Masuk / Daftar**, lalu daftar dengan email Anda.
2. Di Supabase **SQL Editor**, jalankan:
   ```sql
   update public.profiles set role = 'admin' where email = 'email-anda@contoh.com';
   ```
3. Refresh web. Menu **Admin** akan muncul.

Setelah itu, principal dan tim internal cukup daftar sendiri di web. Admin lalu mengubah peran mereka di **Admin → Pengguna**.

## Tiap tahun baru
**Admin → Tahun & Event**. Isi tahun, klik **Buat tahun**. Libur nasional diambil otomatis dari [Nager.Date](https://date.nager.at).
Setelah itu:
- Cek ulang tanggal libur Islam (Idul Fitri, Idul Adha, dan seterusnya). Tanggal resminya ditetapkan SKB 3 Menteri dan bisa berbeda dari data otomatis.
- Tambahkan **cuti bersama** secara manual (jenis: *Cuti bersama*).
- Import event PPGOS, satu baris satu event:
  ```
  14/01;;Flash Sale
  21/01;23/01;Hot Sale
  2027-02-11;;Flash Sale
  ```

## Batas paket gratis Supabase (perlu diketahui)
| Batas | Dampak |
|---|---|
| Storage file 1 GB | Cukup untuk ±200–500 banner gambar. Kalau ada video, hapus materi lama secara berkala, atau minta principal mengirim link Google Drive di kolom catatan. |
| Maks 50 MB per file | Video panjang tidak bisa diupload. |
| Project **di-pause** setelah 7 hari tanpa aktivitas | Web akan error "gagal terhubung". Buka dashboard Supabase lalu klik **Restore**. Data tidak hilang. |
| Email bawaan sangat terbatas | Karena itu "Confirm email" disarankan dimatikan, dan reset password bisa gagal kalau sering dipakai. Solusinya pasang SMTP sendiri (mis. Gmail/Brevo gratis) di Authentication → SMTP. |

## Struktur file
```
banner-booking/
├── index.html          # halaman
├── styles.css          # tampilan
├── app.js              # logika aplikasi
├── config.js           # URL & anon key Supabase (diisi saat setup)
└── supabase/
    ├── schema.sql      # tabel, aturan booking, keamanan (RLS), storage
    ├── update_01_link_materi.sql  # update: materi berupa link
    ├── update_02_notif_wa.sql     # opsional: notif WA otomatis ke admin (CallMeBot)
    └── seed_2026.sql   # placement + libur nasional & event PPGOS 2026
```
