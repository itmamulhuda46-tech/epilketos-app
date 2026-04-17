import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { 
  Users, 
  UserCircle, 
  CheckCircle, 
  LogOut, 
  Settings, 
  BarChart3, 
  Edit, 
  Trash2, 
  ArrowLeft, 
  Search,
  X,
  FileUp,
  FileSpreadsheet,
  BookOpen,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';

// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyA7VGzPltIeDFclXzxkCKbj0AbS5j5IrIw",
  authDomain: "epilketos2.firebaseapp.com",
  projectId: "epilketos2",
  storageBucket: "epilketos2.firebasestorage.app",
  messagingSenderId: "743567341665",
  appId: "1:743567341665:web:efd628b3ca3e304f179220",
  measurementId: "G-EQBV0BSFC1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = 'epilketos-smp-v2';

const KELAS_OPTIONS = [
  '7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H', '7I',
  '8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H', '8I',
  '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I',
  'Guru', 'Karyawan'
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voters, setVoters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [view, setView] = useState('home'); 
  const [currentVoter, setCurrentVoter] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [loginKelas, setLoginKelas] = useState('');
  const [loginError, setLoginError] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminTab, setAdminTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [isVoterModalOpen, setIsVoterModalOpen] = useState(false);
  const [editingVoter, setEditingVoter] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (e) {
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const vRef = collection(db, 'artifacts', appId, 'public', 'data', 'voters');
    const unsubVoters = onSnapshot(vRef, 
      (s) => setVoters(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Gagal memuat pemilih:", err)
    );
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'candidates');
    const unsubCandidates = onSnapshot(cRef, 
      (s) => setCandidates(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.number - b.number)),
      (err) => console.error("Gagal memuat kandidat:", err)
    );
    return () => { unsubVoters(); unsubCandidates(); };
  }, [user]);

  // --- CRUD FUNCTIONS ---

  const saveCandidate = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    const name = fd.get('name');
    const id = editingCandidate?.id || `cand_${Date.now()}`;
    const data = {
      number: parseInt(fd.get('number')),
      name: name,
      photoUrl: fd.get('photoUrl') || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=256&bold=true`,
      vision: fd.get('vision') || '',
      mission: fd.get('mission') || ''
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', id), data, { merge: true });
      setIsCandidateModalOpen(false);
      setEditingCandidate(null);
    } catch (err) { console.error(err); }
  };

  const saveVoter = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    const id = editingVoter?.id || `voter_${Date.now()}`;
    const data = {
      name: fd.get('name'),
      kelas: fd.get('kelas'),
      hasVoted: editingVoter ? editingVoter.hasVoted : false
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', id), data, { merge: true });
      setIsVoterModalOpen(false);
      setEditingVoter(null);
    } catch (err) { console.error(err); }
  };

  const deleteVoter = async (voterId) => {
    if (!user) return;
    setConfirmModal({
      show: true,
      title: "Hapus Pemilih",
      message: "Data pemilih ini akan dihapus permanen.",
      onConfirm: async () => {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', voterId));
        setConfirmModal({ show: false });
      }
    });
  };

  const deleteCandidate = async (candidateId) => {
    if (!user) return;
    setConfirmModal({
      show: true,
      title: "Hapus Kandidat",
      message: "Profil kandidat akan dihapus.",
      onConfirm: async () => {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'candidates', candidateId));
        setConfirmModal({ show: false });
      }
    });
  };

  const resetAllVotes = async () => {
    setConfirmModal({
      show: true,
      title: "RESET SEMUA SUARA",
      message: "Tindakan ini akan menghapus semua hasil pemilihan yang sudah masuk! Lanjutkan?",
      onConfirm: async () => {
        const promises = voters.map(v => 
          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', v.id), {
            hasVoted: false,
            votedFor: null,
            votedAt: null
          })
        );
        await Promise.all(promises);
        setConfirmModal({ show: false });
      }
    });
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    setImportStatus('Membaca file...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = window.XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = window.XLSX.utils.sheet_to_json(ws);
        
        setImportStatus(`Mengimpor ${data.length} data...`);
        let count = 0;
        for (const row of data) {
          const name = row.Nama || row.nama || row.NAME;
          const kelas = row.Kelas || row.kelas || row.KELAS;
          if (name && kelas) {
            const id = `voter_${Date.now()}_${count}`;
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', id), {
              name: String(name),
              kelas: String(kelas),
              hasVoted: false
            });
            count++;
          }
        }
        setImportStatus('Selesai!');
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportStatus('');
        }, 1500);
      } catch (err) {
        setImportStatus('Error: Format file salah.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- LOGIN LOGIC ---

  const handleVoterLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const voter = voters.find(v => v.name.toLowerCase() === loginName.trim().toLowerCase() && v.kelas === loginKelas);
    if (!voter) return setLoginError('Data tidak ditemukan.');
    if (voter.hasVoted) return setLoginError('Anda sudah memilih.');
    setCurrentVoter(voter);
    setView('voting');
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPin === 'hudasukses') { 
      setView('admin_dashboard');
      setAdminPin('');
      setLoginError('');
    } else {
      setLoginError('PIN Salah!');
    }
  };

  const castVote = async (candidateId) => {
    if (!currentVoter || !user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voters', currentVoter.id), {
        hasVoted: true,
        votedFor: candidateId,
        votedAt: new Date().toISOString()
      });
      setView('success');
    } catch (err) { console.error(err); }
  };

  // --- FILTERED DATA ---
  const filteredVoters = voters.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.kelas.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => a.kelas.localeCompare(b.kelas));

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-600 bg-slate-50 text-2xl animate-pulse">Memuat Database...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-xl font-black flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
          <div className="bg-white p-1 rounded-lg text-blue-600"><UserCircle size={24}/></div> e-Pilketos
        </h1>
        {view !== 'home' && (
          <button onClick={() => { setView('home'); setCurrentVoter(null); }} className="text-sm bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors">
            <LogOut size={16}/> Keluar
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {view === 'home' && (
          <div className="flex flex-col items-center gap-10 mt-20 animate-in fade-in duration-700">
            <div className="text-center">
              <h2 className="text-4xl font-black text-slate-900 mb-2">Selamat Datang</h2>
              <p className="text-slate-500 font-medium text-lg">Aplikasi Pemilihan Digital SMP Digital</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <button onClick={()=>setView('voter_login')} className="p-8 bg-white shadow-xl rounded-[2rem] flex flex-col items-center gap-4 hover:scale-105 transition-all w-56 border-b-8 border-blue-500 active:scale-95">
                <Users size={48} className="text-blue-500"/>
                <span className="font-black uppercase tracking-wider">Bilik Suara</span>
              </button>
              <button onClick={()=>setView('admin_login')} className="p-8 bg-white shadow-xl rounded-[2rem] flex flex-col items-center gap-4 hover:scale-105 transition-all w-56 border-b-8 border-amber-500 active:scale-95">
                <Settings size={48} className="text-amber-500"/>
                <span className="font-black uppercase tracking-wider">Admin Panel</span>
              </button>
            </div>
          </div>
        )}

        {view === 'voter_login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[2rem] shadow-2xl mt-10 border animate-in slide-in-from-bottom-4">
            <button onClick={() => setView('home')} className="mb-6 text-slate-400 hover:text-blue-600 flex items-center gap-2 font-bold text-sm">
              <ArrowLeft size={16}/> Kembali
            </button>
            <h2 className="text-2xl font-black mb-8 text-center">Identitas Pemilih</h2>
            <form onSubmit={handleVoterLogin} className="space-y-5">
              <input type="text" placeholder="Nama Lengkap..." value={loginName} onChange={(e)=>setLoginName(e.target.value)} className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-500 font-bold" required />
              <select value={loginKelas} onChange={(e)=>setLoginKelas(e.target.value)} className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-500 font-bold cursor-pointer" required>
                <option value="">-- Pilih Kelas --</option>
                {KELAS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {loginError && <div className="text-red-500 text-center font-bold bg-red-50 p-3 rounded-xl animate-bounce">{loginError}</div>}
              <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all">Lanjut Pilih</button>
            </form>
          </div>
        )}

        {view === 'admin_login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[2rem] shadow-2xl mt-10 border animate-in slide-in-from-bottom-4">
            <button onClick={() => setView('home')} className="mb-6 text-slate-400 hover:text-amber-600 flex items-center gap-2 font-bold text-sm">
              <ArrowLeft size={16}/> Kembali
            </button>
            <h2 className="text-2xl font-black mb-8 text-center">Verifikasi Admin</h2>
            <form onSubmit={handleAdminLogin} className="space-y-5">
              <input type="password" placeholder="PIN Admin" value={adminPin} onChange={(e)=>setAdminPin(e.target.value)} className="w-full p-4 bg-slate-50 border-2 rounded-2xl text-center text-xl font-black focus:border-amber-500 outline-none" required />
              {loginError && <div className="text-red-500 text-center font-bold bg-red-50 p-3 rounded-xl">{loginError}</div>}
              <button className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-amber-600 transition-all">Buka Panel</button>
            </form>
          </div>
        )}

        {view === 'admin_dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex gap-2 bg-white p-2 rounded-2xl border shadow-sm">
              <button onClick={()=>setAdminTab('dashboard')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${adminTab==='dashboard'?'bg-blue-600 text-white shadow-md':'text-slate-400 hover:bg-slate-50'}`}>DASHBOARD</button>
              <button onClick={()=>setAdminTab('candidates')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${adminTab==='candidates'?'bg-blue-600 text-white shadow-md':'text-slate-400 hover:bg-slate-50'}`}>KANDIDAT</button>
              <button onClick={()=>setAdminTab('voters')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${adminTab==='voters'?'bg-blue-600 text-white shadow-md':'text-slate-400 hover:bg-slate-50'}`}>PEMILIH</button>
            </div>

            {adminTab === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border text-center flex flex-col justify-center">
                  <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Partisipasi Suara</h3>
                  <div className="relative inline-block mx-auto mb-4">
                    <p className="text-6xl font-black text-blue-600">{voters.filter(v=>v.hasVoted).length}</p>
                    <div className="absolute -top-2 -right-6 bg-green-100 text-green-600 text-[10px] px-2 py-1 rounded-full font-bold">LIVE</div>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">dari total {voters.length} pemilih</p>
                  <button onClick={resetAllVotes} className="mt-8 text-red-400 text-[10px] font-black hover:text-red-600 underline uppercase tracking-tighter">Reset Semua Data Suara</button>
                </div>
                
                <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border">
                  <h3 className="font-black mb-8 flex items-center gap-2"><BarChart3 size={20} className="text-blue-600"/> Perolehan Suara Sementara</h3>
                  <div className="space-y-8">
                    {candidates.map(c => {
                      const total = voters.filter(v => v.hasVoted).length || 0;
                      const count = voters.filter(v => v.votedFor === c.id).length;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={c.id}>
                          <div className="flex justify-between items-end mb-3">
                            <div>
                               <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-md mr-2">{c.number}</span>
                               <span className="font-black text-slate-700">{c.name}</span>
                            </div>
                            <span className="font-black text-blue-600">{count} Suara <span className="text-slate-300 ml-1">({pct}%)</span></span>
                          </div>
                          <div className="h-4 bg-slate-100 rounded-full overflow-hidden border">
                            <div className="h-full bg-blue-600 transition-all duration-1000 ease-out" style={{width:`${pct}%`}}></div>
                          </div>
                        </div>
                      );
                    })}
                    {candidates.length === 0 && <p className="text-center text-slate-400 py-10 font-bold italic">Belum ada data kandidat.</p>}
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'candidates' && (
              <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
                <div className="flex justify-between items-center mb-8 px-2">
                  <h3 className="font-black text-xl">Daftar Kandidat</h3>
                  <button onClick={()=>{setEditingCandidate(null); setIsCandidateModalOpen(true)}} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-sm shadow-lg hover:bg-blue-700 active:scale-95 transition-all">Tambah Baru</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {candidates.map(c => (
                    <div key={c.id} className="p-6 border-2 border-slate-100 rounded-[2.5rem] text-center bg-slate-50/50 relative hover:border-blue-200 transition-all group">
                      <div className="absolute top-4 left-4 bg-white shadow-sm w-10 h-10 rounded-xl flex items-center justify-center font-black text-blue-600 border">{c.number}</div>
                      <img src={c.photoUrl} className="w-28 h-28 rounded-3xl mx-auto object-cover mb-4 border-4 border-white shadow-md group-hover:scale-105 transition-all" alt={c.name} />
                      <p className="font-black text-slate-800 text-lg">{c.name}</p>
                      <div className="flex gap-2 mt-6">
                        <button onClick={()=>{setEditingCandidate(c); setIsCandidateModalOpen(true)}} className="flex-1 py-3 bg-white border rounded-2xl text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><Edit size={14}/> Edit</button>
                        <button onClick={()=>deleteCandidate(c.id)} className="flex-1 py-3 bg-white border rounded-2xl text-red-500 font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"><Trash2 size={14}/> Hapus</button>
                      </div>
                    </div>
                  ))}
                  {candidates.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 font-bold">Klik tombol 'Tambah Baru' untuk memasukkan kandidat.</div>}
                </div>
              </div>
            )}

            {adminTab === 'voters' && (
              <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <h3 className="font-black text-xl px-2">Data Pemilih</h3>
                  <div className="flex gap-2">
                    <button onClick={()=>setIsImportModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-md hover:bg-green-700 transition-all"><FileSpreadsheet size={16}/> IMPORT EXCEL</button>
                    <button onClick={()=>{setEditingVoter(null); setIsVoterModalOpen(true)}} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all"><Users size={16}/> TAMBAH</button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                  <input type="text" placeholder="Cari nama atau kelas pemilih..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <tr>
                        <th className="p-4">Nama Lengkap</th>
                        <th className="p-4">Kelas</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-bold">
                      {filteredVoters.map(v => (
                        <tr key={v.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-all">
                          <td className="p-4 text-slate-700">{v.name}</td>
                          <td className="p-4"><span className="bg-slate-200 px-2 py-1 rounded-md text-[10px]">{v.kelas}</span></td>
                          <td className="p-4">
                            {v.hasVoted ? 
                              <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full text-[10px] flex items-center gap-1 w-fit border border-green-100"><CheckCircle size={12}/> SUDAH</span> : 
                              <span className="text-slate-400 bg-slate-100 px-3 py-1 rounded-full text-[10px] flex items-center gap-1 w-fit border border-slate-200"><X size={12}/> BELUM</span>
                            }
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button onClick={()=>{setEditingVoter(v); setIsVoterModalOpen(true)}} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit size={16}/></button>
                              <button onClick={()=>deleteVoter(v.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredVoters.length === 0 && <div className="p-10 text-center text-slate-400 italic">Data pemilih tidak ditemukan.</div>}
                </div>
                <div className="text-[10px] font-black text-slate-300 text-center">TOTAL: {filteredVoters.length} PEMILIH TERDAFTAR</div>
              </div>
            )}
          </div>
        )}

        {view === 'voting' && (
          <div className="mt-6 text-center space-y-8 animate-in zoom-in">
             <div className="bg-blue-50 p-4 rounded-3xl inline-block border-2 border-blue-100 shadow-sm">
               <p className="text-blue-600 font-black flex items-center gap-2">
                 <UserCircle size={20}/> Selamat Datang, {currentVoter?.name}! ({currentVoter?.kelas})
               </p>
             </div>
             <h3 className="text-4xl font-black text-slate-900 leading-tight">Gunakan Hak Suaramu<br/><span className="text-blue-600">Pilih Pemimpin Terbaik</span></h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
               {candidates.map(c => (
                 <div key={c.id} className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-transparent hover:border-blue-500 hover:shadow-2xl transition-all group flex flex-col">
                   <div className="relative mb-6">
                     <div className="absolute top-0 left-0 bg-blue-600 text-white w-14 h-14 flex items-center justify-center rounded-2xl text-2xl font-black shadow-lg z-10 group-hover:scale-110 transition-transform">{c.number}</div>
                     <img src={c.photoUrl} className="w-56 h-56 mx-auto object-cover rounded-[2.5rem] shadow-inner group-hover:scale-105 transition-all duration-500" alt={c.name}/>
                   </div>
                   <h4 className="text-2xl font-black mb-6 text-slate-800">{c.name}</h4>
                   
                   <div className="flex-1 space-y-4 mb-8 text-left">
                     {/* VISI - DITAMPILKAN LENGKAP */}
                     <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                       <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest flex items-center gap-1"><BookOpen size={12}/> Visi</p>
                       <p className="text-sm text-slate-700 leading-relaxed font-medium">
                         {c.vision || 'Visi belum diisi.'}
                       </p>
                     </div>

                     {/* MISI - DITAMPILKAN LENGKAP DENGAN FORMAT BARIS */}
                     <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1"><CheckCircle size={12}/> Misi</p>
                       <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                         {c.mission || 'Misi belum diisi.'}
                       </div>
                     </div>
                   </div>

                   <button onClick={() => {
                     setConfirmModal({
                       show: true,
                       title: "Konfirmasi Pilihan",
                       message: `Apakah Anda yakin ingin memilih pasangan nomor urut ${c.number} (${c.name})? Pilihan tidak dapat diubah.`,
                       onConfirm: () => {
                         castVote(c.id);
                         setConfirmModal({show:false});
                       }
                     });
                   }} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-lg hover:bg-blue-600 active:scale-95 transition-all shadow-xl">COBLOS SEKARANG</button>
                 </div>
               ))}
             </div>
          </div>
        )}

        {view === 'success' && (
          <div className="text-center mt-20 bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-sm mx-auto border-t-[12px] border-green-500 animate-in zoom-in relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
            <CheckCircle size={80} className="text-green-500 mx-auto mb-8 relative z-10"/>
            <h2 className="text-3xl font-black mb-4 relative z-10">BERHASIL!</h2>
            <p className="text-slate-500 font-medium mb-10 leading-relaxed">Suara Anda telah resmi tercatat dalam sistem e-Pilketos. Terima kasih atas partisipasinya!</p>
            <button onClick={() => { setView('home'); setCurrentVoter(null); }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg active:scale-95">SELESAI</button>
          </div>
        )}
      </main>

      {/* MODAL KANDIDAT */}
      {isCandidateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <h3 className="font-black text-2xl mb-6">Form Profil Kandidat</h3>
            <form onSubmit={saveCandidate} className="space-y-4">
              <div className="flex gap-4">
                <div className="w-24">
                   <label className="text-[10px] font-black text-slate-400 ml-1">NO. URUT</label>
                   <input name="number" type="number" placeholder="0" defaultValue={editingCandidate?.number} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-black outline-none focus:border-blue-500" required />
                </div>
                <div className="flex-1">
                   <label className="text-[10px] font-black text-slate-400 ml-1">NAMA KANDIDAT</label>
                   <input name="name" type="text" placeholder="Nama Lengkap" defaultValue={editingCandidate?.name} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-blue-500" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">Link URL Foto</label>
                <div className="relative">
                  <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                  <input name="photoUrl" type="url" placeholder="https://contoh.com/foto.jpg" defaultValue={editingCandidate?.photoUrl} className="w-full p-4 pl-12 bg-slate-50 border-2 rounded-2xl text-xs font-medium outline-none focus:border-blue-500" />
                </div>
                <p className="text-[9px] text-slate-400 mt-1 italic">Kosongkan untuk menggunakan inisial nama otomatis.</p>
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">Visi Utama</label>
                 <textarea name="vision" placeholder="Tuliskan visi utama secara lengkap..." defaultValue={editingCandidate?.vision} className="w-full p-4 bg-slate-50 border-2 rounded-2xl h-24 outline-none text-sm font-medium focus:border-blue-500"></textarea>
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">Misi Utama</label>
                 <textarea name="mission" placeholder="Tuliskan misi (gunakan enter untuk poin baru)..." defaultValue={editingCandidate?.mission} className="w-full p-4 bg-slate-50 border-2 rounded-2xl h-36 outline-none text-sm font-medium focus:border-blue-500"></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={()=>setIsCandidateModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600">BATAL</button>
                <button className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all">SIMPAN DATA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PEMILIH */}
      {isVoterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
            <h3 className="font-black text-2xl mb-6">{editingVoter ? 'Edit Pemilih' : 'Tambah Pemilih'}</h3>
            <form onSubmit={saveVoter} className="space-y-4">
              <input name="name" type="text" placeholder="Nama Lengkap" defaultValue={editingVoter?.name} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-blue-500" required />
              <select name="kelas" defaultValue={editingVoter?.kelas} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-blue-500 cursor-pointer" required>
                <option value="">-- Pilih Kelas --</option>
                {KELAS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={()=>setIsVoterModalOpen(false)} className="flex-1 py-4 font-black text-slate-400">BATAL</button>
                <button className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">SIMPAN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-center">
            <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileUp size={40} className="text-green-600"/>
            </div>
            <h3 className="font-black text-2xl mb-2">Import dari Excel</h3>
            <p className="text-sm text-slate-500 mb-8 px-4">Pastikan file Excel memiliki kolom dengan judul <b>'Nama'</b> dan <b>'Kelas'</b> pada baris pertama.</p>
            
            {importStatus ? (
              <div className="p-4 bg-slate-50 rounded-2xl font-black text-blue-600 animate-pulse mb-6">{importStatus}</div>
            ) : (
              <label className="block w-full cursor-pointer group mb-6">
                <div className="border-4 border-dashed border-slate-100 rounded-[2rem] p-10 group-hover:border-green-400 group-hover:bg-green-50/50 transition-all">
                  <p className="font-black text-slate-400 group-hover:text-green-600">Pilih File .xlsx / .csv</p>
                </div>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} className="hidden" />
              </label>
            )}
            
            <button onClick={()=>setIsImportModalOpen(false)} className="text-slate-400 font-black text-sm uppercase tracking-widest hover:text-slate-600">Tutup Jendela</button>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI UNIVERSAL */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xs text-center shadow-2xl animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32}/>
            </div>
            <h3 className="font-black text-xl mb-2 text-slate-800">{confirmModal.title}</h3>
            <p className="text-xs text-slate-400 mb-8 font-medium leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmModal({show:false})} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-200 transition-all">BATAL</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-xs hover:bg-red-600 transition-all shadow-lg shadow-red-200">YA, LANJUTKAN</button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER INFO */}
      <footer className="max-w-6xl mx-auto p-8 text-center text-slate-300 text-[10px] font-bold tracking-widest uppercase">
        &copy; 2024 Digital Election System &bull; Secured with Cloud Firebase
      </footer>
    </div>
  );
}
