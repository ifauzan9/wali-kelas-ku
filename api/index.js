// Vercel Serverless Function: seluruh rute /api/* diarahkan ke sini lewat rewrites di vercel.json.
// Express app adalah fungsi (req, res), sehingga dapat langsung dipakai sebagai handler.
import app from '../server/app.js';

export default app;
