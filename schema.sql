-- schema.sql
-- Skema database untuk walas-dashboard (Neon PostgreSQL)
-- Jalankan di Neon SQL Editor atau: psql "$DATABASE_URL" -f schema.sql

create extension if not exists pgcrypto;

create table if not exists public.students (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  nis    text unique,
  gender text check (gender in ('L', 'P')),
  avatar text,
  color  text
);

create table if not exists public.attendance (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status          text not null check (status in ('Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispensasi')),
  comment         text,
  updated_at      timestamptz not null default now(),
  unique (student_id, attendance_date)
);

-- Migrasi untuk database yang sudah ada: tambah kolom komentar jika belum ada.
alter table public.attendance add column if not exists comment text;

create index if not exists attendance_date_idx on public.attendance (attendance_date);

create table if not exists public.student_notes (
  id           uuid primary key default gen_random_uuid(),
  student_name text not null,
  category     text default 'Akademik',
  note         text,
  photo_key    text,
  photo_mime   text,
  created_at   timestamptz not null default now()
);

-- Kategori catatan siswa. Dapat ditambah/dihapus dari halaman Catatan.
-- Warna dipakai untuk label kategori di daftar catatan.
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

create table if not exists public.class_notes (
  id         uuid primary key default gen_random_uuid(),
  note       text not null,
  created_at timestamptz not null default now()
);

-- Contoh data awal (hapus jika tidak diperlukan)
insert into public.students (name, nis, gender, avatar, color) values
  ('Ahmad Fauzi',  '1001', 'L', 'AF', 'violet'),
  ('Siti Aminah',  '1002', 'P', 'SA', 'blue'),
  ('Budi Santoso', '1003', 'L', 'BS', 'orange')
on conflict (nis) do nothing;
