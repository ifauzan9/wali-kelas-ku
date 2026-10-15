import express from 'express';
import { neon } from '@neondatabase/serverless';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import crypto from 'node:crypto';
import 'dotenv/config';
import {
  isAuthenticated,
  sessionCookieHeader,
  clearCookieHeader,
} from './session.js';

// Definisi aplikasi Express tanpa app.listen, agar dapat dipakai bersama:
// - server/index.js untuk pengembangan lokal (long-running server).
// - api/index.js sebagai Vercel Serverless Function.
const app = express();
app.use(express.json({ limit: '2mb' }));

const connectionString = process.env.DATABASE_URL;
const sql = connectionString ? neon(connectionString) : null;

// Konfigurasi Neon Object Storage (S3-compatible). Bucket bersifat private.
const storageBucket = process.env.NEON_STORAGE_BUCKET || 'catatan-siswa';
const s3Configured = Boolean(
  process.env.AWS_ENDPOINT_URL_S3 &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION
);
const s3 = s3Configured
  ? new S3Client({
      region: process.env.AWS_REGION,
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
      // Presigned PUT dari SDK terbaru menyisipkan checksum dari body kosong,
      // yang menolak unggahan berisi data. Setelan ini mengembalikan perilaku normal.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    })
  : null;

// Foto disimpan di memori lalu diunggah ke bucket. Maksimal 5 MB, hanya JPG/PNG.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
      return cb(new Error('Hanya file JPG atau PNG yang diizinkan'));
    }
    cb(null, true);
  },
});

// ---- Autentikasi ----
// Password tunggal wali kelas via APP_PASSWORD. Sesi disimpan pada cookie HttpOnly bertanda tangan.
const appPassword = process.env.APP_PASSWORD || '';

// Bandingkan password secara waktu-tetap untuk menghindari timing attack.
function passwordMatches(input) {
  if (!appPassword) return false;
  const a = Buffer.from(String(input));
  const b = Buffer.from(appPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post('/api/login', (req, res) => {
  if (!appPassword) {
    return res.status(503).json({ error: 'APP_PASSWORD belum dikonfigurasi' });
  }
  const { password } = req.body || {};
  if (!passwordMatches(password)) {
    return res.status(401).json({ error: 'Password salah' });
  }
  res.setHeader('Set-Cookie', sessionCookieHeader());
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearCookieHeader());
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req), configured: Boolean(appPassword) });
});

// Middleware: lindungi seluruh endpoint /api selain rute autentikasi di atas.
app.use('/api', (req, res, next) => {
  if (!appPassword) {
    return res.status(503).json({ error: 'APP_PASSWORD belum dikonfigurasi' });
  }
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Belum masuk. Silakan login.' });
  }
  next();
});

// Hanya endpoint baca/tulis data kelas. Tidak menerima kueri SQL mentah dari klien.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: Boolean(sql), storage: Boolean(s3) });
});

app.get('/api/students', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  try {
    // Tanggal opsional (?date=YYYY-MM-DD). Default hari ini.
    const requested = typeof req.query.date === 'string' ? req.query.date : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : new Date().toISOString().slice(0, 10);
    const students = await sql`
      select s.id, s.name, s.nis, s.gender, s.avatar, s.color,
             coalesce(a.status, 'Hadir') as status,
             a.comment
      from public.students s
      left join public.attendance a
        on a.student_id = s.id and a.attendance_date = ${date}
      order by s.name`;
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat data siswa' });
  }
});

app.post('/api/attendance', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { student_id, status, attendance_date, comment } = req.body || {};
  const allowed = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispensasi'];
  if (!student_id || !allowed.includes(status)) {
    return res.status(400).json({ error: 'student_id atau status tidak valid' });
  }
  // Komentar opsional, maksimal 500 karakter.
  const note = typeof comment === 'string' ? comment.trim().slice(0, 500) : null;
  // Tanggal opsional (YYYY-MM-DD). Default hari ini.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(attendance_date || '')
    ? attendance_date
    : new Date().toISOString().slice(0, 10);
  try {
    await sql`
      insert into public.attendance (student_id, attendance_date, status, comment, updated_at)
      values (${student_id}, ${date}, ${status}, ${note || null}, now())
      on conflict (student_id, attendance_date)
      do update set status = excluded.status, comment = excluded.comment, updated_at = now()`;
    res.json({ ok: true, attendance_date: date });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan absensi' });
  }
});

