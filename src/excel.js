import readXlsxFile from 'read-excel-file/browser';
import writeXlsxFile from 'write-excel-file/browser';

export const TEMPLATE_HEADERS = ['Nama', 'NIS', 'Jenis Kelamin'];

// Mencocokkan header kolom dalam bahasa Indonesia maupun Inggris.
const HEADER_ALIASES = {
  name: ['nama', 'namasiswa', 'namalengkap', 'name'],
  nis: ['nis', 'nisn', 'nomorinduk', 'noinduk'],
  gender: ['jeniskelamin', 'gender', 'jk', 'lp'],
};

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

const matchColumn = (header) => {
  const norm = normalize(header);
  return Object.keys(HEADER_ALIASES).find((key) => HEADER_ALIASES[key].includes(norm));
};

const toGender = (raw) => {
  const value = normalize(raw);
  if (value.startsWith('p') || value.startsWith('w')) return 'P';
  if (value.startsWith('l')) return 'L';
  return null;
};

// Membaca file Excel (.xlsx) siswa menjadi array objek { name, nis, gender }.
export async function readStudentFile(file) {
  let rows;
  try {
    rows = await readXlsxFile(file);
  } catch {
    throw new Error('Gagal membaca file. Pastikan berupa Excel (.xlsx) yang valid');
  }
  if (!rows || !rows.length) throw new Error('File kosong atau format tidak sesuai');

  // Pustaka ini mengembalikan daftar sheet: [{ sheet, data: [[...]] }].
  const sheet = rows.find((item) => item && Array.isArray(item.data)) || null;
  const sourceRows = sheet ? sheet.data : rows;
  if (!sourceRows || !sourceRows.length) throw new Error('File kosong atau format tidak sesuai');

  // Sebagian versi pustaka mengembalikan baris berupa objek berisi array sel.
  const grid = sourceRows.map((row) => (Array.isArray(row) ? row : Array.isArray(row?.data) ? row.data : Object.values(row || {})));
  if (!grid[0]) throw new Error('File kosong atau format tidak sesuai');

  const headerRow = grid[0].map((h) => matchColumn(h));
  const hasHeader = headerRow.some(Boolean);
  const columns = hasHeader
    ? { name: headerRow.indexOf('name'), nis: headerRow.indexOf('nis'), gender: headerRow.indexOf('gender') }
    : { name: 0, nis: 1, gender: 2 };

  const dataRows = hasHeader ? grid.slice(1) : grid;
  return dataRows
    .map((row) => {
      const cell = (index) => (index >= 0 ? row[index] : '');
      return {
        name: String(cell(columns.name) ?? '').trim(),
        nis: String(cell(columns.nis) ?? '').trim(),
        gender: toGender(cell(columns.gender)),
      };
    })
    .filter((s) => s.name);
}

// Mengunduh rekap absensi bulanan sebagai file Excel (.xlsx).
// rows: [{ name, nis, hadir, izin, sakit, alpa, dispensasi, recorded }]
export async function downloadRecap(rows, monthLabel) {
  const header = ['Nama', 'NIS', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Dispensasi', 'Tercatat'].map((value) => ({
    value,
    fontWeight: 'bold',
    backgroundColor: '#EDE9FE',
    color: '#5B4BC4',
    borderColor: '#D9D3F5',
  }));
  const body = rows.map((r) => [
    { value: r.name },
    { value: r.nis || '' },
    { value: r.hadir || 0, type: Number },
    { value: r.izin || 0, type: Number },
    { value: r.sakit || 0, type: Number },
    { value: r.alpa || 0, type: Number },
    { value: r.dispensasi || 0, type: Number },
    { value: r.recorded || 0, type: Number },
  ]);

  await writeXlsxFile([header, ...body], {
    sheet: `Rekap ${monthLabel}`,
    columns: [{ width: 30 }, { width: 14 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 12 }, { width: 11 }],
  }).toFile(`rekap-absen-${monthLabel.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
}
export async function downloadTemplate() {
  const header = TEMPLATE_HEADERS.map((value) => ({
    value,
    fontWeight: 'bold',
    backgroundColor: '#EDE9FE',
    color: '#5B4BC4',
    borderColor: '#D9D3F5',
  }));
  const sampleRows = [
    ['Alya Putri Ramadhani', '10241', 'P'],
    ['Bima Arya Pratama', '10242', 'L'],
  ].map((row) => row.map((value) => ({ value })));

  // API paket ini mengembalikan objek dengan method async `.toFile(nama)`.
  await writeXlsxFile([header, ...sampleRows], {
    sheet: 'Siswa',
    columns: [{ width: 30 }, { width: 14 }, { width: 16 }],
  }).toFile('template-data-siswa.xlsx');
}