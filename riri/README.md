# Riri Hologram

Asisten virtual berwujud hologram perempuan untuk teman diskusi suara (bahasa Indonesia).
Memakai backend yang sama dengan Jun (`cloudflare/worker.js`), dengan persona `riri`.

Alamat: https://yoyo4jazz.github.io/JUN-AI-Companion/riri/

## Yang perlu dilakukan sekali saja

### Mode mudah (tanpa Cloudflare)
1. Di platform.openai.com: isi saldo (Billing), pasang batas bulanan (Limits), lalu buat kunci (API keys → Create new secret key).
2. Buka Riri → ⚙️ Pengaturan → tempel kunci `sk-...` di kolom **Mode mudah** → Simpan.
3. Ketuk Riri sekali dan izinkan mikrofon.
4. Menu browser → **Tambahkan ke layar utama**.

Kunci tersimpan hanya di browser perangkat ini dan dikirim langsung ke OpenAI.
Risikonya: siapa pun yang memegang tablet ini bisa mengambil kunci tersebut. Batas bulanan di OpenAI adalah pengamannya.

### Mode backend (lebih aman, opsional)
Kunci disimpan di Cloudflare Worker (`cloudflare/worker.js`), bukan di tablet.
Buat Worker, tempel kodenya, tambahkan secret `OPENAI_API_KEY`, lalu isi alamat `https://...workers.dev` di Pengaturan Riri.
Kalau alamat backend diisi, Riri memakai backend dan mengabaikan kunci di tablet.

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
