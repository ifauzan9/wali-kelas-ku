-- Migrasi: tambah status kehadiran 'Dispensasi'.
-- Jalankan di Neon SQL Editor bila tabel attendance sudah ada sebelumnya.

alter table public.attendance drop constraint if exists attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('Hadir','Izin','Sakit','Alpa','Dispensasi'));