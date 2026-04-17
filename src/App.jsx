import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Users, UserCircle, CheckCircle, LogOut, Settings, BarChart3, Plus, Edit, Trash2, ShieldAlert, ArrowLeft } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyA7VGzPltIeDFclXzxkCKbj0AbS5j5IrIw",
  authDomain: "epilketos2.firebaseapp.com",
  projectId: "epilketos2",
  storageBucket: "epilketos2.firebasestorage.app",
  messagingSenderId: "743567341665",
  appId: "1:743567341665:web:efd628b3ca3e304f179220",
  measurementId: "G-EQBV0BSFC1"
};

// Konstanta Kelas & Jabatan
const KELAS_OPTIONS = [
  '7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H', '7I',
  '8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H', '8I',
  '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I',
  'Guru', 'Karyawan'
];

export default function EpilketosApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State Data
  const [voters, setVoters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  
  // State Navigasi
  const [view, setView] = useState('home'); // home, voter_login, voting, success, admin_login, admin_dashboard
  
  // State Voting
  const [currentVoter, setCurrentVoter] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [loginKelas, setLoginKelas] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // State Admin
  const [adminPin, setAdminPin] = useState('');
  const [adminTab, setAdminTab] = useState('dashboard'); // dashboard, candidates, voters
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editingVoter, setEditingVoter] = useState(null);

  // Inisialisasi Auth
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

  // Fetch Data Firestore
  useEffect(() => {
    if (!user || !db) return;

    // Listener Pemilih
    const votersRef = collection(db, 'artifacts', appId, 'public', 'data', 'voters');
    const unsubVoters = onSnapshot(votersRef, (snapshot) => {
      const vData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVoters(vData);
    }, (error) => console.error("Error fetching voters:", error));

    // Listener Kandidat
    const candidatesRef = collection(db, 'artifacts', appId, 'public', 'data', 'candidates');
    const unsubCandidates = onSnapshot(candidatesRef, (snapshot) => {
      const cData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Urutkan berdasarkan nomor urut (jika ada)
      cData.sort((a, b) => (a.number || 0) - (b.number || 0));
      setCandidates(cData);
    }, (error) => console.error("Error fetching candidates:", error));

    return () => {
      unsubVoters();
      unsubCandidates();
    };
  }, [user]);

  // --- Fungsi Pemilih (Voter) ---
  const handleVoterLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (!loginName.trim() || !loginKelas) {
      setLoginError('Nama dan Kelas/Jabatan tidak boleh kosong!');
      return;
    }

    // Cari berdasarkan nama (tidak peka huruf besar/kecil) dan kelas
    const voter = voters.find(v => 
      v.name.toLowerCase() === loginName.toLowerCase().trim() && 
      v.kelas === loginKelas
    );
    
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
    const confirmVote = window.confirm('Apakah Anda yakin dengan pilihan ini? Suara tidak dapat diubah.');
    if (!confirmVote) return;

    try {
      const voterRef = doc(db, 'artifacts', appId, 'public', 'data', 'voters', currentVoter.id);
      await updateDoc(voterRef, {
        hasVoted: true,
        votedFor: candidateId,
        votedAt: new Date().toISOString()
      });
      setView('success');
    } catch (error) {
      console.error("Error voting:", error);
      alert("Terjadi kesalahan. Coba lagi.");
    }
  };

  const handleLogoutVoter = () => {
    setCurrentVoter(null);
    setView('home');
  };

  // --- Fungsi Admin ---
  const handleAdminLogin = (e) => {
    e.preventDefault();
    // PIN Admin
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
        const newId = `cand_${Date.now()}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', newId), candidateData);
      }
      setEditingCandidate(null);
    } catch (error) {
      console.error("Error saving candidate:", error);
    }
  };

  const deleteCandidate = async (id) => {
    if(window.confirm('Hapus kandidat ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', id));
    }
  };

  const saveVoter = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const nis = formData.get('nis');
    
    // Cek duplikasi NIS
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
        const newId = `voter_${Date.now()}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', newId), voterData);
      }
      setEditingVoter(null);
    } catch (error) {
      console.error("Error saving voter:", error);
    }
  };

  const deleteVoter = async (id) => {
    if(window.confirm('Hapus pemilih ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', id));
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n');
        let importedCount = 0;
        
        // Asumsi baris 1 adalah header (cth: NIS,Nama,Kelas), perulangan mulai dari index 1
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i].trim()) continue;
          
          // Pisahkan kolom berdasarkan koma
          const cols = rows[i].split(','); 
          if (cols.length >= 3) {
            const nis = cols[0].trim();
            const name = cols[1].trim();
            const kelas = cols[2].trim();
            
            // Masukkan data jika nama ada dan NIS belum terdaftar
            if (name && !voters.find(v => v.nis === nis)) {
              const newId = `voter_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', newId), {
                nis: nis || `N-${Date.now()}`,
                name: name,
                kelas: kelas,
                hasVoted: false,
                votedFor: null
              });
              importedCount++;
            }
          }
        }
        alert(`Berhasil mengimpor ${importedCount} data pemilih baru!`);
      } catch (error) {
        console.error("Import error:", error);
        alert("Gagal impor. Pastikan file berformat CSV dengan urutan: NIS, Nama, Kelas.");
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input setelah diunggah
  };

  const generateSampleVoters = async () => {
    if(window.confirm('Ini akan membuat beberapa data sampel pemilih. Lanjutkan?')) {
      const sampleData = [
        { nis: '1001', name: 'Budi Santoso', kelas: '7A' },
        { nis: '1002', name: 'Siti Aminah', kelas: '8B' },
        { nis: '1003', name: 'Andi Saputra', kelas: '9C' },
        { nis: '1980', name: 'Bpk. Supriyadi', kelas: 'Guru' }
      ];
      
      for (const s of sampleData) {
        if (!voters.find(v => v.nis === s.nis)) {
          const newId = `voter_${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', newId), {
            ...s, hasVoted: false, votedFor: null
          });
        }
      }
      alert('Data sampel berhasil ditambahkan!');
    }
  };

  // --- UI Components ---
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-blue-50">Memuat Sistem e-Pilketos...</div>;
  if (!app) return <div className="min-h-screen flex items-center justify-center text-red-500">Error: Firebase tidak terkonfigurasi.</div>;

  const totalVoters = voters.length;
  const votedCount = voters.filter(v => v.hasVoted).length;
  const unvotedCount = totalVoters - votedCount;
  const participationRate = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header Utama */}
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
        
        {/* VIEW: HOME (Pilihan Login) */}
        {view === 'home' && (
          <div className="flex flex-col items-center justify-center mt-12 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-extrabold text-slate-800">Selamat Datang di e-Pilketos</h2>
              <p className="text-slate-600 max-w-md mx-auto">Gunakan hak suara Anda untuk memilih pemimpin masa depan sekolah kita. Pilih jalur masuk Anda di bawah ini.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
              <button 
                onClick={() => setView('voter_login')}
                className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-400 transition-all group"
              >
                <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                  <Users size={48} />
                </div>
                <h3 className="text-xl font-bold">Masuk Sebagai Pemilih</h3>
                <p className="text-sm text-slate-500 mt-2 text-center">Siswa (7A-9I), Guru, & Karyawan</p>
              </button>

              <button 
                onClick={() => setView('admin_login')}
                className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-amber-400 transition-all group"
              >
                <div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4 group-hover:scale-110 transition-transform">
                  <Settings size={48} />
                </div>
                <h3 className="text-xl font-bold">Panel Admin</h3>
                <p className="text-sm text-slate-500 mt-2 text-center">Kelola Kandidat & Data Pemilih</p>
              </button>
            </div>
          </div>
        )}

        {/* VIEW: LOGIN PEMILIH */}
        {view === 'voter_login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-md border border-slate-100 mt-12">
            <button onClick={() => setView('home')} className="flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6">
              <ArrowLeft size={16} className="mr-1" /> Kembali
            </button>
            <h2 className="text-2xl font-bold mb-6 text-center">Login Bilik Suara</h2>
            <form onSubmit={handleVoterLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap Pemilih</label>
                <input 
                  type="text" 
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Masukkan Nama Anda Sesuai Data"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kelas / Jabatan</label>
                <select 
                  value={loginKelas}
                  onChange={(e) => setLoginKelas(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">-- Pilih Kelas/Jabatan --</option>
                  {KELAS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {loginError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{loginError}</div>}
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">
                Masuk ke Bilik Suara
              </button>
            </form>
          </div>
        )}

        {/* VIEW: VOTING (Bilik Suara) */}
        {view === 'voting' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Pilih Kandidat Ketua OSIS</h2>
              <p className="text-slate-600">Pelajari Visi & Misi, lalu klik "Pilih Kandidat" pada pilihan Anda.</p>
            </div>

            {candidates.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-xl shadow">Belum ada kandidat yang terdaftar.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map(cand => (
                  <div key={cand.id} className="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 flex flex-col">
                    <div className="h-64 bg-slate-200 relative">
                      <img src={cand.photoUrl} alt={cand.name} className="w-full h-full object-cover" onError={(e) => e.target.src='https://via.placeholder.com/300x400?text=Foto'} />
                      <div className="absolute top-4 left-4 bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-full text-2xl font-bold shadow-lg border-2 border-white">
                        {cand.number}
                      </div>
                    </div>
                    <div className="p-6 flex-grow flex flex-col">
                      <h3 className="text-2xl font-bold mb-4">{cand.name}</h3>
                      <div className="mb-4">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Visi</h4>
                        <p className="text-sm text-slate-700">{cand.vision}</p>
                      </div>
                      <div className="mb-6 flex-grow">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Misi</h4>
                        <p className="text-sm text-slate-700 whitespace-pre-line">{cand.mission}</p>
                      </div>
                      <button 
                        onClick={() => castVote(cand.id)}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-md"
                      >
                        Pilih Kandidat No. {cand.number}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: SUCCESS */}
        {view === 'success' && (
          <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-lg border border-green-100 text-center mt-12">
            <CheckCircle size={80} className="text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Terima Kasih!</h2>
            <p className="text-slate-600 mb-8">Suara Anda telah berhasil direkam ke dalam sistem secara rahasia dan aman.</p>
            <button 
              onClick={handleLogoutVoter}
              className="bg-slate-100 text-slate-700 font-bold py-3 px-8 rounded-full hover:bg-slate-200 transition"
            >
              Keluar
            </button>
          </div>
        )}

        {/* VIEW: ADMIN LOGIN */}
        {view === 'admin_login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-md border border-slate-100 mt-12">
            <button onClick={() => setView('home')} className="flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6">
              <ArrowLeft size={16} className="mr-1" /> Kembali
            </button>
            <div className="flex justify-center mb-4">
              <ShieldAlert size={48} className="text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center">Login Administrator</h2>
            <p className="text-sm text-slate-500 text-center mb-6">Gunakan PIN: <strong>hudasukses</strong></p>
            
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <input 
                  type="password" 
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>
              {loginError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded text-center">{loginError}</div>}
              <button type="submit" className="w-full bg-amber-500 text-white font-bold py-3 rounded-lg hover:bg-amber-600 transition">
                Masuk Dashboard
              </button>
            </form>
          </div>
        )}

        {/* VIEW: ADMIN DASHBOARD */}
        {view === 'admin_dashboard' && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar Admin */}
            <div className="w-full md:w-64 flex-shrink-0 space-y-2">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4 px-2">Menu Admin</h3>
                <button onClick={() => setAdminTab('dashboard')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 mb-1 ${adminTab === 'dashboard' ? 'bg-amber-100 text-amber-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <BarChart3 size={18} /> Ringkasan
                </button>
                <button onClick={() => setAdminTab('candidates')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 mb-1 ${adminTab === 'candidates' ? 'bg-amber-100 text-amber-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <UserCircle size={18} /> Kandidat
                </button>
                <button onClick={() => setAdminTab('voters')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 mb-4 ${adminTab === 'voters' ? 'bg-amber-100 text-amber-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Users size={18} /> Data Pemilih
                </button>
                <hr className="mb-4 border-slate-100"/>
                <button onClick={() => setView('home')} className="w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 text-red-600 hover:bg-red-50">
                  <LogOut size={18} /> Keluar Admin
                </button>
              </div>
            </div>

            {/* Konten Admin */}
            <div className="flex-grow bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              
              {/* TAB: DASHBOARD */}
              {adminTab === 'dashboard' && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Ringkasan Pemilihan</h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-sm text-blue-600 font-semibold mb-1">Total DPT (Pemilih)</p>
                      <p className="text-3xl font-bold text-blue-800">{totalVoters}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <p className="text-sm text-green-600 font-semibold mb-1">Sudah Memilih</p>
                      <p className="text-3xl font-bold text-green-800">{votedCount}</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <p className="text-sm text-amber-600 font-semibold mb-1">Belum Memilih</p>
                      <p className="text-3xl font-bold text-amber-800">{unvotedCount}</p>
                    </div>
                  </div>

                  <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span>Partisipasi Pemilih</span>
                      <span>{participationRate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-4">
                      <div className="bg-blue-600 h-4 rounded-full transition-all duration-1000" style={{ width: `${participationRate}%` }}></div>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-4">Perolehan Suara Sementara</h3>
                  <div className="space-y-4">
                    {candidates.map(cand => {
                      const candVotes = voters.filter(v => v.votedFor === cand.id).length;
                      const candPercent = votedCount > 0 ? Math.round((candVotes / votedCount) * 100) : 0;
                      return (
                        <div key={cand.id} className="border border-slate-200 p-4 rounded-lg flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 text-blue-800 font-bold rounded-full flex items-center justify-center flex-shrink-0 text-xl">
                            {cand.number}
                          </div>
                          <div className="flex-grow">
                            <div className="flex justify-between mb-1">
                              <span className="font-bold">{cand.name}</span>
                              <span className="font-bold text-blue-600">{candVotes} Suara ({candPercent}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3">
                              <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${candPercent}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* TAB: KANDIDAT */}
              {adminTab === 'candidates' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Kelola Kandidat</h2>
                    <button 
                      onClick={() => setEditingCandidate({})}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm font-bold"
                    >
                      <Plus size={16} /> Tambah Kandidat
                    </button>
                  </div>

                  {editingCandidate !== null && (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                      <h3 className="font-bold mb-4">{editingCandidate.id ? 'Edit Kandidat' : 'Kandidat Baru'}</h3>
                      <form onSubmit={saveCandidate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Nomor Urut</label>
                            <input type="number" name="number" defaultValue={editingCandidate.number || ''} required className="w-full p-2 border rounded" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
                            <input type="text" name="name" defaultValue={editingCandidate.name || ''} required className="w-full p-2 border rounded" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">URL Foto (Link Gambar)</label>
                          <input type="url" name="photoUrl" defaultValue={editingCandidate.photoUrl || ''} placeholder="https://..." className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Visi</label>
                          <textarea name="vision" defaultValue={editingCandidate.vision || ''} required className="w-full p-2 border rounded h-20"></textarea>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Misi</label>
                          <textarea name="mission" defaultValue={editingCandidate.mission || ''} required className="w-full p-2 border rounded h-32"></textarea>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <button type="button" onClick={() => setEditingCandidate(null)} className="px-4 py-2 text-slate-600 bg-slate-200 rounded">Batal</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Simpan</button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="p-3 w-16 text-center">No.</th>
                          <th className="p-3">Foto & Nama</th>
                          <th className="p-3">Visi</th>
                          <th className="p-3 w-24 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map(cand => (
                          <tr key={cand.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 text-center font-bold text-xl text-slate-400">{cand.number}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <img src={cand.photoUrl} alt="Foto" className="w-10 h-10 rounded-full object-cover border" />
                                <span className="font-bold">{cand.name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-sm text-slate-600 line-clamp-2">{cand.vision}</td>
                            <td className="p-3">
                              <div className="flex justify-center gap-2">
                                <button onClick={() => setEditingCandidate(cand)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded"><Edit size={16} /></button>
                                <button onClick={() => deleteCandidate(cand.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {candidates.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-slate-500">Belum ada data kandidat.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: PEMILIH */}
              {adminTab === 'voters' && (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold">Data Pemilih (DPT)</h2>
                    <div className="flex flex-wrap gap-2">
                      <label className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-emerald-700 font-semibold cursor-pointer flex items-center gap-2 transition">
                        <span>Import CSV (Excel)</span>
                        <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                      </label>
                      <button onClick={generateSampleVoters} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-300 font-semibold">
                        Generate Sample
                      </button>
                      <button 
                        onClick={() => setEditingVoter({})}
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm font-bold"
                      >
                        <Plus size={16} /> Tambah Pemilih
                      </button>
                    </div>
                  </div>

                  {editingVoter !== null && (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                      <h3 className="font-bold mb-4">{editingVoter.id ? 'Edit Pemilih' : 'Pemilih Baru'}</h3>
                      <form onSubmit={saveVoter} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                          <label className="block text-sm font-medium mb-1">NIS / NIP</label>
                          <input type="text" name="nis" defaultValue={editingVoter.nis || ''} readOnly={!!editingVoter.id} className={`w-full p-2 border rounded ${editingVoter.id ? 'bg-slate-100' : ''}`} required />
                        </div>
                        <div className="flex-[2] w-full">
                          <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
                          <input type="text" name="name" defaultValue={editingVoter.name || ''} className="w-full p-2 border rounded" required />
                        </div>
                        <div className="flex-1 w-full">
                          <label className="block text-sm font-medium mb-1">Kelas/Jabatan</label>
                          <select name="kelas" defaultValue={editingVoter.kelas || '7A'} className="w-full p-2 border rounded bg-white">
                            {KELAS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button type="button" onClick={() => setEditingVoter(null)} className="px-4 py-2 text-slate-600 bg-slate-200 rounded w-full md:w-auto">Batal</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold w-full md:w-auto">Simpan</button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="mb-4 bg-amber-50 text-amber-800 p-3 rounded text-sm border border-amber-200">
                    Sistem dapat menangani ratusan pemilih (7A-9I, Guru, Karyawan). Tambahkan secara manual atau gunakan tombol Generate Sample untuk uji coba.
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 shadow-sm">
                          <tr>
                            <th className="p-3 w-24">NIS/NIP</th>
                            <th className="p-3">Nama</th>
                            <th className="p-3 w-24">Kelas</th>
                            <th className="p-3 w-32 text-center">Status</th>
                            <th className="p-3 w-24 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voters.map(v => (
                            <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="p-3 font-mono text-sm">{v.nis}</td>
                              <td className="p-3 font-semibold text-sm">{v.name}</td>
                              <td className="p-3 text-sm">{v.kelas}</td>
                              <td className="p-3 text-center">
                                {v.hasVoted 
                                  ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Sudah</span>
                                  : <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">Belum</span>
                                }
                              </td>
                              <td className="p-3">
                                <div className="flex justify-center gap-2">
                                  <button onClick={() => setEditingVoter(v)} className="text-blue-500 hover:text-blue-700"><Edit size={16} /></button>
                                  <button onClick={() => deleteVoter(v.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {voters.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-slate-500">Belum ada data pemilih.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-bold text-right">
                      Total: {voters.length} Data Pemilih
                    </div>
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