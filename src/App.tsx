import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  addDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { Donor, ProjectSettings } from './types';
import { formatCurrency, formatDate, cn } from './lib/utils';
import Logo from './components/Logo';
import { 
  Users, 
  Lock, 
  Plus, 
  Settings, 
  Download, 
  Check, 
  X, 
  Building2, 
  Trash2,
  LogOut,
  FileSpreadsheet,
  FileText,
  Save
} from 'lucide-react';
import * as XLSX from 'xlsx';

const provider = new GoogleAuthProvider();

export default function App() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [settings, setSettings] = useState<ProjectSettings>({
    bagsGoal: 2520,
    donorsGoal: 105,
    linearMeters: 415,
    costPerBag: 0,
    logoUrl: ''
  });
  const [user, setUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'registros' | 'parametros' | 'exportar'>('registros');
  const [newDonor, setNewDonor] = useState({
    firstName: '',
    lastName: '',
    block: '',
    house: '',
    bags: '',
    paymentType: 'Banco' as const,
    date: new Date().toISOString().split('T')[0]
  });
  const [editSettings, setEditSettings] = useState<ProjectSettings | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err', text: string } | null>(null);

  useEffect(() => {
    const unsubDonors = onSnapshot(query(collection(db, 'donors'), orderBy('createdAt', 'desc')), (snap) => {
      setDonors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Donor)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'project'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as ProjectSettings);
      }
    });

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => {
      unsubDonors();
      unsubSettings();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setMsg({ type: 'err', text: 'Error al iniciar sesión.' });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdminMode(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 800 * 1024) { // 800KB limit to fit document limit
      setMsg({ type: 'err', text: 'La imagen es demasiado grande (máx 800KB).' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditSettings(prev => ({
        ...(prev || settings),
        logoUrl: reader.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const addDonor = async () => {
    if (!newDonor.firstName || !newDonor.bags || Number(newDonor.bags) <= 0) {
      setMsg({ type: 'err', text: 'Completa el nombre y la cantidad de bolsas.' });
      return;
    }

    try {
      await addDoc(collection(db, 'donors'), {
        ...newDonor,
        bags: Number(newDonor.bags),
        createdAt: serverTimestamp()
      });
      setNewDonor({
        firstName: '',
        lastName: '',
        block: '',
        house: '',
        bags: '',
        paymentType: 'Banco',
        date: new Date().toISOString().split('T')[0]
      });
      setMsg({ type: 'ok', text: 'Aporte registrado correctamente.' });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'err', text: 'No tienes permisos para realizar esta acción.' });
    }
  };

  const deleteDonor = async (id: string) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    try {
      await deleteDoc(doc(db, 'donors', id));
      setMsg({ type: 'ok', text: 'Registro eliminado.' });
    } catch (err) {
      setMsg({ type: 'err', text: 'Error al eliminar.' });
    }
  };

  const saveParams = async () => {
    if (!editSettings) return;
    try {
      await setDoc(doc(db, 'settings', 'project'), editSettings);
      setMsg({ type: 'ok', text: 'Parámetros actualizados.' });
    } catch (err) {
      setMsg({ type: 'err', text: 'Error al guardar parámetros.' });
    }
  };

  const exportXLSX = () => {
    if (donors.length === 0) return;
    const sorted = [...donors].sort((a, b) => b.bags - a.bags);
    const wb = XLSX.utils.book_new();
    
    const rows = [
      ['#', 'Nombre', 'Apellido', 'Bloque', 'Casa/Lote', 'Bolsas', 'Valor Est. (L)', 'Fecha']
    ];
    sorted.forEach((d, i) => {
      rows.push([
        i + 1, 
        d.firstName, 
        d.lastName || '', 
        d.block || '', 
        d.house || '', 
        d.bags, 
        settings.costPerBag > 0 ? d.bags * settings.costPerBag : '', 
        formatDate(d.date)
      ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    
    const totalBags = donors.reduce((s, d) => s + d.bags, 0);
    const res = [
      ['RESUMEN - Fase 2 Calle Principal'],
      ['Exportado el:', new Date().toLocaleDateString()],
      [''],
      ['Meta bolsas:', settings.bagsGoal],
      ['Bolsas aportadas:', totalBags],
      ['Bolsas pendientes:', Math.max(0, settings.bagsGoal - totalBags)],
      ['Progreso:', Math.round((totalBags / settings.bagsGoal) * 100) + '%']
    ];
    const wsRes = XLSX.utils.aoa_to_sheet(res);
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');
    
    XLSX.writeFile(wb, `CaribbeanGarden_Fase2_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalBags = donors.reduce((acc, d) => acc + d.bags, 0);
  const pct = Math.min(100, Math.round((totalBags / settings.bagsGoal) * 100));
  const metersDone = Math.round((pct / 100) * settings.linearMeters);
  const bagsPerNeighbor = settings.donorsGoal > 0 ? Math.round(settings.bagsGoal / settings.donorsGoal) : 0;
  const need70 = Math.max(0, Math.ceil(settings.bagsGoal * 0.7) - totalBags);

  const isAdmin = user?.email === "maluc21@gmail.com";

  return (
    <>
    <div className="min-h-screen bg-[#f8faf7] p-3 md:p-6 font-sans text-stone-900 selection:bg-emerald-100">
      <div className="max-w-[700px] mx-auto flex flex-col gap-4">
        
        {/* Mobile-First Header */}
        <header className="bg-white rounded-[2rem] p-5 shadow-sm border border-stone-100 flex items-center gap-4">
          <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center border border-stone-50 overflow-hidden shadow-sm p-1">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Logo className="w-full h-full" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[9px] sm:text-[11px] font-black text-emerald-700 uppercase tracking-wide sm:tracking-wider mb-0.5">
              Residencial Caribbean Garden
            </p>
            <h1 className="text-base md:text-xl font-black tracking-tight text-emerald-950 leading-tight uppercase">
              Recaudación Cemento para Proyecto Fundición Fase 2
            </h1>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-[0.15em] mt-1 text-opacity-80">
              Calle Principal - 2026
            </p>
          </div>
          <button 
            onClick={() => {
              if (!user) handleLogin();
              else if (!isAdmin) setMsg({ type: 'err', text: 'Solo el administrador puede acceder.' });
              else setIsAdminMode(!isAdminMode);
            }}
            className="p-3 bg-stone-50 text-stone-400 rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all border border-stone-100"
          >
            {isAdminMode ? <X className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </button>
        </header>

        {/* COMBINED HERO CARD: Meta + Visualización */}
        <div className="bg-white rounded-[2.5rem] border border-stone-200 p-6 md:p-8 shadow-sm overflow-hidden relative group">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black tracking-widest uppercase mb-3 inline-block">Meta del Proyecto</span>
                <h2 className="text-3xl md:text-4xl font-black text-stone-800 tracking-tighter leading-none">
                  {totalBags.toLocaleString()} <span className="text-xl text-stone-500 font-normal uppercase">/ {settings.bagsGoal.toLocaleString()} Bolsas</span>
                </h2>
              </div>
              <div className="text-right">
                 <div className="text-3xl font-black text-emerald-600 leading-none">{pct}%</div>
                 <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest mt-1">Avance</div>
              </div>
            </div>

            {/* Integrated Visualization (The Street) */}
            <div className="relative w-full aspect-[22/5] bg-[#ecf3e8] rounded-3xl border-2 border-emerald-100 overflow-hidden shadow-inner mb-8">
              <svg viewBox="0 0 920 120" className="w-full h-full">
                {/* Grass Background */}
                <rect x="0" y="0" width="920" height="120" fill="#ecf3e8" />
                
                {/* Dirt Road Base */}
                <rect x="0" y="30" width="920" height="60" fill="#e2d1c3" />
                
                {/* Bocacalles (Side Streets - Top) */}
                {[0.15, 0.35, 0.55, 0.8].map((pos, i) => (
                  <rect key={`side-${i}`} x={pos * 920 - 15} y={0} width={30} height={35} fill="#e2d1c3" />
                ))}

                {/* Palm Trees (Bottom) */}
                {Array.from({ length: 9 }).map((_, i) => (
                  <g key={`palm-${i}`} transform={`translate(${i * 105 + 20}, 108) scale(0.15)`}>
                    <path d="M0 0 Q5 -40 10 -80" stroke="#714e32" strokeWidth="12" fill="none" strokeLinecap="round" />
                    <g transform="translate(10, -80)">
                      <path d="M0 0 Q-30 -20 -50 40" stroke="#15803d" strokeWidth="6" fill="none" />
                      <path d="M0 0 Q30 -20 50 40" stroke="#15803d" strokeWidth="6" fill="none" />
                      <path d="M0 0 Q10 -40 40 -20" stroke="#15803d" strokeWidth="6" fill="none" />
                      <path d="M0 0 Q-10 -40 -40 -20" stroke="#15803d" strokeWidth="6" fill="none" />
                    </g>
                  </g>
                ))}

                {/* Grass texture dots */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <circle key={`dot-${i}`} cx={i * 80 + 10} cy={15} r={1.5} fill="#d1e2c4" />
                ))}

                <g>
                   {Array.from({ length: 20 }).map((_, i) => {
                     const slabWidthPct = 5;
                     const opacity = (i * slabWidthPct) < pct ? 1 : 0;
                     if (opacity === 0) return null;
                     return (
                        <rect 
                          key={i} x={i * 46} y={30} width={46} height={60} 
                          fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1"
                        />
                     );
                   })}
                </g>
                
                {/* Decorative flowers/grass tufts */}
                <circle cx="150" cy="110" r="2" fill="#facc15" />
                <circle cx="450" cy="15" r="2" fill="#f87171" />
                <circle cx="800" cy="105" r="2" fill="#60a5fa" />
                
                <line x1="0" y1="60" x2="920" y2="60" stroke="white" strokeWidth="1" strokeDasharray="10,10" opacity="0.4" />
                <line x1={0.7 * 920} y1="20" x2={0.7 * 920} y2="100" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,2" />
              </svg>
              <div className="absolute top-2 left-5 text-[9px] font-black text-emerald-900/60 uppercase tracking-tighter">Inicio Calle</div>
              <div className="absolute top-2 right-5 text-[9px] font-black text-emerald-900/60 uppercase tracking-tighter">Meta {settings.linearMeters}m</div>
            </div>

            {/* Accumulation Visual: The Cement Bag Stack */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                 <h4 className="text-[11px] font-black text-stone-600 uppercase tracking-widest">Material Acumulado</h4>
                 <div className="text-[10px] font-bold text-emerald-700 uppercase tabular-nums">{totalBags} Bolsas</div>
              </div>
              <div className="flex flex-wrap gap-1 md:gap-1.5 p-4 bg-stone-50 rounded-[2rem] border border-stone-100 min-h-[80px] content-start">
                 {Array.from({ length: Math.ceil(settings.bagsGoal / 50) }).map((_, i) => {
                    const threshold = (i + 1) * 50;
                    const isFilled = totalBags >= threshold;
                    return (
                      <div 
                        key={i} 
                        className={cn(
                          "w-4 h-5 md:w-5 md:h-6 rounded-[4px] border transition-all duration-500",
                          isFilled 
                            ? "bg-stone-400 border-stone-500 shadow-sm scale-100" 
                            : "bg-white border-stone-200 opacity-20 scale-90"
                        )}
                        title={`Bloque de 50 bolsas #${i+1}`}
                      >
                        {isFilled && <div className="w-full h-[2px] bg-stone-500 mt-1 opacity-50" />}
                      </div>
                    );
                 })}
              </div>
              <p className="mt-2 text-[10px] text-stone-500 font-medium lowercase italic text-center">Cada bloque representa aprox. 50 bolsas</p>
            </div>
            
            <p className="mt-4 text-center text-[11px] font-black text-stone-500 uppercase tracking-[0.1em]">
              {pct >= 70 ? (
                <span className="text-amber-800 bg-amber-50 px-4 py-2 rounded-full border border-amber-200 italic">✔ Programando fundición (70% superado)</span>
              ) : (
                <span>Faltan {need70.toLocaleString()} bolsas para iniciar obra</span>
              )}
            </p>
          </div>
        </div>

        {/* VECINOS STATS CARD */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-emerald-500 text-white rounded-[2rem] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div>
                <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">Vecinos Participando</p>
                <h4 className="text-4xl font-black tracking-tighter">{donors.length}</h4>
              </div>
              <div className="mt-4 flex items-center gap-2">
                 <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center overflow-hidden">
                        {settings.logoUrl ? (
                          <img src={settings.logoUrl} alt="logo" className="w-full h-full object-contain" />
                        ) : (
                          <Logo className="w-full h-full" />
                        )}
                      </div>
                    ))}
                 </div>
                 <span className="text-[11px] font-bold text-emerald-100">+{donors.length} Contribuyentes</span>
              </div>
              <Users className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
           </div>

           <div className="bg-white border border-stone-200 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-stone-600 text-[10px] font-black uppercase tracking-widest mb-1">Carga Sugerida</p>
                <h4 className="text-4xl font-black tracking-tighter text-stone-800">{bagsPerNeighbor}</h4>
              </div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight mt-4">Bolsas promedio por lote</p>
           </div>
        </div>

        {/* REGISTROS CARD */}
        <div className="bg-white rounded-[2.5rem] border border-stone-200 p-6 shadow-sm flex-1">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-[12px] font-black text-stone-800 uppercase tracking-widest">Actividad de Aportes</h3>
           </div>

           <div className="space-y-3">
              {donors.length === 0 ? (
                <div className="text-center py-12">
                   <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Esperando primer aporte...</p>
                </div>
              ) : (
                donors.map((donor, idx) => (
                  <div key={donor.id} className="group bg-[#fcfcfc] hover:bg-[#f2f4f1] border border-stone-100 p-4 rounded-[1.5rem] transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-bold text-stone-200">{idx + 1}</span>
                      <div>
                        <p className="text-[15px] font-black text-stone-800 uppercase tracking-tighter leading-none">{donor.firstName} {donor.lastName}</p>
                        <div className="flex gap-3 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">Bloque {donor.block || '?'} Lote {donor.house || '?'}</span>
                          <span className="px-2 py-0.5 bg-stone-100 rounded text-[9px] font-black text-stone-700 uppercase">{donor.paymentType || 'Banco'}</span>
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest tabular-nums">{formatDate(donor.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p className="text-emerald-700 font-extrabold text-xl tracking-tighter leading-none">+{donor.bags}</p>
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.1em] mt-0.5">Bolsas</p>
                      </div>
                      {isAdminMode && (
                        <button 
                          onClick={() => deleteDonor(donor.id)}
                          className="p-2 text-stone-200 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Footer info compact */}
        <footer className="flex justify-between items-center px-4 py-8 text-stone-500 text-[10px] font-black uppercase tracking-[0.3em]">
           <div className="flex items-center gap-4">
             <div className="h-10 w-10 bg-white rounded-xl shadow-sm border border-stone-50 overflow-hidden flex items-center justify-center p-1">
               {settings.logoUrl ? (
                 <img src={settings.logoUrl} alt="logo" className="w-full h-full object-contain" />
               ) : (
                 <Logo className="w-full h-full" />
               )}
             </div>
             <span>Caribbean Garden</span>
           </div>
           <span className="opacity-70 text-[9px]">Fase 2 © {new Date().getFullYear()}</span>
        </footer>

      </div>

      {/* Admin Panel Overlay */}
      {isAdminMode && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-2 border border-stone-200 animate-in zoom-in-95 duration-300">
            <div className="bg-[#f2f4f1] p-8 md:p-10 rounded-[2.5rem] relative">
              <button onClick={() => setIsAdminMode(false)} className="absolute top-8 right-8 p-2 text-stone-400 hover:text-stone-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
              
              <div className="mb-10">
                 <h2 className="text-2xl font-black text-stone-800 uppercase tracking-tighter">Panel de Control</h2>
                 <p className="text-stone-600 text-[10px] font-black uppercase tracking-widest">Gestión de Obra y Registros</p>
              </div>

              <div className="flex gap-2 mb-10 p-1.5 bg-stone-200/50 rounded-2xl w-full max-w-sm">
                 {[
                   { id: 'registros', label: 'Ingresar' },
                   { id: 'parametros', label: 'Metas' },
                   { id: 'exportar', label: 'Reportes' }
                 ].map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id as any)}
                     className={cn(
                       "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                       activeTab === tab.id ? "bg-white text-emerald-800 shadow-sm" : "text-stone-400 hover:text-emerald-700"
                     )}
                   >
                     {tab.label}
                   </button>
                 ))}
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-inner border border-stone-100">
                {activeTab === 'registros' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-500"><label>Nombre</label><input type="text" className="input-compact" value={newDonor.firstName} onChange={e => setNewDonor({...newDonor, firstName: e.target.value})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-500"><label>Apellido</label><input type="text" className="input-compact" value={newDonor.lastName} onChange={e => setNewDonor({...newDonor, lastName: e.target.value})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-500"><label>Bloque</label><input type="text" className="input-compact" value={newDonor.block} onChange={e => setNewDonor({...newDonor, block: e.target.value})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-500"><label>Casa</label><input type="text" className="input-compact" value={newDonor.house} onChange={e => setNewDonor({...newDonor, house: e.target.value})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-500"><label>Bolsas</label><input type="number" className="input-compact" value={newDonor.bags} onChange={e => setNewDonor({...newDonor, bags: e.target.value})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-500"><label>Fecha</label><input type="date" className="input-compact" value={newDonor.date} onChange={e => setNewDonor({...newDonor, date: e.target.value})} /></div>
                      <div className="md:col-span-2 space-y-1.5 font-bold uppercase text-[9px] text-stone-500">
                        <label>Tipo de Pago</label>
                        <div className="flex gap-2">
                          {['Banco', 'Efectivo', 'Material'].map(t => (
                            <button
                              key={t}
                              onClick={() => setNewDonor({...newDonor, paymentType: t as any})}
                              className={cn(
                                "flex-1 py-3 rounded-xl border-2 transition-all",
                                newDonor.paymentType === t ? "bg-emerald-50 border-emerald-600 text-emerald-800" : "bg-white border-stone-100 text-stone-400"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={addDonor} className="w-full bg-emerald-700 text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl hover:bg-emerald-800 transition-all flex items-center justify-center gap-3">
                      <Check className="w-4 h-4" /> Registrar Donación
                    </button>
                  </div>
                )}

                {activeTab === 'parametros' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-400"><label>Meta Bolsas</label><input type="number" className="input-compact" value={editSettings?.bagsGoal ?? settings.bagsGoal} onChange={e => setEditSettings({...(editSettings || settings), bagsGoal: Number(e.target.value)})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-400"><label>Cant. Vecinos</label><input type="number" className="input-compact" value={editSettings?.donorsGoal ?? settings.donorsGoal} onChange={e => setEditSettings({...(editSettings || settings), donorsGoal: Number(e.target.value)})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-400"><label>Metros (m)</label><input type="number" className="input-compact" value={editSettings?.linearMeters ?? settings.linearMeters} onChange={e => setEditSettings({...(editSettings || settings), linearMeters: Number(e.target.value)})} /></div>
                      <div className="space-y-1.5 font-bold uppercase text-[9px] text-stone-400"><label>Precio Bolsa</label><input type="number" className="input-compact" value={editSettings?.costPerBag ?? settings.costPerBag} onChange={e => setEditSettings({...(editSettings || settings), costPerBag: Number(e.target.value)})} /></div>
                      
                      <div className="md:col-span-2 space-y-3">
                        <label className="block text-[9px] font-bold uppercase text-stone-400">Logo de la Aplicación</label>
                        <div className="flex items-center gap-4 border-2 border-dashed border-stone-200 p-4 rounded-2xl bg-stone-50 group hover:border-emerald-300 transition-colors relative">
                          <div className="h-16 w-16 bg-white rounded-xl shadow-sm border border-stone-100 flex items-center justify-center overflow-hidden p-1">
                            {(editSettings?.logoUrl || settings.logoUrl) ? (
                              <img src={editSettings?.logoUrl || settings.logoUrl} alt="Preview" className="w-full h-full object-contain" />
                            ) : (
                              <Logo className="w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleLogoUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Cambiar Logo</div>
                            <p className="text-[9px] text-stone-400 font-bold mt-1">Click o arrastra imagen (JPG, PNG)</p>
                          </div>
                          {(editSettings?.logoUrl || settings.logoUrl) && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditSettings(prev => ({ ...(prev || settings), logoUrl: '' }));
                              }}
                              className="z-10 p-2 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={saveParams} className="w-full bg-[#4b3d33] text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl hover:bg-stone-900 transition-all">Guardar Configuración</button>
                  </div>
                )}

                {activeTab === 'exportar' && (
                  <div className="text-center py-6 space-y-6">
                     <p className="text-stone-500 font-bold text-[10px] uppercase tracking-widest leading-relaxed px-10">Genera respaldos oficiales para el Patronato.</p>
                     <div className="flex flex-col gap-3">
                      <button onClick={exportXLSX} className="bg-emerald-100 text-emerald-900 font-black uppercase tracking-[0.15em] py-4 rounded-2xl hover:bg-emerald-200 transition-all flex items-center justify-center gap-3 text-[10px]">
                        <FileSpreadsheet className="w-4 h-4" /> Bajar Excel (.xlsx)
                      </button>
                      <button onClick={handleLogout} className="mt-4 text-[9px] font-black text-stone-400 uppercase tracking-widest hover:text-red-500 transition-colors">Cerrar Sesión Administrador</button>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Messages */}
      {msg && (
        <div className={cn(
          "fixed top-10 left-1/2 -translate-x-1/2 px-10 py-4 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-[0.2em] animate-in slide-in-from-top duration-300 z-[100]",
          msg.type === 'ok' ? "bg-emerald-900 text-white" : "bg-red-900 text-white"
        )}>
          {msg.text}
        </div>
      )}

    </div>

    <style>{`
      .input-compact {
        width: 100%;
        background: #fdfdfd;
        border: 2px solid #f0f0f0;
        border-radius: 1rem;
        padding: 0.75rem 1rem;
        font-size: 0.85rem;
        font-weight: 800;
        color: #1c1917;
        outline: none;
        transition: all 0.2s;
      }
      .input-compact:focus {
        border-color: #065f46;
        background: white;
        box-shadow: 0 5px 15px -3px rgba(6, 95, 70, 0.1);
      }
    `}</style>
    </>
  );
}
