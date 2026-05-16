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
  Download, 
  Check, 
  X, 
  Building2, 
  Trash2,
  LogOut,
  FileSpreadsheet,
  FileText,
  Save,
  Pencil,
  Settings
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
  const [editingId, setEditingId] = useState<string | null>(null);
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
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setMsg({ type: 'err', text: 'La ventana fue cerrada antes de completar.' });
      } else if (err.code === 'auth/unauthorized-domain') {
        setMsg({ type: 'err', text: 'Este dominio no está autorizado en Firebase Console.' });
      } else if (err.code === 'auth/operation-not-allowed') {
        setMsg({ type: 'err', text: 'Google Auth no está habilitado en Firebase Console.' });
      } else {
        setMsg({ type: 'err', text: `Error: ${err.code || 'al iniciar sesión'}` });
      }
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

  const handleSaveDonor = async () => {
    if (!newDonor.firstName || !newDonor.bags || Number(newDonor.bags) <= 0) {
      setMsg({ type: 'err', text: 'Completa el nombre y la cantidad de bolsas.' });
      return;
    }

    try {
      if (editingId) {
        await setDoc(doc(db, 'donors', editingId), {
          ...newDonor,
          bags: Number(newDonor.bags),
          updatedAt: serverTimestamp()
        }, { merge: true });
        setMsg({ type: 'ok', text: 'Registro actualizado correctamente.' });
      } else {
        await addDoc(collection(db, 'donors'), {
          ...newDonor,
          bags: Number(newDonor.bags),
          createdAt: serverTimestamp()
        });
        setMsg({ type: 'ok', text: 'Aporte registrado correctamente.' });
      }
      
      setNewDonor({
        firstName: '',
        lastName: '',
        block: '',
        house: '',
        bags: '',
        paymentType: 'Banco',
        date: new Date().toISOString().split('T')[0]
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setMsg({ type: 'err', text: 'No tienes permisos para realizar esta acción.' });
    }
  };

  const editDonor = (donor: Donor) => {
    setNewDonor({
      firstName: donor.firstName,
      lastName: donor.lastName || '',
      block: donor.block || '',
      house: donor.house || '',
      bags: donor.bags.toString(),
      paymentType: donor.paymentType || 'Banco',
      date: donor.date || new Date().toISOString().split('T')[0]
    });
    setEditingId(donor.id);
    setActiveTab('registros');
    setIsAdminMode(true);
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
    try {
      if (donors.length === 0) {
        setMsg({ type: 'err', text: 'No hay datos para exportar.' });
        return;
      }
      
      setMsg({ type: 'ok', text: 'Generando archivo Excel...' });
      
      const sorted = [...donors].sort((a, b) => b.bags - a.bags);
      const wb = XLSX.utils.book_new();
      
      const rows = [
        ['#', 'Nombre', 'Apellido', 'Bloque', 'Casa/Lote', 'Tipo de Pago', 'Bolsas', 'Valor Est. (L)', 'Fecha']
      ];
      sorted.forEach((d, i) => {
        rows.push([
          i + 1, 
          d.firstName, 
          d.lastName || '', 
          d.block || '', 
          d.house || '', 
          d.paymentType || 'Banco',
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
    } catch (err) {
      console.error(err);
      setMsg({ type: 'err', text: 'Error al generar el Excel.' });
    }
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
            <p className="text-[9px] sm:text-[11px] font-black text-emerald-700 uppercase mb-0.5">
              Residencial Caribbean Garden
            </p>
            <h1 className="text-base md:text-xl font-black text-emerald-950 leading-tight">
              Recaudación Cemento para Proyecto Fundición Fase 2
            </h1>
            <p className="text-[11px] font-bold text-stone-500 uppercase mt-1 text-opacity-80">
              Calle Principal - 2026
            </p>
          </div>
          <button 
            onClick={() => {
              if (!user) handleLogin();
              else if (!isAdmin) setMsg({ type: 'err', text: 'Solo el administrador puede acceder.' });
              else setIsAdminMode(!isAdminMode);
            }}
            className={cn(
              "p-3 rounded-2xl transition-all border",
              isAdminMode 
                ? "bg-emerald-700 text-white border-emerald-800 shadow-lg shadow-emerald-200" 
                : isAdmin
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
                  : "bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100"
            )}
          >
            {isAdminMode ? <X className="w-5 h-5" /> : isAdmin ? <Settings className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </button>
        </header>

        {/* COMBINED HERO CARD: Meta + Visualización Vertical */}
        <div className="bg-white rounded-[2.5rem] border border-stone-200 p-8 md:p-12 shadow-sm overflow-hidden relative group">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-center">
            
            {/* LEFT COLUMN: PRIMARY METRICS */}
            <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-center space-y-10 md:space-y-16">
              <div className="space-y-6">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase border border-emerald-100/50 tracking-widest inline-block">Meta del Proyecto</span>
                
                <div className="flex flex-col gap-2">
                  <span className="text-7xl sm:text-8xl md:text-[10rem] font-black text-stone-900 tracking-tighter leading-none">
                    {totalBags.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-stone-300 font-bold text-2xl md:text-4xl leading-none uppercase tracking-widest">/ {settings.bagsGoal.toLocaleString()}</span>
                    <span className="text-[12px] font-black text-stone-400 uppercase tracking-[0.2em]">Bolsas Totales</span>
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                   <div className="text-7xl sm:text-8xl md:text-9xl font-black text-emerald-700 leading-none tracking-tighter">{pct}%</div>
                   <div className="text-[11px] font-black text-stone-400 uppercase tracking-[0.3em] mt-3">Avance del Proyecto</div>
                </div>
                <div className="hidden sm:block">
                   <div className="w-16 h-16 rounded-full border-4 border-emerald-50 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 animate-pulse" />
                   </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: VERTICAL STREET PROGRESS */}
            <div className="md:col-span-5 lg:col-span-4 h-[450px] md:h-[600px]">
              <div className="relative w-full h-full bg-[#ecf3e8] rounded-[3rem] border-2 border-emerald-100 overflow-hidden shadow-inner group-hover:border-emerald-200 transition-all duration-500">
                <svg viewBox="0 0 120 920" className="w-full h-full" preserveAspectRatio="xMidYMin slice">
                  {/* Grass Background */}
                  <rect x="0" y="0" width="120" height="920" fill="#ecf3e8" />
                  
                  {/* Dirt Road Base - Vertical */}
                  <rect x="30" y="0" width="60" height="920" fill="#e2d1c3" />
                  
                  {/* Road Borders */}
                  <line x1="30" y1="0" x2="30" y2="920" stroke="#d6c8bc" strokeWidth="2" />
                  <line x1="90" y1="0" x2="90" y2="920" stroke="#d6c8bc" strokeWidth="2" />

                  {/* Sidewalks / Features (Static décor) */}
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map((pos, i) => (
                    <g key={`deco-${i}`}>
                       <rect x="0" y={pos * 920 - 15} width="30" height="30" fill="#e5e7eb" opacity="0.3" />
                       <rect x="90" y={pos * 920 + 10} width="30" height="30" fill="#e5e7eb" opacity="0.3" />
                       <circle cx={15} cy={pos * 920 + 30} r="2" fill="#15803d" opacity="0.2" />
                    </g>
                  ))}

                  {/* Concrete Progress - Vertical bottom to top */}
                  <g>
                    {Array.from({ length: 20 }).map((_, i) => {
                      const slabWidthPct = 5;
                      const opacity = (i * slabWidthPct) < pct ? 1 : 0;
                      if (opacity === 0) return null;
                      
                      // Calculate Y from bottom
                      const yPos = 920 - ((i + 1) * 46);
                      
                      return (
                        <rect 
                          key={i} x="30" y={yPos} width="60" height="46" 
                          fill="#64748b" stroke="#334155" strokeWidth="1"
                          className="transition-all duration-700"
                        />
                      );
                    })}
                  </g>

                  {/* Dash lines */}
                  <line x1="60" y1="0" x2="60" y2="920" stroke="white" strokeWidth="1" strokeDasharray="10,10" opacity="0.4" />
                  
                  {/* Phase Marker (70%) */}
                  <line x1="20" y1={920 * (1 - 0.7)} x2="100" y2={920 * (1 - 0.7)} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,2" />
                </svg>
                
                {/* Labels overlay */}
                <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                  <div className="text-center">
                    <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-emerald-900 lowercase border border-white shadow-sm tracking-widest">Meta {settings.linearMeters}m</span>
                  </div>
                  <div className="text-center">
                    <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-emerald-900/60 lowercase border border-white shadow-sm tracking-widest">Inicio Calle</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
           <div className="bg-white border border-stone-200 rounded-[2.5rem] p-7 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div>
                <p className="text-stone-400 text-[9px] font-black uppercase tracking-widest mb-4">Vecinos Participando</p>
                <div className="flex items-center gap-3">
                   <h4 className="text-4xl font-black text-stone-900 tracking-tighter">{donors.length}</h4>
                   <div className="flex -space-x-1.5">
                      {[1,2,3].map(i => (
                        <div key={i} className="w-5 h-5 rounded-full border border-white bg-stone-50 flex items-center justify-center overflow-hidden ring-1 ring-stone-100">
                          {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="logo" className="w-full h-full object-contain" />
                          ) : (
                            <Logo className="w-full h-full" />
                          )}
                        </div>
                      ))}
                   </div>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2">
                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Base de Datos Activa</span>
              </div>
              <Users className="absolute -right-4 -bottom-4 w-20 h-20 text-emerald-500/5 rotate-12" />
           </div>

           <div className="bg-white border border-stone-200 rounded-[2.5rem] p-7 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-stone-400 text-[9px] font-black uppercase tracking-widest mb-4">Carga Sugerida</p>
                <h4 className="text-4xl font-black text-stone-800 tracking-tighter">{bagsPerNeighbor}</h4>
              </div>
              <p className="text-[10px] font-bold text-stone-400 uppercase mt-6 tracking-wide">Bolsas / Lote Promedio</p>
           </div>

           <div className="bg-white border border-stone-200 rounded-[2.5rem] p-7 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-stone-400 text-[9px] font-black uppercase tracking-widest mb-4">Bolsas Pendientes</p>
                <h4 className="text-4xl font-black text-amber-600 tracking-tighter">{Math.max(0, settings.bagsGoal - totalBags).toLocaleString()}</h4>
              </div>
              <p className="text-[10px] font-bold text-amber-700/60 uppercase mt-6 tracking-wide">Diferencia para Meta</p>
           </div>
        </div>

        {/* REGISTROS CARD */}
        <div className="bg-white rounded-[2.5rem] border border-stone-200 p-6 shadow-sm flex-1">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-[12px] font-black text-stone-800 uppercase">Actividad de Aportes</h3>
           </div>

           <div className="space-y-2">
              {donors.length === 0 ? (
                <div className="text-center py-12">
                   <p className="text-[11px] font-bold text-stone-500 uppercase">Esperando primer aporte...</p>
                </div>
              ) : (
                donors.map((donor, idx) => (
                  <div key={donor.id} className="group bg-white hover:bg-emerald-50/30 border border-stone-100 p-5 rounded-[1.8rem] transition-all flex items-center justify-between shadow-sm hover:shadow-md hover:border-emerald-100 relative overflow-hidden">
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="w-10 h-10 rounded-2xl bg-stone-50 flex items-center justify-center text-[11px] font-black text-stone-300 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                        {donors.length - idx}
                      </div>
                      <div>
                        <p className="text-[16px] font-black text-stone-900 uppercase leading-none tracking-tight">{donor.firstName} {donor.lastName}</p>
                        <div className="flex gap-4 mt-2 flex-wrap items-center">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-stone-300" />
                            <span className="text-[10px] font-bold text-stone-500 uppercase">B{donor.block || '?'} L{donor.house || '?'}</span>
                          </div>
                          <span className="px-2 py-0.5 bg-stone-100 rounded-md text-[8px] font-black text-stone-500 uppercase tracking-wider">{donor.paymentType || 'Banco'}</span>
                          <span className="text-[9px] font-bold text-stone-300 uppercase tabular-nums">{formatDate(donor.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="text-right">
                        <p className="text-emerald-700 font-black text-2xl leading-none tracking-tighter">+{donor.bags}</p>
                        <p className="text-[8px] font-black text-emerald-400 uppercase mt-1 tracking-[0.15em]">Bolsas</p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button 
                            onClick={() => editDonor(donor)}
                            className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteDonor(donor.id)}
                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Footer info compact */}
        <footer className="flex justify-between items-center px-4 py-8 text-stone-500 text-[10px] font-black uppercase">
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
                 <h2 className="text-2xl font-black text-stone-800 uppercase">Panel de Control</h2>
                 <p className="text-stone-600 text-[10px] font-black uppercase">Gestión de Obra y Registros</p>
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
                       "flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all",
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
                    <div className="flex flex-col gap-2">
                      <button onClick={handleSaveDonor} className="w-full bg-emerald-700 text-white font-black uppercase py-4 rounded-2xl hover:bg-emerald-800 transition-all flex items-center justify-center gap-3">
                        <Check className="w-4 h-4" /> {editingId ? 'Actualizar Registro' : 'Registrar Donación'}
                      </button>
                      {editingId && (
                        <button 
                          onClick={() => {
                            setEditingId(null);
                            setNewDonor({
                              firstName: '',
                              lastName: '',
                              block: '',
                              house: '',
                              bags: '',
                              paymentType: 'Banco',
                              date: new Date().toISOString().split('T')[0]
                            });
                          }} 
                          className="w-full text-[10px] font-black text-stone-400 uppercase hover:text-stone-600 p-2"
                        >
                          Cancelar Edición
                        </button>
                      )}
                    </div>
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
                            <div className="text-[10px] font-black text-emerald-800 uppercase">Cambiar Logo</div>
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
                    <button onClick={saveParams} className="w-full bg-[#4b3d33] text-white font-black uppercase py-4 rounded-2xl hover:bg-stone-900 transition-all">Guardar Configuración</button>
                  </div>
                )}

                {activeTab === 'exportar' && (
                  <div className="text-center py-6 space-y-6">
                     <p className="text-stone-500 font-bold text-[10px] uppercase leading-relaxed px-10">Genera respaldos oficiales para el Patronato.</p>
                     <div className="flex flex-col gap-3">
                      <button 
                        type="button"
                        onClick={exportXLSX} 
                        className="bg-emerald-100 text-emerald-900 font-black uppercase py-4 rounded-2xl hover:bg-emerald-200 transition-all flex items-center justify-center gap-3 text-[10px]"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> Bajar Excel (.xlsx)
                      </button>
                      <button onClick={handleLogout} className="mt-4 text-[9px] font-black text-stone-400 uppercase hover:text-red-500 transition-colors">Cerrar Sesión Administrador</button>
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
          "fixed top-10 left-1/2 -translate-x-1/2 px-10 py-4 rounded-full shadow-2xl font-black text-[10px] uppercase animate-in slide-in-from-top duration-300 z-[100]",
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
