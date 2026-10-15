import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { readStudentFile, downloadTemplate, downloadRecap, TEMPLATE_HEADERS } from './excel';
import { LayoutDashboard, ClipboardCheck, Users, BookOpenText, Settings, Search, Bell, ChevronDown, CalendarDays, Download, Plus, Check, Clock3, HeartPulse, CircleX, ArrowUpRight, MoreHorizontal, X, Sparkles, GraduationCap, Menu, Upload, FileSpreadsheet, Trash2, CalendarRange, Table2, PlaneTakeoff } from 'lucide-react';

const initialStudents = [
  { id:'s1',name:'Alya Putri Ramadhani',nis:'10241',gender:'P',status:'Hadir',avatar:'AP',color:'violet' },{ id:'s2',name:'Bima Arya Pratama',nis:'10242',gender:'L',status:'Hadir',avatar:'BA',color:'blue' },{ id:'s3',name:'Citra Maharani',nis:'10243',gender:'P',status:'Sakit',avatar:'CM',color:'orange' },{ id:'s4',name:'Daffa Rizky Saputra',nis:'10244',gender:'L',status:'Hadir',avatar:'DR',color:'green' },{ id:'s5',name:'Nadia Zahra Azzahra',nis:'10245',gender:'P',status:'Izin',avatar:'NZ',color:'pink' },{ id:'s6',name:'Rafi Alfarizi',nis:'10246',gender:'L',status:'Hadir',avatar:'RA',color:'cyan' },{ id:'s7',name:'Salsabila Nur Fitri',nis:'10247',gender:'P',status:'Hadir',avatar:'SN',color:'yellow' }];
const initialNotes = [{id:'n1',name:'Alya Putri Ramadhani',type:'Akademik',text:'Menunjukkan peningkatan yang baik dalam pelajaran Matematika.',time:'Hari ini, 08:15',avatar:'AP',color:'violet'},{id:'n2',name:'Bima Arya Pratama',type:'Perilaku',text:'Aktif membantu teman kelompok saat kegiatan diskusi.',time:'Kemarin, 13:40',avatar:'BA',color:'blue'}];
// Kategori catatan bawaan. Dipakai saat pratinjau (tanpa database); data asli dimuat dari API.
const NOTE_CATEGORY_PALETTE = ['purple','blue','green','orange','pink','cyan','yellow'];
const initialCategories = [
  { id:'c1', name:'Akademik', color:'purple' },
  { id:'c2', name:'Perilaku', color:'blue' },
  { id:'c3', name:'Kesehatan', color:'green' },
  { id:'c4', name:'Komunikasi orang tua', color:'orange' },
];
// Warna diambil dari palet secara berurutan agar tiap kategori punya warna berbeda.
const nextCategoryColor = (existing) => NOTE_CATEGORY_PALETTE[existing.length % NOTE_CATEGORY_PALETTE.length];
const categoryColor = (categories, name) => categories.find(c=>c.name===name)?.color || 'blue';

const dateLabel = new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
const statusMeta={Hadir:{icon:Check,className:'present'},Izin:{icon:Clock3,className:'permission'},Sakit:{icon:HeartPulse,className:'sick'},Alpa:{icon:CircleX,className:'absent'},Dispensasi:{icon:PlaneTakeoff,className:'dispensation'}};
const initials=(name)=>String(name).split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();

