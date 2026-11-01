# WA Status Scheduler - Web Dashboard

Aplikasi Web Dashboard untuk menjadwalkan dan mengunggah status WhatsApp (berupa **Teks** maupun **Gambar + Caption**) secara otomatis pada waktu yang ditentukan.

Aplikasi ini berjalan di **Cloud Server** atau di laptop/PC Anda, sehingga **TIDAK MEMERLUKAN INSTALASI APLIKASI DI HP** dan bebas 100% dari masalah izin Google Play Protect.

---

## 🌟 Fitur Utama

1. **Tanpa Instal Aplikasi di HP**:
   - Terhubung langsung menggunakan fitur resmi WhatsApp: **Perangkat Tertaut (Linked Devices)**.
   - Mendukung **Scan QR Code** atau **Kode Pairing 8-Digit** (cukup masukkan nomor HP Anda).
2. **Jadwalkan Status Teks & Gambar**:
   - Unggah gambar dari laptop atau HP lewat antarmuka web.
   - Tulis pesan teks atau caption.
   - Tentukan tanggal dan jam tayang otomatis.
3. **Eksekusi 24/7 di Server**:
   - HP Anda bisa dimatikan atau layar terkunci; server di cloud yang akan mengirimkan status tepat waktu.
4. **Antarmuka Responsif (Mobile-Friendly)**:
   - Tampilan bersih bertema WhatsApp, nyaman dibuka langsung dari browser Google Chrome di HP Anda.

---

## 🚀 Cara Menjalankan di Komputer / Laptop Anda (Lokal)

1. Buka folder proyek ini di terminal:
   ```bash
   cd C:\Users\bensu\.gemini\antigravity\scratch\wa-status-web
   ```
2. Jalankan server:
   ```bash
   node server.js
   ```
3. Buka browser dan akses:
   👉 **http://localhost:3000**

---

## 🌐 Cara Memasang ke Server Cloud Gratis (Deploy 100% Gratis)

Anda bisa meng-online-kan aplikasi ini ke server gratis agar dapat diakses dari mana saja lewat HP Anda:

### Opsi A: Menggunakan Koyeb (Paling Direkomendasikan & Cepat)
1. Buat akun gratis di **[Koyeb.com](https://www.koyeb.com/)**.
2. Unggah folder proyek ini ke akun **GitHub** Anda.
3. Di dashboard Koyeb, klik **Create Service** > pilih **GitHub**.
4. Pilih repository proyek Anda.
5. Pada pilihan Build, pilih **Buildpack** atau **Dockerfile** (otomatis terdeteksi).
6. Klik **Deploy**!
7. Anda akan mendapatkan URL website (misal: `https://wa-status-scheduler-anda.koyeb.app`) yang bisa dibuka langsung dari browser HP Anda kapan saja.

### Opsi B: Menggunakan Render.com
1. Buat akun gratis di **[Render.com](https://render.com/)**.
2. Unggah proyek ke akun GitHub Anda.
3. Di Render, klik **New +** > **Web Service**.
4. Sambungkan ke repository GitHub Anda.
5. Konfigurasi:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
6. Klik **Create Web Service**.
7. *Tips agar Render tidak tidur (sleep):* Daftarkan URL Render Anda di layanan gratis **[UptimeRobot.com](https://uptimerobot.com/)** untuk melakukan ping setiap 5 menit.

---

## 📱 Cara Menghubungkan WhatsApp di Website

1. Buka halaman web dashboard Anda.
2. Di bagian **1. Hubungkan WhatsApp**:
   - **Metode 1 (Scan QR):** Buka WhatsApp di HP > Titik 3 > **Perangkat Tertaut** > **Tautkan Perangkat** > Scan QR code.
   - **Metode 2 (Kode Pairing - Paling Mudah dari HP):** Pilih tab *Gunakan Kode Pairing*, masukkan nomor HP Anda (contoh: `628123456789`), lalu masukkan 8 kode huruf/angka yang muncul ke notifikasi WhatsApp di HP Anda.
3. Setelah muncul status **"WhatsApp Berhasil Terhubung"**, akun Anda sudah aktif dan siap menjadwalkan status!
