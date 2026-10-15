import crypto from 'node:crypto';

// Utilitas sesi tanpa dependency tambahan: token ditandatangani dengan HMAC-SHA256.
// Cookie hanya menyimpan token bertanda tangan (bukan password), sehingga cukup aman
// selama SESSION_SECRET dirahasiakan.

const COOKIE_NAME = 'walas_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 hari

function getSecret() {
  // SESSION_SECRET wajib di produksi. Fallback hanya agar pengembangan lokal tetap jalan.
  return process.env.SESSION_SECRET || 'walas-dev-secret-change-me';
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

// Token: <expiresAt>.<signature>. Stateless, tidak perlu penyimpanan sesi.
export function createSessionToken() {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  // Perbandingan waktu-tetap untuk menghindari timing attack.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

// Membaca cookie dari header tanpa middleware pihak ketiga.
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionCookie(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || '';
}

export function isAuthenticated(req) {
  return verifySessionToken(getSessionCookie(req));
}

export function sessionCookieHeader() {
  const token = createSessionToken();
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