// Rekap absensi per bulan (?month=YYYY-MM). Default bulan berjalan.
app.get('/api/attendance-summary', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const requested = typeof req.query.month === 'string' ? req.query.month : '';
  const month = /^\d{4}-\d{2}$/.test(requested) ? requested : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  // Rentang tanggal: dari awal bulan sampai awal bulan berikutnya.
  const start = `${month}-01`;
  const nextMonth = monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  try {
    const rows = await sql`
      select s.id, s.name, s.nis, s.avatar, s.color,
             ${month}::text as month,
             count(a.id)::int as recorded,
             count(a.id) filter (where a.status = 'Hadir')::int as hadir,
             count(a.id) filter (where a.status = 'Izin')::int as izin,
             count(a.id) filter (where a.status = 'Sakit')::int as sakit,
             count(a.id) filter (where a.status = 'Alpa')::int as alpa,
             count(a.id) filter (where a.status = 'Dispensasi')::int as dispensasi
      from public.students s
      left join public.attendance a
        on a.student_id = s.id
       and a.attendance_date >= ${start}
       and a.attendance_date < ${nextMonth}
      group by s.id, s.name, s.nis, s.avatar, s.color
      order by s.name`;
    // Ambil detail harian per siswa untuk rekap harian.
    const daily = await sql`
      select a.student_id, to_char(a.attendance_date, 'YYYY-MM-DD') as date, a.status
      from public.attendance a
      where a.attendance_date >= ${start} and a.attendance_date < ${nextMonth}
      order by a.attendance_date`;
    const dailyByStudent = daily.reduce((acc, d) => {
      (acc[d.student_id] = acc[d.student_id] || {})[d.date] = d.status;
      return acc;
    }, {});
    res.json({
      month,
      start,
      end: nextMonth,
      students: rows.map((r) => ({ ...r, daily: dailyByStudent[r.id] || {} })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat rekap absensi' });
  }
});

app.get('/api/student-notes', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  try {
    const notes = await sql`
      select id, student_name, category, note, photo_key, photo_mime, created_at
      from public.student_notes
      order by created_at desc
      limit 50`;
    // Bucket private: berikan presigned URL agar foto dapat ditampilkan sementara.
    const withUrls = await Promise.all(
      notes.map(async (n) => {
        let photoUrl = null;
        if (n.photo_key && s3) {
          try {
            photoUrl = await getSignedUrl(
              s3,
              new GetObjectCommand({ Bucket: storageBucket, Key: n.photo_key }),
              { expiresIn: 3600 }
            );
          } catch {
            photoUrl = null;
          }
        }
        const { photo_key, photo_mime, ...rest } = n;
        return { ...rest, photoUrl, photoMime: photo_mime };
      })
    );
    res.json(withUrls);
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat catatan siswa' });
  }
});

app.post('/api/student-notes', upload.single('photo'), async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { student_name, category, note } = req.body || {};
  if (!student_name || !note) {
    return res.status(400).json({ error: 'student_name dan note wajib diisi' });
  }

  let photoKey = null;
  const photoMime = req.file ? req.file.mimetype : null;

  if (req.file) {
    if (!s3) {
      return res.status(503).json({ error: 'Neon Object Storage belum dikonfigurasi' });
    }
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const safeName = String(student_name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    photoKey = `catatan/${Date.now()}-${safeName || 'siswa'}.${ext}`;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: storageBucket,
          Key: photoKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );
    } catch {
      return res.status(500).json({ error: 'Gagal mengunggah foto catatan' });
    }
  }

  try {
    const rows = await sql`
      insert into public.student_notes (student_name, category, note, photo_key, photo_mime)
      values (${student_name}, ${category || 'Akademik'}, ${note}, ${photoKey}, ${photoMime})
      returning id, student_name, category, note, created_at`;
    let photoUrl = null;
    if (photoKey && s3) {
      try {
        photoUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: storageBucket, Key: photoKey }),
          { expiresIn: 3600 }
        );
      } catch {
        photoUrl = null;
      }
    }
    res.json({ ...rows[0], photoUrl, photoMime });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan catatan siswa' });
  }
});

