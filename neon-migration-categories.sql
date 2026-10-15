-- Migrasi: tabel kategori catatan siswa.
-- Jalankan di Neon SQL Editor untuk database yang sudah ada.

create extension if not exists pgcrypto;

create table if not exists public.note_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default 'blue',
  created_at timestamptz not null default now()
);

-- Kategori awal agar halaman Catatan langsung terisi.
insert into public.note_categories (name, color) values
  ('Akademik', 'purple'),
  ('Perilaku', 'blue'),
  ('Kesehatan', 'green'),
  ('Komunikasi orang tua', 'orange')
on conflict (name) do nothing;
