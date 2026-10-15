// Vercel Serverless Function (catch-all): semua rute /api/* diteruskan ke Express app.
// Karena Express app adalah fungsi (req, res), ia dapat langsung dipakai sebagai handler.
import app from '../server/app.js';

export default app;