// Hapus catatan siswa beserta fotonya di object storage.
app.delete('/api/student-notes/:id', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    // Ambil kunci foto lebih dulu agar objeknya dapat dihapus setelah baris database terhapus.
    const rows = await sql`select photo_key from public.student_notes where id = ${id}`;
    if (!rows.length) return res.status(404).json({ error: 'Catatan tidak ditemukan' });
    const photoKey = rows[0].photo_key;
    await sql`delete from public.student_notes where id = ${id}`;
    if (photoKey && s3) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: photoKey }));
      } catch {
        // Baris database sudah terhapus; kegagalan hapus objek tidak dianggap fatal.
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus catatan siswa' });
  }
});

app.get('/api/note-categories', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  try {
    const rows = await sql`
      select id, name, color
      from public.note_categories
      order by created_at, name`;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat kategori catatan' });
  }
});

app.post('/api/note-categories', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { name, color } = req.body || {};
  const clean = typeof name === 'string' ? name.trim().slice(0, 60) : '';
  if (!clean) return res.status(400).json({ error: 'Nama kategori wajib diisi' });
  // Warna dibatasi ke palet yang dipakai antarmuka agar label tetap konsisten.
  const palette = ['purple', 'blue', 'green', 'orange', 'pink', 'cyan', 'yellow'];
  const chosen = palette.includes(color) ? color : null;
  try {
    const rows = await sql`
      insert into public.note_categories (name, color)
      values (${clean}, ${chosen || 'blue'})
      on conflict (name) do update set name = excluded.name
      returning id, name, color`;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan kategori catatan' });
  }
});

app.delete('/api/note-categories/:id', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    await sql`delete from public.note_categories where id = ${id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus kategori catatan' });
  }
});

app.post('/api/class-notes', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { note } = req.body || {};
  if (!note) return res.status(400).json({ error: 'note wajib diisi' });
  try {
    await sql`insert into public.class_notes (note) values (${note})`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan catatan kelas' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'id tidak valid' });
  try {
    await sql`delete from public.students where id = ${id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus siswa' });
  }
});

app.post('/api/students/import', async (req, res) => {
  if (!sql) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi' });
  const { students } = req.body || {};
  if (!Array.isArray(students) || !students.length) {
    return res.status(400).json({ error: 'Data siswa kosong' });
  }
  if (students.length > 1000) {
    return res.status(400).json({ error: 'Maksimal 1000 baris per impor' });
  }
  const palette = ['violet', 'blue', 'orange', 'green', 'pink', 'cyan', 'yellow'];
  const clean = students
    .map((s) => ({
      name: String(s.name || '').trim(),
      nis: s.nis ? String(s.nis).trim() : null,
      gender: s.gender === 'L' || s.gender === 'P' ? s.gender : null,
    }))
    .filter((s) => s.name);
  if (!clean.length) return res.status(400).json({ error: 'Tidak ada nama siswa yang valid' });

  try {
    // Jalankan penyisipan secara paralel agar tetap cepat di lingkungan serverless.
    const results = await Promise.all(
      clean.map((s, i) => {
        const avatar = s.name.split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
        const color = palette[i % palette.length];
        return sql`
          insert into public.students (name, nis, gender, avatar, color)
          values (${s.name}, ${s.nis}, ${s.gender}, ${avatar}, ${color})
          on conflict (nis) do nothing
          returning id`;
      })
    );
    const inserted = results.filter((rows) => rows.length).length;
    const skipped = clean.length - inserted;
    res.json({ ok: true, inserted, skipped, total: clean.length });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengimpor data siswa' });
  }
});

// Menangani galat unggahan (tipe file salah / ukuran melebihi batas) dengan pesan yang jelas.
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Ukuran foto melebihi 5 MB' });
  }
  if (err.message && err.message.includes('Hanya file JPG atau PNG')) {
    return res.status(415).json({ error: 'Hanya file JPG atau PNG yang diizinkan' });
  }
  console.error('Galat server:', err.message);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// 404 JSON untuk rute /api yang tidak dikenal (lebih informatif daripada HTML bawaan Express).
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

export default app;
