# Riri Hologram

Asisten virtual berwujud hologram perempuan untuk teman diskusi suara (bahasa Indonesia).
Memakai backend yang sama dengan Jun (`cloudflare/worker.js`), dengan persona `riri`.

Alamat: https://yoyo4jazz.github.io/JUN-AI-Companion/riri/

## Yang perlu dilakukan sekali saja
1. **Deploy ulang Worker** supaya persona Riri aktif: `cd cloudflare && npx wrangler deploy`.
   Tanpa langkah ini Riri tetap jalan, tetapi memakai kepribadian Jun dan transkrip ucapanmu tidak muncul.
2. Buka halaman Riri → ⚙️ Pengaturan → isi alamat backend (`https://...workers.dev`). Kalau alamat Jun sudah tersimpan di perangkat ini, terisi otomatis.
3. Ketuk Riri sekali dan izinkan mikrofon.
4. Menu browser → **Tambahkan ke layar utama** supaya Riri bisa dibuka seperti aplikasi.

Setelah itu: setiap kali Riri dibuka, dia langsung aktif, menyapa sesuai waktu, dan membuka topik diskusi sendiri.

## Fitur
- Hologram animasi (berkedip, melayang, scanline). Mulut bergerak mengikuti suara Riri.
- Aktif otomatis saat dibuka jika izin mikrofon sudah diberikan. Ketuk hologram untuk menyalakan atau mematikan.
- Riri proaktif: menyapa, menawarkan topik, tombol **💡 Riri, buka topik**.
- Bisa bicara atau mengetik.
- Ingat obrolan terakhir (16 baris, hanya di perangkat ini; bisa dihapus).
- Mati otomatis jika diam (bawaan 5 menit) atau saat aplikasi ditinggal, supaya kuota OpenAI tidak terbuang.

## Batasan
- Tampilan "hologram" adalah ilustrasi 2D bergaya hologram di layar, bukan proyeksi 3D sungguhan.
- Belum ada kata pemicu ("Hai Riri"). Riri aktif saat dibuka atau saat diketuk.
- Browser kadang meminta satu ketukan sebelum suara keluar. Ini aturan browser dan tidak bisa dilewati.
- Setiap sesi memakai kuota OpenAI Realtime (berbayar per menit audio).
