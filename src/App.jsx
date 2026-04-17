import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Users, UserCircle, CheckCircle, LogOut, Settings, BarChart3, Plus, Edit, Trash2, ShieldAlert, ArrowLeft } from 'lucide-react';

// --- 1. KONFIGURASI FIREBASE ---
// Sistem otomatis mendeteksi lingkungan Preview (Canvas) atau Vercel.
// Jika di Vercel, pastikan tulisan "API_KEY_ANDA_DISINI" diganti dengan kode asli dari Firebase Anda.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyA7VGzPltIeDFclXzxkCKbj0AbS5j5IrIw",
  authDomain: "epilketos2.firebaseapp.com",
  projectId: "epilketos2",
  storageBucket: "epilketos2.firebasestorage.app",
  messagingSenderId: "743567341665",
  appId: "1:743567341665:web:efd628b3ca3e304f179220",
  measurementId: "G-EQBV0BSFC1"
};

// Inisialisasi Firebase (Mencegah error jika API Key belum diisi)
const app = firebaseConfig.apiKey !== "API_KEY_ANDA_DISINI" ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'epilketos-demo-app';

// Konstanta Kelas & Jabatan
const KELAS_OPTIONS = [
  '7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H', '7I',
  '8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H', '8I',
  '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I',
  'Guru', 'Karyawan'
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State Data
  const [voters, setVoters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  
  // State Navigasi
  const [view, setView] = useState('home'); 
  
  // State Voting
  const [currentVoter, setCurrentVoter] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [loginKelas, setLoginKelas] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // State Admin
  const [adminPin, setAdminPin] = useState('');
  const [adminTab, setAdminTab] = useState('dashboard');
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editingVoter, setEditingVoter] = useState(null);

  // Login Anonim Otomatis untuk Akses Database
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Ambil Data Realtime dari Firestore
  useEffect(() => {
    if (!user || !db) return;

    // Listener Pemilih
    const unsubVoters = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'voters'), (snapshot) => {
      const vData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVoters(vData);
    }, (error) => console.error(error));

    // Listener Kandidat
    const unsubCandidates = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'candidates'), (snapshot) => {
      const cData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      cData.sort((a, b) => (a.number || 0) - (b.number || 0));
      setCandidates(cData);
    }, (error) => console.error(error));

    return () => { unsubVoters(); unsubCandidates(); };
  }, [user]);

  // --- Fungsi Pemilih (Voter) ---
  const handleVoterLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginName.trim() || !loginKelas) {
      setLoginError('Nama dan Kelas/Jabatan tidak boleh kosong!');
      return;
    }
    const voter = voters.find(v => v.name.toLowerCase() === loginName.toLowerCase().trim() && v.kelas === loginKelas);
    
    if (!voter) {
      setLoginError('Nama atau Kelas tidak terdaftar! Pastikan ejaan sesuai.');
      return;
    }
    if (voter.hasVoted) {
      setLoginError('Maaf, Anda sudah menggunakan hak suara!');
      return;
    }
    setCurrentVoter(voter);
    setView('voting');
    setLoginName('');
    setLoginKelas('');
  };

  const castVote = async (candidateId) => {
    if (!currentVoter || !db) return;
    if (!window.confirm('Apakah Anda yakin dengan pilihan ini? Suara tidak dapat diubah.')) return;

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', currentVoter.id), {
        hasVoted: true,
        votedFor: candidateId,
        votedAt: new Date().toISOString()
      });
      setView('success');
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan. Coba lagi.");
    }
  };

  // --- Fungsi Admin ---
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPin === 'hudasukses') {
      setView('admin_dashboard');
      setAdminPin('');
      setLoginError('');
    } else {
      setLoginError('PIN Admin salah!');
    }
  };

  const saveCandidate = async (e) => {
    e.preventDefault();
    if (!db) return;
    const formData = new FormData(e.target);
    const candidateData = {
      number: parseInt(formData.get('number')),
      name: formData.get('name'),
      photoUrl: formData.get('photoUrl') || 'https://via.placeholder.com/150?text=No+Photo',
      vision: formData.get('vision'),
      mission: formData.get('mission')
    };
    try {
      if (editingCandidate?.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', editingCandidate.id), candidateData);
      } else {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', `cand_${Date.now()}`), candidateData);
      }
      setEditingCandidate(null);
    } catch (error) { console.error(error); }
  };

  const deleteCandidate = async (id) => {
    if (!db) return;
    if(window.confirm('Hapus kandidat ini?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', id));
  };

  const saveVoter = async (e) => {
    e.preventDefault();
    if (!db) return;
    const formData = new FormData(e.target);
    const nis = formData.get('nis');
    if (!editingVoter && voters.find(v => v.nis === nis)) {
      alert('NIS/NIP sudah terdaftar!');
      return;
    }
    const voterData = {
      nis: nis,
      name: formData.get('name'),
      kelas: formData.get('kelas'),
      hasVoted: editingVoter ? editingVoter.hasVoted : false,
      votedFor: editingVoter ? editingVoter.votedFor : null
    };
    try {
      if (editingVoter?.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', editingVoter.id), voterData);
      } else {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', `voter_${Date.now()}`), voterData);
      }
      setEditingVoter(null);
    } catch (error) { console.error(error); }
  };

  const deleteVoter = async (id) => {
    if (!db) return;
    if(window.confirm('Hapus pemilih ini?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', id));
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file || !db) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rows = event.target.result.split('\n');
        let importedCount = 0;
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i].trim()) continue;
          const cols = rows[i].split(','); 
          if (cols.length >= 3) {
            const nis = cols[0].trim();
            const name = cols[1].trim();
            const kelas = cols[2].trim();
            if (name && !voters.find(v => v.nis === nis)) {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', `voter_${Date.now()}_${Math.random().toString(36).substring(2,7)}`), {
                nis: nis || `N-${Date.now()}`, name: name, kelas: kelas, hasVoted: false, votedFor: null
              });
              importedCount++;
            }
          }
        }
        alert(`Berhasil mengimpor ${importedCount} data pemilih baru!`);
      } catch (error) { alert("Gagal impor. Pastikan file berformat CSV."); }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const generateSampleVoters = async () => {
    if (!db) return;
    if(window.confirm('Buat data sampel pemilih?')) {
      const sampleData = [{ nis: '1001', name: 'Budi Santoso', kelas: '7A' }, { nis: '1002', name: 'Siti Aminah', kelas: '8B' }, { nis: '1980', name: 'Bpk. Supriyadi', kelas: 'Guru' }];
      for (const s of sampleData) {
        if (!voters.find(v => v.nis === s.nis)) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', `voter_${Math.random().toString(36).substr(2, 9)}`), { ...s, hasVoted: false, votedFor: null });
        }
      }
    }
  };

  // --- UI Components ---
  if (!app) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-600 p-6 text-center">
      <ShieldAlert size={48} className="mb-4" />
      <h2 className="text-xl font-bold mb-2">Aplikasi Menunggu Konfigurasi</h2>
      <p>Jika Anda menjalankan aplikasi ini secara mandiri (misal di Vercel), mohon pastikan baris <b>firebaseConfig</b> di dalam kode sudah diisi dengan API Key yang benar dari Firebase Console Anda.</p>
    </div>
  );
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-blue-50 font-bold">Memuat Sistem e-Pilketos...</div>;

  const totalVoters = voters.length;
  const votedCount = voters.filter(v => v.hasVoted).length;
  const participationRate = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserCircle size={32} />
            <div>
              <h1 className="text-xl font-bold leading-tight">e-Pilketos</h1>
              <p className="text-xs text-blue-100">Pemilihan Ketua OSIS Digital</p>
            </div>
          </div>
          {view === 'voting' && currentVoter && (
            <div className="flex items-center gap-4 text-sm bg-blue-700 py-1 px-3 rounded-full">
              <span>Halo, <strong>{currentVoter.name}</strong> ({currentVoter.kelas})</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 py-8">
        
        {view === 'home' && (
          <div className="flex flex-col items-center justify-center mt-12 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-extrabold text-slate-800">Selamat Datang di e-Pilketos</h2>
              <p className="text-slate-600 max-w-md mx-auto">Gunakan hak suara Anda untuk memilih pemimpin masa depan sekolah kita.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
              <button onClick={() => setView('voter_login')} className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-400 transition-all">
                <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4"><Users size={48} /></div>
                <h3 className="text-xl font-bold">Masuk Sebagai Pemilih</h3>
                <p className="text-sm text-slate-500 mt-2 text-center">Siswa, Guru, & Karyawan</p>
              </button>
              <button onClick={() => setView('admin_login')} className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-amber-400 transition-all">
                <div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4"><Settings size={48} /></div>
                <h3 className="text-xl font-bold">Panel Admin</h3>
                <p className="text-sm text-slate-500 mt-2 text-center">Kelola Kandidat & DPT</p>
              </button>
            </div>
          </div>
        )}

        {view === 'voter_login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-md border border-slate-100 mt-12">
            <button onClick={() => setView('home')} className="flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6"><ArrowLeft size={16} className="mr-1" /> Kembali</button>
            <h2 className="text-2xl font-bold mb-6 text-center">Login Bilik Suara</h2>
            <form onSubmit={handleVoterLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
                <input type="text" value={loginName} onChange={(e) => setLoginName(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Masukkan Nama Anda" required/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kelas/Jabatan</label>
                <select value={loginKelas} onChange={(e) => setLoginKelas(e.target.value)} className="w-full p-3 border rounded-lg bg-white outline-none" required>
                  <option value="">-- Pilih --</option>
                  {KELAS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {loginError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{loginError}</div>}
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">Masuk ke Bilik Suara</button>
            </form>
          </div>
        )}

        {view === 'voting' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Pilih Kandidat Ketua OSIS</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map(cand => (
                <div key={cand.id} className="bg-white rounded-2xl overflow-hidden shadow-md flex flex-col border border-slate-100">
                  <div className="h-64 bg-slate-200 relative">
                    <img src={cand.photoUrl} alt={cand.name} className="w-full h-full object-cover" />
                    <div className="absolute top-4 left-4 bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-full font-bold shadow-lg text-xl border-2 border-white">{cand.number}</div>
                  </div>
                  <div className="p-6 flex-grow flex flex-col">
                    <h3 className="text-2xl font-bold mb-4">{cand.name}</h3>
                    <div className="mb-4"><h4 className="text-sm font-bold text-slate-500 mb-1">Visi</h4><p className="text-sm">{cand.vision}</p></div>
                    <div className="mb-6 flex-grow"><h4 className="text-sm font-bold text-slate-500 mb-1">Misi</h4><p className="text-sm whitespace-pre-line">{cand.mission}</p></div>
                    <button onClick={() => castVote(cand.id)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-md">Pilih Kandidat No. {cand.number}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'success' && (
          <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-lg border border-green-100 text-center mt-12">
            <CheckCircle size={80} className="text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Terima Kasih!</h2>
            <p className="text-slate-600 mb-8">Suara Anda telah direkam secara rahasia.</p>
            <button onClick={() => { setCurrentVoter(null); setView('home'); }} className="bg-slate-100 text-slate-700 font-bold py-3 px-8 rounded-full hover:bg-slate-200">Keluar</button>
          </div>
        )}

        {view === 'admin_login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-md border border-slate-100 mt-12">
            <button onClick={() => setView('home')} className="flex items-center text-sm text-slate-500 mb-6"><ArrowLeft size={16} className="mr-1" /> Kembali</button>
            <div className="flex justify-center mb-4"><ShieldAlert size={48} className="text-amber-500" /></div>
            <h2 className="text-2xl font-bold mb-6 text-center">Login Administrator</h2>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} className="w-full p-3 border rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-amber-500 outline-none" placeholder="••••••••" required />
              {loginError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded text-center">{loginError}</div>}
              <button type="submit" className="w-full bg-amber-500 text-white font-bold py-3 rounded-lg hover:bg-amber-600">Masuk</button>
            </form>
          </div>
        )}

        {view === 'admin_dashboard' && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-64 flex-shrink-0 space-y-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold mb-4 px-2">Menu Admin</h3>
              <button onClick={() => setAdminTab('dashboard')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 mb-1 ${adminTab === 'dashboard' ? 'bg-amber-100 text-amber-700 font-bold' : 'hover:bg-slate-100'}`}><BarChart3 size={18}/> Ringkasan</button>
              <button onClick={() => setAdminTab('candidates')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 mb-1 ${adminTab === 'candidates' ? 'bg-amber-100 text-amber-700 font-bold' : 'hover:bg-slate-100'}`}><UserCircle size={18}/> Kandidat</button>
              <button onClick={() => setAdminTab('voters')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 mb-4 ${adminTab === 'voters' ? 'bg-amber-100 text-amber-700 font-bold' : 'hover:bg-slate-100'}`}><Users size={18}/> Data Pemilih</button>
              <hr className="mb-4"/><button onClick={() => setView('home')} className="w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 text-red-600 hover:bg-red-50"><LogOut size={18}/> Keluar Admin</button>
            </div>

            <div className="flex-grow bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {adminTab === 'dashboard' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Ringkasan Pemilihan</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-xl"><p className="text-sm font-semibold text-blue-600">Total DPT</p><p className="text-3xl font-bold text-blue-800">{totalVoters}</p></div>
                    <div className="bg-green-50 p-4 rounded-xl"><p className="text-sm font-semibold text-green-600">Sudah Memilih</p><p className="text-3xl font-bold text-green-800">{votedCount}</p></div>
                    <div className="bg-amber-50 p-4 rounded-xl"><p className="text-sm font-semibold text-amber-600">Partisipasi</p><p className="text-3xl font-bold text-amber-800">{participationRate}%</p></div>
                  </div>
                  <h3 className="text-xl font-bold mb-4">Perolehan Suara</h3>
                  <div className="space-y-4">
                    {candidates.map(cand => {
                      const candVotes = voters.filter(v => v.votedFor === cand.id).length;
                      const candPercent = votedCount > 0 ? Math.round((candVotes / votedCount) * 100) : 0;
                      return (
                        <div key={cand.id} className="border p-4 rounded-lg flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 text-blue-800 font-bold rounded-full flex items-center justify-center text-xl">{cand.number}</div>
                          <div className="flex-grow">
                            <div className="flex justify-between mb-1"><span className="font-bold">{cand.name}</span><span className="font-bold text-blue-600">{candVotes} Suara ({candPercent}%)</span></div>
                            <div className="w-full bg-slate-100 rounded-full h-3"><div className="bg-blue-500 h-3 rounded-full" style={{ width: `${candPercent}%` }}></div></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {adminTab === 'candidates' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Kelola Kandidat</h2>
                    <button onClick={() => setEditingCandidate({})} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-bold text-sm"><Plus size={16}/> Tambah</button>
                  </div>
                  {editingCandidate !== null && (
                    <form onSubmit={saveCandidate} className="bg-slate-50 p-6 rounded-xl border mb-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">No. Urut</label><input type="number" name="number" defaultValue={editingCandidate.number} className="w-full p-2 border rounded" required /></div>
                        <div><label className="block text-sm font-medium mb-1">Nama</label><input type="text" name="name" defaultValue={editingCandidate.name} className="w-full p-2 border rounded" required /></div>
                      </div>
                      <div><label className="block text-sm font-medium mb-1">URL Foto</label><input type="url" name="photoUrl" defaultValue={editingCandidate.photoUrl} className="w-full p-2 border rounded text-sm" /></div>
                      <div><label className="block text-sm font-medium mb-1">Visi</label><textarea name="vision" defaultValue={editingCandidate.vision} className="w-full p-2 border rounded h-16" required></textarea></div>
                      <div><label className="block text-sm font-medium mb-1">Misi</label><textarea name="mission" defaultValue={editingCandidate.mission} className="w-full p-2 border rounded h-24" required></textarea></div>
                      <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingCandidate(null)} className="px-4 py-2 bg-slate-200 rounded">Batal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Simpan</button></div>
                    </form>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-slate-100 border-b"><th className="p-3 w-16 text-center">No</th><th className="p-3">Nama</th><th className="p-3 w-24 text-center">Aksi</th></tr></thead>
                      <tbody>
                        {candidates.map(cand => (
                          <tr key={cand.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 text-center font-bold text-xl">{cand.number}</td><td className="p-3 font-bold">{cand.name}</td>
                            <td className="p-3 text-center">
                              <button onClick={() => setEditingCandidate(cand)} className="text-blue-500 mx-1"><Edit size={16}/></button>
                              <button onClick={() => deleteCandidate(cand.id)} className="text-red-500 mx-1"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {adminTab === 'voters' && (
                <div>
                  <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                    <h2 className="text-2xl font-bold">Data Pemilih</h2>
                    <div className="flex gap-2">
                      <label className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-emerald-700">Import CSV <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" /></label>
                      <button onClick={generateSampleVoters} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold">Generate Sample</button>
                      <button onClick={() => setEditingVoter({})} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={16}/> Tambah</button>
                    </div>
                  </div>
                  
                  {editingVoter !== null && (
                    <form onSubmit={saveVoter} className="bg-slate-50 p-6 rounded-xl border mb-6 flex flex-col md:flex-row gap-4 items-end">
                      <div className="w-full"><label className="block text-sm mb-1">NIS/NIP</label><input type="text" name="nis" defaultValue={editingVoter.nis} readOnly={!!editingVoter.id} className="w-full p-2 border rounded" required /></div>
                      <div className="w-full"><label className="block text-sm mb-1">Nama</label><input type="text" name="name" defaultValue={editingVoter.name} className="w-full p-2 border rounded" required /></div>
                      <div className="w-full"><label className="block text-sm mb-1">Kelas</label><select name="kelas" defaultValue={editingVoter.kelas||'7A'} className="w-full p-2 border rounded bg-white">{KELAS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                      <div className="flex gap-2"><button type="button" onClick={()=>setEditingVoter(null)} className="px-4 py-2 bg-slate-200 rounded">Batal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Simpan</button></div>
                    </form>
                  )}

                  <div className="max-h-96 overflow-y-auto border rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-100 shadow-sm border-b">
                        <tr><th className="p-3">NIS/NIP</th><th className="p-3">Nama</th><th className="p-3">Kelas</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Aksi</th></tr>
                      </thead>
                      <tbody>
                        {voters.map(v => (
                          <tr key={v.id} className="border-b hover:bg-slate-50 text-sm">
                            <td className="p-3 font-mono">{v.nis}</td><td className="p-3 font-semibold">{v.name}</td><td className="p-3">{v.kelas}</td>
                            <td className="p-3 text-center">{v.hasVoted ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Sudah</span> : <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">Belum</span>}</td>
                            <td className="p-3 text-center">
                              <button onClick={() => setEditingVoter(v)} className="text-blue-500 mx-1"><Edit size={16}/></button>
                              <button onClick={() => deleteVoter(v.id)} className="text-red-500 mx-1"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
