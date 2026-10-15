// Klien API backend (Neon). Frontend tidak pernah menyentuh database secara langsung.
const jsonHeaders = { 'Content-Type': 'application/json' };

async function request(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Permintaan gagal (${res.status})`);
  }
  return res.json();
}

export const api = {
  students: (date) => request(date ? `/api/students?date=${encodeURIComponent(date)}` : '/api/students'),
  saveAttendance: (student_id, status, attendance_date, comment) =>
    request('/api/attendance', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ student_id, status, attendance_date, comment }) }),
  monthlyRecap: (month) => request(`/api/attendance-summary?month=${encodeURIComponent(month)}`),
  studentNotes: () => request('/api/student-notes'),
  deleteStudentNote: (id) => request(`/api/student-notes/${id}`, { method: 'DELETE' }),
  addStudentNote: (student_name, category, note, photo) => {
    // Jika ada foto, kirim sebagai multipart/form-data agar backend mengunggah ke Neon Object Storage.
    if (photo) {
      const form = new FormData();
      form.append('student_name', student_name);
      form.append('category', category);
      form.append('note', note);
      form.append('photo', photo);
      return request('/api/student-notes', { method: 'POST', body: form });
    }
    return request('/api/student-notes', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ student_name, category, note }) });
  },
  addClassNote: (note) =>
    request('/api/class-notes', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ note }) }),
  noteCategories: () => request('/api/note-categories'),
  addNoteCategory: (name, color) =>
    request('/api/note-categories', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name, color }) }),
  deleteNoteCategory: (id) => request(`/api/note-categories/${id}`, { method: 'DELETE' }),
  importStudents: (students) =>
    request('/api/students/import', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ students }) }),
  deleteStudent: (id) => request(`/api/students/${id}`, { method: 'DELETE' }),
};