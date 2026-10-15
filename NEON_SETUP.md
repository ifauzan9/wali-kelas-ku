# Menghubungkan aplikasi ke Neon

Neon adalah PostgreSQL serverless. Karena browser tidak boleh menyimpan kredensial database, aplikasi ini memakai **server API Express** di folder `server/` yang menyimpan `DATABASE_URL` di sisi server.

## 1. Buat proyek Neon
1. Buka [Neon](https://console.neon.tech/) dan buat proyek baru.
2. Buka halaman **Dashboard → Connection Details**.
3. Salin **connection string** (format `postgresql://...`). Simpan password dengan aman.

## 2. Jalankan skema database
1. Buka **SQL Editor** di Neon.
2. Salin seluruh isi `neon-schema.sql` dan jalankan.
3. Skema membuat tabel `students`, `attendance`, `student_notes`, dan `class_notes`, lalu mengisi beberapa siswa contoh.

## 3. Konfigurasi environment
1. Salin `.env.example` menjadi `.env`.
2. Isi `DATABASE_URL` dengan connection string Neon, misalnya:
   ```env
   DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   PORT=3001
   ```
3. Isi juga autentikasi:
   ```env
   APP_PASSWORD=password-wali-kelas-yang-kuat
   SESSION_SECRET=string-acak-panjang
   ```
   Buat `SESSION_SECRET` acak dengan:
   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Jangan commit file `.env`. Jangan bagikan password database maupun `SESSION_SECRET`.

> Aplikasi dilindungi login password tunggal. Tanpa `APP_PASSWORD`, seluruh endpoint `/api` menolak permintaan (503).

## 4. Aktifkan Neon Object Storage (untuk foto catatan siswa)
Neon menyediakan **Object Storage** yang kompatibel dengan S3. Foto catatan siswa disimpan di sini, sedangkan databasenya hanya menyimpan kunci (key) foto.

1. Pastikan proyek Neon berada di region yang mendukung Object Storage: **AWS US East (Ohio)**, **N. Virginia**, **Europe (Frankfurt)**, atau **Asia Pacific (Singapore)**.
2. Di Neon Console, buka proyek → pilih branch → tab **Object storage**.
3. Klik **New bucket**, beri nama `catatan-siswa`, pilih akses **private**, lalu klik **Create**.
4. Klik **Connect** di sidebar → tab **Storage** → pilih **Parameters only**. Salin nilai-nilai berikut:
   - `AWS_ENDPOINT_URL_S3` (endpoint branch)
   - `AWS_ACCESS_KEY_ID` (`token_id`)
   - `AWS_SECRET_ACCESS_KEY` (`s3_secret_access_key`)
   - `AWS_REGION`
5. Tambahkan ke file `.env`:
   ```env
   AWS_ENDPOINT_URL_S3=https://br-xxxx.storage.c-2.us-east-2.aws.neon.tech
   AWS_ACCESS_KEY_ID=nak_live_xxxxxxxxxxxxxxxx
   AWS_SECRET_ACCESS_KEY=nsk_live_xxxxxxxxxxxxxxxx
   AWS_REGION=us-east-2
   NEON_STORAGE_BUCKET=catatan-siswa
   ```
   > **Penting:** `AWS_SECRET_ACCESS_KEY` hanya ditampilkan **sekali** saat kredensial dibuat. Simpan segera. Jika hilang, buat kredensial baru.
6. Jalankan migrasi `neon-migration-photos.sql` di **SQL Editor** agar tabel `student_notes` punya kolom `photo_key` dan `photo_mime`.
7. Jalankan ulang server API (`npm run server`). Cek `http://localhost:3001/api/health` — nilai `storage` harus `true`.
8. Tambahkan tabel kategori catatan: jalankan perintah di bagian **Tabel `note_categories`** pada `schema.sql`, atau jalankan ulang `schema.sql` (aman diulang karena memakai `create table if not exists`).

Jika Object Storage belum dikonfigurasi, catatan tanpa foto tetap berfungsi normal; hanya unggah foto yang akan menampilkan pesan bahwa storage belum diatur.

## 5. Menjalankan aplikasi
Jalankan backend dan frontend di dua terminal:

```sh
# Terminal 1 — server API (Neon)
npm run server

# Terminal 2 — frontend
npm run dev
```

Buka `http://localhost:5173`. Permintaan `/api` otomatis diteruskan Vite ke server di `http://localhost:3001`.

Untuk produksi:

```sh
npm run build   # menghasilkan folder dist
npm run start   # menjalankan server API
```

Frontend hasil build (`dist`) perlu disajikan oleh server statis atau hosting, dengan `/api` diarahkan ke server API.

## 6. Deploy ke Vercel

Aplikasi ini juga dapat dijalankan di Vercel. Di sana Express **tidak** dijalankan sebagai server long-running, melainkan sebagai **Serverless Function**:

- `server/app.js` berisi definisi Express (dipakai bersama).
- `server/index.js` menjalankan server lokal (`npm run server`).
- `api/index.js` mengekspor app Express sebagai handler Serverless Function; semua rute `/api/*` diarahkan ke sini lewat `rewrites` di `vercel.json`.
- `vercel.json` mengatur build (`vite build`), output (`dist`), dan rewrite `/api/(.*)` → `/api`.

Langkah deploy:
1. Push proyek ke GitHub, lalu import repo di [Vercel](https://vercel.com/new).
2. Vercel mendeteksi Vite dan menjalankan `vite build`.
3. Tambahkan **Environment Variables** (Production + Preview) di Project Settings:
   `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`, `NEON_STORAGE_BUCKET`, `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`. (`PORT` tidak perlu.)
4. Deploy, lalu buka `https://<domain>/api/health` — pastikan `database` dan `storage` bernilai `true`.

Catatan: runtime memakai Node.js 24 (lihat `engines` di `package.json`). Node 20 sudah tidak didukung Vercel untuk deployment baru.

## Catatan penting tentang keamanan
- Backend hanya menerima data tertentu dan memakai parameterized query, sehingga aman dari SQL injection.
- Aplikasi dilindungi **login password tunggal** (`APP_PASSWORD`). Seluruh halaman dashboard hanya tampil setelah login, dan semua endpoint `/api/*` (selain `/api/login`, `/api/logout`, `/api/session`) menolak permintaan tanpa sesi yang valid.
- Sesi disimpan di **cookie HttpOnly** berisi token bertanda tangan HMAC-SHA256 (`SESSION_SECRET`). Cookie tidak memuat password, dan ditandai `Secure` di produksi.
- Gunakan `APP_PASSWORD` yang kuat dan `SESSION_SECRET` acak panjang. Jangan bagikan keduanya.
- Bucket foto disetel **private**. Backend membuat **presigned URL** berumur 1 jam agar foto tetap bisa tampil tanpa membuat bucket menjadi publik.
- Batas foto: **JPG/PNG, maksimal 5 MB**.
- Jangan memakai connection string berisi password di kode frontend.

## Struktur tabel
- `students`: data siswa (nama, NIS, jenis kelamin, kelas, avatar, warna).
- `attendance`: absensi per siswa per tanggal, unik pada (`student_id`, `attendance_date`).
- `student_notes`: catatan per siswa dengan kategori, plus `photo_key` dan `photo_mime` untuk foto di object storage.
- `note_categories`: daftar kategori catatan siswa (nama unik + warna label), dapat dikelola dari halaman Catatan.
- `class_notes`: catatan umum wali kelas.