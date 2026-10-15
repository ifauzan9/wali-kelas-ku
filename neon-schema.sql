-- Skema Neon (PostgreSQL) untuk aplikasi Wali Kelas.
-- Jalankan seluruh isi file ini di Neon SQL Editor.

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nis text unique,
  gender text check (gender in ('L','P')),
  class_name text default 'XI J',
  avatar text,
  color text default 'violet',
  created_at timestamptz default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null default current_date,
  status text not null check (status in ('Hadir','Izin','Sakit','Alpa','Dispensasi')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (student_id, attendance_date)
);

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  student_name text not null,
  category text not null default 'Akademik',
  note text not null,
  created_at timestamptz default now()
);

create table if not exists public.class_notes (
  id uuid primary key default gen_random_uuid(),
  note text not null,
  note_date date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kategori catatan siswa: nama unik + warna label. Dikelola dari halaman Catatan.
create table if not exists public.note_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'blue',
  created_at timestamptz default now()
);

insert into public.note_categories (name, color) values
  ('Akademik', 'purple'),
  ('Perilaku', 'blue'),
  ('Kesehatan', 'green'),
  ('Komunikasi orang tua', 'orange')
on conflict (name) do nothing;

-- Data contoh siswa (boleh dihapus bila sudah punya data asli)
insert into public.students (name, nis, gender, avatar, color) values
  ('Alya Putri Ramadhani','10241','P','AP','violet'),
  ('Bima Arya Pratama','10242','L','BA','blue'),
  ('Citra Maharani','10243','P','CM','orange'),
  ('Daffa Rizky Saputra','10244','L','DR','green'),
  ('Nadia Zahra Azzahra','10245','P','NZ','pink'),
  ('Rafi Alfarizi','10246','L','RA','cyan'),
  ('Salsabila Nur Fitri','10247','P','SN','yellow')
on conflict (nis) do nothing;