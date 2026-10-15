import React, { useState } from 'react';
import { GraduationCap, Lock, LogIn } from 'lucide-react';

// Halaman login wali kelas. Password dikirim ke /api/login lalu sesi disimpan sebagai cookie HttpOnly.
export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal masuk');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="brand-mark"><GraduationCap size={20} /></span>
          <div>
            <b>Wali Kelas<span className="brand-dot">.</span></b>
            <small>DASHBOARD</small>
          </div>
        </div>
        <h1>Masuk ke dashboard</h1>
        <p>Masukkan password wali kelas untuk melanjutkan.</p>
        <label className="login-field">
          <span><Lock size={14} /> Password</span>
          <input
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            placeholder="Password wali kelas"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary login-submit" type="submit" disabled={busy || !password}>
          <LogIn size={16} /> {busy ? 'Memeriksa...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