export default function App(){
 const [tab,setTab]=useState('Dashboard'); const [students,setStudents]=useState(initialStudents); const [notes,setNotes]=useState(initialNotes); const [categories,setCategories]=useState(initialCategories); const [classNote,setClassNote]=useState(''); const [query,setQuery]=useState(''); const [modal,setModal]=useState(''); const [notice,setNotice]=useState(''); const [mobileMenu,setMobileMenu]=useState(false);
 const [dataConnected,setDataConnected]=useState(false); const [dataError,setDataError]=useState('');
 const [importRows,setImportRows]=useState(null); const [importName,setImportName]=useState(''); const [importBusy,setImportBusy]=useState(false);
 const [photoFile,setPhotoFile]=useState(null); const [photoPreview,setPhotoPreview]=useState(''); const [noteBusy,setNoteBusy]=useState(false);
 const [newCategory,setNewCategory]=useState(''); const [categoryBusy,setCategoryBusy]=useState(false);
 const todayISO=()=>new Date().toISOString().slice(0,10);
 const thisMonthISO=()=>new Date().toISOString().slice(0,7);
 const [attDate,setAttDate]=useState(todayISO());
 const [recapMonth,setRecapMonth]=useState(thisMonthISO()); const [recap,setRecap]=useState(null); const [recapBusy,setRecapBusy]=useState(false); const [recapView,setRecapView]=useState('ringkasan'); const [attendanceVersion,setAttendanceVersion]=useState(0);
 useEffect(()=>{if(!mobileMenu)return;const onKey=e=>{if(e.key==='Escape')setMobileMenu(false);};window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);},[mobileMenu]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const rows=await api.students(attDate);
    if(!active)return;
    if(rows&&rows.length){setStudents(rows.map(s=>({...s,status:s.status||'Hadir'})));setDataConnected(true);setDataError('');}
   }catch(err){
    if(active){setDataConnected(false);setDataError(err.message);}
   }
  };
  load();
  const timer=setInterval(load,30000);
  return ()=>{active=false;clearInterval(timer);};
 },[attDate]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const data=await api.studentNotes();
    if(!active)return;
    if(data&&data.length)setNotes(data.map(n=>({id:n.id,name:n.student_name,type:n.category,text:n.note,photoUrl:n.photoUrl||null,time:new Date(n.created_at).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),avatar:initials(n.student_name),color:'violet'})));
   }catch{/* preview tetap memakai data contoh */}
  };
  load();
  const timer=setInterval(load,30000);
  return ()=>{active=false;clearInterval(timer);};
 },[]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const data=await api.noteCategories();
    if(!active)return;
    if(data&&data.length)setCategories(data);
   }catch{/* preview tetap memakai kategori bawaan */}
  };
  load();
  const timer=setInterval(load,60000);
  return ()=>{active=false;clearInterval(timer);};
 },[]);
 useEffect(()=>{
  if(tab!=='Rekap Bulan')return;
  let active=true;
  const load=async()=>{
   setRecapBusy(true);
   try{
    const data=await api.monthlyRecap(recapMonth);
    if(active)setRecap(data);
   }catch(err){
    if(active)flash(`Gagal memuat rekap: ${err.message}`);
   }finally{
    if(active)setRecapBusy(false);
   }
  };
  load();
  return ()=>{active=false;};
 },[tab,recapMonth,attendanceVersion]);
 const counts=useMemo(()=>students.reduce((a,s)=>(a[s.status]=(a[s.status]||0)+1,a),{}),[students]); const filtered=students.filter(s=>s.name.toLowerCase().includes(query.toLowerCase())||s.nis.includes(query));
 const isToday=attDate===todayISO();
 const attDateLabel=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${attDate}T00:00:00`));
 const saveStatus=async(student,status)=>{setStudents(prev=>prev.map(s=>s.id===student.id?{...s,status}:s));try{await api.saveAttendance(student.id,status,attDate,student.comment||null);setAttendanceVersion(v=>v+1);flash(isToday?'Absensi berhasil diperbarui':`Absensi ${attDateLabel} berhasil diperbarui`);}catch(err){flash(dataConnected?'Gagal menyimpan ke database':`Mode pratinjau: ${err.message}`);}};
 const saveComment=async(student,comment)=>{const clean=comment.trim().slice(0,500);setStudents(prev=>prev.map(s=>s.id===student.id?{...s,comment:clean}:s));try{await api.saveAttendance(student.id,student.status||'Hadir',attDate,clean||null);setAttendanceVersion(v=>v+1);flash('Catatan tersimpan');}catch(err){flash(dataConnected?'Gagal menyimpan catatan':`Mode pratinjau: ${err.message}`);}};
 const addNote=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const name=f.get('name');const photo=photoFile;const n={id:`n${Date.now()}`,name,type:f.get('type'),text:f.get('text'),photoUrl:photoPreview||null,time:'Baru saja',avatar:initials(name),color:'violet'};setNotes(prev=>[n,...prev]);setNoteBusy(true);try{const saved=await api.addStudentNote(name,f.get('type'),f.get('text'),photo);if(!photo&&saved&&saved.photoUrl)setNotes(prev=>prev.map(x=>x.id===n.id?{...x,photoUrl:saved.photoUrl}:x));flash('Catatan berhasil ditambahkan');}catch(err){flash(dataConnected?'Gagal menyimpan catatan':`Mode pratinjau: ${err.message}`);}finally{setNoteBusy(false);closeNoteModal();}};
 const closeNoteModal=()=>{setModal('');setPhotoFile(null);setPhotoPreview('');};
 const addCategory=async(e)=>{e.preventDefault();const name=newCategory.trim().slice(0,60);if(!name){flash('Nama kategori wajib diisi');return;}if(categories.some(c=>c.name.toLowerCase()===name.toLowerCase())){flash('Kategori itu sudah ada');return;}const color=nextCategoryColor(categories);setCategoryBusy(true);try{const saved=await api.addNoteCategory(name,color);setCategories(prev=>prev.some(c=>c.name.toLowerCase()===name.toLowerCase())?prev:[...prev,{id:saved?.id||`c${Date.now()}`,name:saved?.name||name,color:saved?.color||color}]);setNewCategory('');flash('Kategori berhasil ditambahkan');}catch(err){flash(dataConnected?'Gagal menyimpan kategori':`Mode pratinjau: ${err.message}`);}finally{setCategoryBusy(false);}};
 const removeCategory=async(category)=>{const used=notes.some(n=>n.type===category.name);if(used){flash('Kategori sedang dipakai catatan, tidak bisa dihapus');return;}setCategories(prev=>prev.filter(c=>c.id!==category.id));try{await api.deleteNoteCategory(category.id);flash('Kategori dihapus');}catch(err){flash(dataConnected?'Gagal menghapus kategori':`Mode pratinjau: ${err.message}`);}};
 const handlePhotoChange=(e)=>{const file=e.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png'].includes(file.type)){flash('Hanya file JPG atau PNG yang diizinkan');e.target.value='';return;}if(file.size>5*1024*1024){flash('Ukuran foto melebihi 5 MB');e.target.value='';return;}setPhotoFile(file);setPhotoPreview(URL.createObjectURL(file));};
 const clearPhoto=()=>{if(photoPreview)URL.revokeObjectURL(photoPreview);setPhotoFile(null);setPhotoPreview('');};
 const flash=(message)=>{setNotice(message);setTimeout(()=>setNotice(''),2600);};
 const reloadStudents=async()=>{try{const rows=await api.students();if(rows&&rows.length)setStudents(rows.map(s=>({...s,status:s.status||'Hadir'})));}catch{/* biarkan data saat ini */}};
 const handleImportFile=async(e)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const rows=await readStudentFile(file);if(!rows.length){flash('Tidak ada data siswa pada file');return;}setImportRows(rows);setImportName(file.name);}catch(err){flash(err.message||'Gagal membaca file');}};
 const confirmImport=async()=>{if(!importRows)return;setImportBusy(true);try{const result=await api.importStudents(importRows);await reloadStudents();flash(`${result.inserted} siswa ditambahkan${result.skipped?`, ${result.skipped} dilewati`:''}`);setImportRows(null);}catch(err){flash(dataConnected?'Gagal mengimpor data':`Mode pratinjau: ${err.message}`);}finally{setImportBusy(false);}};
 const removeStudent=async(student)=>{if(!window.confirm(`Hapus ${student.name} dari daftar siswa?`))return;setStudents(prev=>prev.filter(s=>s.id!==student.id));try{await api.deleteStudent(student.id);flash('Siswa dihapus');}catch(err){flash(dataConnected?'Gagal menghapus siswa':`Mode pratinjau: ${err.message}`);await reloadStudents();}};
 const nav=[['Dashboard',LayoutDashboard],['Absensi',ClipboardCheck],['Rekap Bulan',CalendarRange],['Data Siswa',Users],['Catatan',BookOpenText]];
 const changeTab=(name)=>{setTab(name);setMobileMenu(false);};
 return <div className="app-shell">
  {mobileMenu&&<div className="sidebar-overlay" onClick={()=>setMobileMenu(false)} aria-hidden="true"/>}
  <aside className={`sidebar ${mobileMenu?'open':''}`}><div className="brand"><div className="brand-mark"><GraduationCap size={23}/></div><span>kelas<span className="brand-dot">.</span><small>WALI KELAS</small></span></div><div className="school-chip"><div className="school-icon">S</div><div><b>SMA Nusantara</b><small>Tahun Ajaran 2024/2025</small></div><ChevronDown size={16}/></div><p className="nav-label">MENU UTAMA</p><nav>{nav.map(([n,I])=><button key={n} className={`nav-item ${tab===n?'active':''}`} onClick={()=>changeTab(n)}><I size={19}/>{n}{n==='Absensi'&&<span className="nav-count">{students.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Sparkles size={16}/></div><b>Butuh bantuan?</b><p>Temukan tips menggunakan Kelas.</p><button onClick={()=>flash('Pusat bantuan segera hadir')}>Kunjungi pusat bantuan <ArrowUpRight size={14}/></button></div><button className="nav-item" onClick={()=>flash('Pengaturan segera hadir')}><Settings size={19}/>Pengaturan</button><div className="profile"><div className="profile-avatar">IF</div><div><b>ilhamF</b><small>Wali Kelas XI J</small></div><MoreHorizontal size={19}/></div></div></aside>
  <main className="main"><header className="topbar"><button className="mobile-toggle" onClick={()=>setMobileMenu(!mobileMenu)}><Menu/></button><div className="breadcrumbs">Kelas XI J <span>/</span> <b>{tab}</b></div><div className="top-actions"><div className="today-pill"><CalendarDays size={16}/>{dateLabel}</div><button className="icon-btn" aria-label="Notifikasi" onClick={()=>flash('Tidak ada notifikasi baru')}><Bell size={19}/><i/></button><div className="top-avatar">IF</div></div></header>
   <div className="content"><div className="welcome-row"><div><div className="eyebrow">ADMINISTRASI KELAS <span>•</span> SEMESTER GENAP</div><h1>{tab==='Dashboard'?'Selamat pagi, ilhamF':tab==='Absensi'?'Absensi Kehadiran':tab==='Rekap Bulan'?'Rekap Absen Bulanan':tab==='Data Siswa'?'Data Siswa':'Catatan Kelas'} <span className="wave">{tab==='Dashboard'?'👋':''}</span></h1><p className="subtitle">{tab==='Dashboard'?'Semoga harimu menyenangkan. Yuk, pantau perkembangan kelas hari ini.':tab==='Absensi'?'Kelola kehadiran siswa kelas XI J hari ini.':tab==='Rekap Bulan'?'Ringkasan kehadiran seluruh siswa per bulan.':tab==='Data Siswa'?'Informasi lengkap siswa di kelas XI J.':'Simpan hal-hal penting tentang siswa dan kegiatan kelas.'}</p></div><div className="heading-actions"><button className="btn btn-light" onClick={()=>flash('Rekap kehadiran siap diunduh')}><Download size={16}/> Unduh laporan</button><button className="btn btn-primary" onClick={()=>setModal('note')}><Plus size={17}/> Tambah catatan</button></div></div>
   {!dataConnected&&<div className="setup-banner"><div className="setup-bulb">✦</div><div><b>{dataError?'Database belum terhubung':'Mode pratinjau aktif'}</b><p>{dataError?`${dataError}. `:'Hubungkan Neon '} Ikuti langkah setup di <a href="./NEON_SETUP.md" target="_blank">panduan Neon</a>.</p></div><button onClick={()=>flash('Buat file .env dan jalankan server API mengikuti panduan Neon')}>Atur Neon <ArrowUpRight size={15}/></button></div>}
   {tab==='Dashboard'&&<><section className="stat-grid"><article className="stat-card stat-total"><div className="stat-top"><span className="stat-icon"><Users size={19}/></span><span className="trend"><ArrowUpRight size={13}/> 4.8%</span></div><div className="stat-number">{students.length}<small> siswa</small></div><div className="stat-caption">Total siswa terdaftar</div><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon green-icon"><Check size={20}/></span><span className="stat-percent">{Math.round(((counts.Hadir||0)/Math.max(students.length,1))*100)}%</span></div><div className="stat-number">{counts.Hadir||0}<small> siswa</small></div><div className="stat-caption">Hadir hari ini</div><div className="mini-progress"><i style={{width:`${Math.round(((counts.Hadir||0)/Math.max(students.length,1))*100)}%`}}/></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon orange-icon"><Clock3 size={19}/></span><span className="neutral-change">Hari ini</span></div><div className="stat-number">{(counts.Izin||0)+(counts.Sakit||0)}<small> siswa</small></div><div className="stat-caption">Izin & sakit</div><div className="stat-foot"><span className="dot orange-dot"/>{counts.Izin||0} izin <span className="dot blue-dot"/>{counts.Sakit||0} sakit</div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon red-icon"><CircleX size={18}/></span><span className="neutral-change">Hari ini</span></div><div className="stat-number">{counts.Alpa||0}<small> siswa</small></div><div className="stat-caption">Tanpa keterangan</div><div className="stat-foot"><span className="dot red-dot"/>{counts.Alpa?'Perlu tindak lanjut':'Semua siswa terpantau'}</div></article></section>
   <section className="dashboard-grid"><div className="panel attendance-panel"><div className="panel-head"><div><h2>Kehadiran hari ini</h2><p>{dateLabel}</p></div><button className="text-link" onClick={()=>changeTab('Absensi')}>Lihat semua <ArrowUpRight size={15}/></button></div><div className="attendance-summary"><div className="donut"><div><b>{Math.round(((counts.Hadir||0)/Math.max(students.length,1))*100)}<small>%</small></b><span>kehadiran</span></div></div><div className="legend"><div><span className="dot green-dot"/>Hadir <b>{counts.Hadir||0}</b></div><div><span className="dot orange-dot"/>Izin <b>{counts.Izin||0}</b></div><div><span className="dot blue-dot"/>Sakit <b>{counts.Sakit||0}</b></div><div><span className="dot red-dot"/>Alpa <b>{counts.Alpa||0}</b></div><div><span className="dot purple-dot"/>Dispensasi <b>{counts.Dispensasi||0}</b></div></div></div><div className="attendance-bottom"><span><span className="pulse"/>{students.length-(counts.Alpa||0)} dari {students.length} siswa tercatat</span><button onClick={()=>changeTab('Absensi')}>Isi absensi <ArrowUpRight size={14}/></button></div></div>
   <div className="panel note-panel"><div className="panel-head"><div><h2>Catatan terbaru</h2><p>Perhatian kecil, dampak besar ✨</p></div><button className="more-btn" onClick={()=>changeTab('Catatan')}><MoreHorizontal/></button></div><div className="note-list">{notes.slice(0,2).map(n=><div className="note-item" key={n.id}><div className={`student-avatar ${n.color}`}>{n.avatar}</div><div className="note-body"><div className="note-title"><b>{n.name}</b><span className={`tag tag-${categoryColor(categories,n.type)}`}>{n.type}</span></div><p>{n.text}</p>{n.photoUrl&&<img className="note-photo" src={n.photoUrl} alt={`Foto catatan ${n.name}`} loading="lazy"/>}<small>{n.time}</small></div></div>)}</div><button className="add-note-link" onClick={()=>setModal('note')}><Plus size={15}/> Tulis catatan baru</button></div></section>
   <section className="panel students-panel"><div className="panel-head"><div><h2>Daftar siswa</h2><p>Pantau kehadiran siswa kelasmu</p></div><div className="table-tools"><label className="search-box"><Search size={16}/><input placeholder="Cari nama siswa..." value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="filter-btn" onClick={()=>changeTab('Absensi')}>Hari ini <ChevronDown size={15}/></button></div></div><StudentsTable students={filtered.slice(0,5)} saveStatus={saveStatus}/><button className="table-footer" onClick={()=>changeTab('Data Siswa')}>Lihat semua {students.length} siswa <ArrowUpRight size={14}/></button></section></>}
   {tab==='Absensi'&&<section className="panel students-panel full-panel"><div className="panel-head"><div><h2>Daftar kehadiran</h2><p>{attDateLabel} · {students.length} siswa</p></div><div className="table-tools"><label className="search-box"><Search size={16}/><input placeholder="Cari nama siswa..." value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="date-picker"><CalendarDays size={15}/><input type="date" value={attDate} max="2100-12-31" onChange={e=>setAttDate(e.target.value||todayISO())}/></label>{!isToday&&<button type="button" className="btn btn-light" onClick={()=>setAttDate(todayISO())}>Hari ini</button>}</div></div>{!isToday&&<div className="date-banner">Kamu mengisi absensi untuk <b>{attDateLabel}</b>, bukan hari ini.</div>}<StudentsTable students={filtered} saveStatus={saveStatus} saveComment={saveComment}/><div className="attendance-footer"><span><span className="pulse"/> {isToday?'Perubahan tersimpan otomatis':'Absensi tanggal yang dipilih'}</span><button className="btn btn-primary" onClick={()=>flash(isToday?'Absensi hari ini berhasil disimpan':`Absensi ${attDateLabel} berhasil disimpan`)}>Simpan absensi <Check size={16}/></button></div></section>}
   {tab==='Rekap Bulan'&&<RecapView recap={recap} busy={recapBusy} month={recapMonth} view={recapView} onViewChange={setRecapView} onMonthChange={setRecapMonth} onExport={()=>{if(!recap)return;const label=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(`${recap.month||recapMonth}-01T00:00:00`));downloadRecap(recap.students,label).then(()=>flash('Rekap berhasil diunduh')).catch(err=>flash(err.message||'Gagal mengunduh rekap'));}}/>}
    {tab==='Data Siswa'&&<section className="panel students-panel full-panel"><div className="panel-head"><div><h2>Semua siswa</h2><p>{students.length} siswa terdaftar di kelas XI J</p></div><div className="table-tools"><label className="search-box"><Search size={16}/><input placeholder="Cari nama siswa..." value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" className="btn btn-light" onClick={()=>downloadTemplate()}><FileSpreadsheet size={16}/> Template</button><label className={`btn btn-light ${importBusy?'is-disabled':''}`}><Upload size={16}/> Import Excel<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImportFile}/></label></div></div><StudentsTable students={filtered} saveStatus={saveStatus} showStatus={false} onDelete={removeStudent}/></section>}
   {tab==='Catatan'&&<section className="panel notes-page"><div className="panel-head"><div><h2>Catatan kelas</h2><p>Catatan siswa dan informasi kelas</p></div><button className="btn btn-primary" onClick={()=>setModal('note')}><Plus size={16}/> Catatan baru</button></div><div className="class-note-box"><div className="class-note-icon"><Sparkles size={19}/></div><div><b>Catatan wali kelas</b><p>Ruang untuk pengingat atau informasi umum kelas.</p></div></div><textarea className="class-note-input" placeholder="Tulis catatan untuk kelas hari ini..." value={classNote} onChange={e=>setClassNote(e.target.value)}/><div className="class-note-actions"><span>{classNote.length} karakter</span><button className="btn btn-primary" onClick={async()=>{try{await api.addClassNote(classNote);flash('Catatan wali kelas tersimpan');}catch(err){flash(dataConnected?'Gagal menyimpan catatan':`Mode pratinjau: ${err.message}`);}}}>Simpan catatan</button></div><div className="category-manager"><div className="category-head"><div><b>Kategori catatan</b><p>Kategori ini muncul di pilihan saat menambah catatan siswa.</p></div></div><div className="category-list">{categories.map(c=><span key={c.id} className={`category-chip tag tag-${c.color}`}>{c.name}<button type="button" className="category-remove" title={`Hapus kategori ${c.name}`} aria-label={`Hapus kategori ${c.name}`} onClick={()=>removeCategory(c)}><X size={12}/></button></span>)}{!categories.length&&<span className="category-empty">Belum ada kategori.</span>}</div><form className="category-form" onSubmit={addCategory}><input type="text" value={newCategory} maxLength={60} placeholder="Nama kategori baru..." aria-label="Nama kategori baru" onChange={e=>setNewCategory(e.target.value)}/><button type="submit" className="btn btn-primary" disabled={categoryBusy}>{categoryBusy?'Menyimpan...':'Tambah kategori'}</button></form></div><h3 className="subheading">Catatan siswa <span>{notes.length}</span></h3><div className="all-notes">{notes.map(n=><div className="all-note" key={n.id}><div className={`student-avatar ${n.color}`}>{n.avatar}</div><div className="note-body"><div className="note-title"><b>{n.name}</b><span className={`tag tag-${categoryColor(categories,n.type)}`}>{n.type}</span></div><p>{n.text}</p>{n.photoUrl&&<img className="note-photo" src={n.photoUrl} alt={`Foto catatan ${n.name}`} loading="lazy"/>}<small>{n.time}</small></div></div>)}</div></section>}
   <footer className="footer">Dibuat dengan <span>♥</span> untuk pendidikan yang lebih baik <span className="footer-right">Kelas v1.0</span></footer>
   </div></main>
  {modal==='note'&&<div className="modal-backdrop" onClick={closeNoteModal}><form className="modal" onSubmit={addNote} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h2>Tambah catatan siswa</h2><p>Simpan perkembangan atau hal penting tentang siswa.</p></div><button type="button" className="close-btn" onClick={closeNoteModal}><X size={19}/></button></div><label>Nama siswa<select name="name" required>{students.map(s=><option key={s.id}>{s.name}</option>)}</select></label><label>Kategori<select name="type">{categories.map(c=><option key={c.id}>{c.name}</option>)}</select></label><label>Catatan<textarea name="text" placeholder="Tuliskan catatan..." required rows="4"/></label><label>Foto (opsional)<span className="photo-hint">JPG atau PNG, maksimal 5 MB</span>{photoPreview?<div className="photo-preview"><img src={photoPreview} alt="Pratinjau foto catatan"/><button type="button" className="photo-remove" onClick={clearPhoto} aria-label="Hapus foto"><X size={15}/></button></div>:<div className="photo-drop"><Upload size={18}/><span>Pilih file foto</span><input type="file" accept="image/jpeg,image/png" onChange={handlePhotoChange}/></div>}</label><div className="modal-actions"><button type="button" className="btn btn-light" onClick={closeNoteModal} disabled={noteBusy}>Batal</button><button className="btn btn-primary" type="submit" disabled={noteBusy}>{noteBusy?'Menyimpan...':'Simpan catatan'}</button></div></form></div>}
  {importRows&&<div className="modal-backdrop" onClick={()=>!importBusy&&setImportRows(null)}><div className="modal import-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h2>Import data siswa</h2><p>{importRows.length} baris terbaca dari <b>{importName}</b>. Periksa dulu sebelum disimpan.</p></div><button type="button" className="close-btn" onClick={()=>setImportRows(null)} disabled={importBusy}><X size={19}/></button></div><div className="import-file-row"><div className="import-file-icon"><FileSpreadsheet size={20}/></div><div><b>{importName}</b><small>{importRows.length} siswa siap diimpor</small></div><button type="button" className="text-link" onClick={()=>downloadTemplate()}><Download size={14}/> Unduh template</button></div><div className="import-preview"><table><thead><tr><th>NAMA</th><th>NIS</th><th>JK</th></tr></thead><tbody>{importRows.slice(0,6).map((s,i)=><tr key={i}><td>{s.name}</td><td className="muted-cell">{s.nis||'-'}</td><td className="muted-cell">{s.gender||'-'}</td></tr>)}</tbody></table>{importRows.length>6&&<p className="import-more">+{importRows.length-6} baris lainnya</p>}</div><div className="import-hint">NIS yang sudah ada akan dilewati otomatis agar tidak duplikat.</div><div className="modal-actions"><button type="button" className="btn btn-light" onClick={()=>setImportRows(null)} disabled={importBusy}>Batal</button><button className="btn btn-primary" onClick={confirmImport} disabled={importBusy}>{importBusy?'Menyimpan...':`Import ${importRows.length} siswa`}</button></div></div></div>}
   {notice&&<div className="toast"><span><Check size={15}/></span>{notice}</div>}
 </div>
}

function StudentsTable({students,saveStatus,saveComment,showStatus=true,onDelete}){return <div className="table-wrap"><table><thead><tr><th>NAMA SISWA</th><th className="col-nis">NIS</th>{showStatus?<th className="col-status">STATUS KEHADIRAN</th>:<th className="col-gender">JENIS KELAMIN</th>}{showStatus&&<th className="col-gender">JENIS KELAMIN</th>}<th className="action-col">AKSI</th>{showStatus&&<th className="col-comment">CATATAN <span className="col-optional">(opsional)</span></th>}</tr></thead><tbody>{students.map(s=>{const meta=statusMeta[s.status]||statusMeta.Hadir;return <tr key={s.id}><td><div className="student-cell"><div className={`student-avatar ${s.color}`}>{s.avatar}</div><div><b>{s.name}</b><small>Kelas XI J</small></div></div></td><td className="muted-cell col-nis">{s.nis}</td>{showStatus&&<td className="col-status"><span className={`status ${meta.className}`}><meta.icon size={13}/>{s.status}</span></td>}<td className="muted-cell col-gender">{s.gender==='P'?'Perempuan':s.gender==='L'?'Laki-laki':'—'}</td><td className="action-col">{showStatus?<div className="attendance-actions">{Object.entries(statusMeta).map(([status,statusInfo])=>{const StatusIcon=statusInfo.icon;return <button key={status} type="button" aria-label={`${status} untuk ${s.name}`} title={status} className={`action-status ${statusInfo.className} ${s.status===status?'selected':''}`} onClick={()=>saveStatus(s,status)}><StatusIcon size={13}/><span>{status}</span></button>})}</div>:onDelete?<button type="button" className="delete-btn" title={`Hapus ${s.name}`} aria-label={`Hapus ${s.name}`} onClick={()=>onDelete(s)}><Trash2 size={15}/></button>:<span className="muted-cell">—</span>}</td>{showStatus&&<td className="col-comment"><CommentCell value={s.comment||''} onSave={saveComment?(comment)=>saveComment(s,comment):undefined}/></td>}</tr>})}{students.length===0&&<tr><td colSpan={showStatus?6:4} className="empty-state">Tidak ada siswa yang cocok dengan pencarian.</td></tr>}</tbody></table></div>}

function CommentCell({value,onSave}){
 const [draft,setDraft]=useState(value);
 useEffect(()=>{setDraft(value);},[value]);
 if(!onSave)return <span className="muted-cell">—</span>;
 const commit=()=>{if(draft.trim()!==(value||'').trim())onSave(draft);};
 return <input
  className="comment-input"
  type="text"
  value={draft}
  maxLength={500}
  placeholder="Tambah catatan..."
  aria-label="Catatan kehadiran (opsional)"
  onChange={e=>setDraft(e.target.value)}
  onBlur={commit}
  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();e.currentTarget.blur();}}}
 />;
}

function RecapView({recap,busy,month,view,onViewChange,onMonthChange,onExport}){
 const label=month?new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(`${month}-01T00:00:00`)):'';
 const currentMonth=()=>new Date().toISOString().slice(0,7);
 const rows=recap?.students||[];
 const totals=rows.reduce((a,r)=>({hadir:a.hadir+(r.hadir||0),izin:a.izin+(r.izin||0),sakit:a.sakit+(r.sakit||0),alpa:a.alpa+(r.alpa||0),dispensasi:a.dispensasi+(r.dispensasi||0),recorded:a.recorded+(r.recorded||0)}),{hadir:0,izin:0,sakit:0,alpa:0,dispensasi:0,recorded:0});
 const pct=(v)=>totals.recorded?Math.round((v/totals.recorded)*100):0;
 // Bangun daftar tanggal 1..akhir bulan (jumlah hari menyesuaikan bulan & tahun kabisat).
 const days=useMemo(()=>{
  if(!month)return [];
  const [y,m]=month.split('-').map(Number);
  const total=new Date(y,m,0).getDate();
  return Array.from({length:total},(_,i)=>{
   const day=i+1;
   const iso=`${month}-${String(day).padStart(2,'0')}`;
   const weekday=new Intl.DateTimeFormat('id-ID',{weekday:'short'}).format(new Date(`${iso}T00:00:00`));
   const isWeekend=[0,6].includes(new Date(`${iso}T00:00:00`).getDay());
   return {day,iso,weekday,isWeekend};
  });
 },[month]);
 return <section className="panel students-panel full-panel recap-page">
  <div className="panel-head"><div><h2>Rekap absen bulan {label}</h2><p>{rows.length} siswa · {totals.recorded} catatan kehadiran</p></div><div className="table-tools"><div className="view-toggle"><button type="button" className={view==='ringkasan'?'active':''} onClick={()=>onViewChange('ringkasan')}><Users size={14}/> Ringkasan</button><button type="button" className={view==='harian'?'active':''} onClick={()=>onViewChange('harian')}><Table2 size={14}/> Harian</button></div><label className="date-picker"><CalendarDays size={15}/><input type="month" value={month} max="2100-12" onChange={e=>onMonthChange(e.target.value||currentMonth())}/></label><button type="button" className="btn btn-light" onClick={onExport} disabled={!rows.length}><Download size={16}/> Unduh rekap</button></div></div>
  <section className="stat-grid recap-stats"><article className="stat-card"><div className="stat-top"><span className="stat-icon green-icon"><Check size={19}/></span><span className="stat-percent">{pct(totals.hadir)}%</span></div><div className="stat-number">{totals.hadir}<small> catatan</small></div><div className="stat-caption">Hadir sebulan</div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon orange-icon"><Clock3 size={19}/></span><span className="stat-percent">{pct(totals.izin)}%</span></div><div className="stat-number">{totals.izin}<small> catatan</small></div><div className="stat-caption">Izin sebulan</div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon blue-icon"><HeartPulse size={19}/></span><span className="stat-percent">{pct(totals.sakit)}%</span></div><div className="stat-number">{totals.sakit}<small> catatan</small></div><div className="stat-caption">Sakit sebulan</div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon red-icon"><CircleX size={18}/></span><span className="stat-percent">{pct(totals.alpa)}%</span></div><div className="stat-number">{totals.alpa}<small> catatan</small></div><div className="stat-caption">Alpa sebulan</div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon purple-icon"><PlaneTakeoff size={18}/></span><span className="stat-percent">{pct(totals.dispensasi)}%</span></div><div className="stat-number">{totals.dispensasi}<small> catatan</small></div><div className="stat-caption">Dispensasi sebulan</div></article></section>
  {view==='ringkasan'?<div className={`table-wrap recap-table ${busy?'is-loading':''}`}><table><thead><tr><th>NAMA SISWA</th><th className="col-nis">NIS</th><th className="col-recap">HADIR</th><th className="col-recap">IZIN</th><th className="col-recap">SAKIT</th><th className="col-recap">ALPA</th><th className="col-recap">DISPENSASI</th><th className="col-recap">TERCATAT</th><th className="col-recap">% HADIR</th></tr></thead><tbody>
   {rows.map(r=>{const rate=r.recorded?Math.round((r.hadir/r.recorded)*100):0;return <tr key={r.id}><td><div className="student-cell"><div className={`student-avatar ${r.color}`}>{r.avatar}</div><div><b>{r.name}</b><small>Kelas XI J</small></div></div></td><td className="muted-cell col-nis">{r.nis}</td><td className="col-recap recap-hadir">{r.hadir}</td><td className="col-recap recap-izin">{r.izin}</td><td className="col-recap recap-sakit">{r.sakit}</td><td className="col-recap recap-alpa">{r.alpa}</td><td className="col-recap recap-dispensasi">{r.dispensasi}</td><td className="muted-cell col-recap">{r.recorded}</td><td className="col-recap"><span className={`rate ${rate>=80?'rate-good':rate>=60?'rate-warn':'rate-bad'}`}>{rate}%</span></td></tr>;})}
   {busy&&!rows.length&&<tr><td colSpan={9} className="empty-state">Memuat rekap absensi...</td></tr>}
   {!busy&&!rows.length&&<tr><td colSpan={9} className="empty-state">Belum ada data absensi pada bulan ini.</td></tr>}
  </tbody></table></div>
  :<DailyTable rows={rows} days={days} busy={busy}/>}
 </section>;
}

const DAILY_META={Hadir:{className:'present',short:'H'},Izin:{className:'permission',short:'I'},Sakit:{className:'sick',short:'S'},Alpa:{className:'absent',short:'A'},Dispensasi:{className:'dispensation',short:'D'}};

function DailyTable({rows,days,busy}){
 return <div className={`table-wrap daily-wrap ${busy?'is-loading':''}`}><table className="daily-table"><thead>
  <tr className="daily-head">
   <th className="daily-name">NAMA SISWA</th>
   {days.map(d=><th key={d.iso} className={`daily-day ${d.isWeekend?'weekend':''}`}><b>{d.weekday}</b><span>{d.day}</span></th>)}
   <th className="daily-total">HADIR</th>
  </tr>
 </thead><tbody>
  {rows.map(r=><tr key={r.id}>
   <td className="daily-name"><div className="student-cell"><div className={`student-avatar ${r.color}`}>{r.avatar}</div><div><b>{r.name}</b><small>{r.nis||'—'}</small></div></div></td>
   {days.map(d=>{const status=r.daily?.[d.iso];const meta=status?DAILY_META[status]:null;return <td key={d.iso} className={`daily-cell ${d.isWeekend?'weekend':''}`}>{meta?<span className={`day-status ${meta.className}`} title={`${d.day} ${d.weekday} · ${status}`}>{meta.short}</span>:<span className="day-empty">·</span>}</td>;})}
   <td className="daily-total">{r.hadir}</td>
  </tr>)}
  {busy&&!rows.length&&<tr><td colSpan={days.length+2} className="empty-state">Memuat rekap absensi...</td></tr>}
  {!busy&&!rows.length&&<tr><td colSpan={days.length+2} className="empty-state">Belum ada data absensi pada bulan ini.</td></tr>}
 </tbody></table>
 <div className="daily-legend">{Object.entries(DAILY_META).map(([status,meta])=><span key={status}><i className={`day-status ${meta.className}`}>{meta.short}</i>{status}</span>)}<span><i className="day-empty">·</i>Belum diisi</span></div>
 </div>;
}
