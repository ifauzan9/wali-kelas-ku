-- Migrasi: tambah kolom foto pada tabel student_notes.
-- Jalankan di Neon SQL Editor setelah neon-schema.sql.

alter table public.student_notes
  add column if not exists photo_key text,
  add column if not exists photo_url text,
  add column if not exists photo_mime text;