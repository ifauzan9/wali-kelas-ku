import app from './app.js';

// Entry point pengembangan lokal: menjalankan server Express long-running.
// Di Vercel, aplikasi dijalankan lewat api/[...path].js sebagai Serverless Function.
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API Wali Kelas berjalan di http://localhost:${port}`);
});
