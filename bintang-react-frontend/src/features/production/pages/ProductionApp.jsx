import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import useProductionData from './hooks/useProductionData';
import {
  Globe,
  Package,
  Users,
  Tag,
  FolderTree,
  Bell,
  Inbox,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Kanban,
} from 'lucide-react';

// Staff Modals & Views
import ClaimPool from './components/ClaimPool';
import KanbanPersonal from './components/KanbanPersonal';
import WorkspaceSPK from './components/WorkspaceSPK';
import ForwardJobModal from '../components/modals/ForwardJobModal';

// Admin / Manager Panels
import GlobalListPanel from './panels/GlobalListPanel';
import InventoryPanel from './panels/InventoryPanel';
import CustomerPanel from './panels/CustomerPanel';
import PricelistPanel from './panels/PricelistPanel';
import DivisionPanel from './panels/DivisionPanel';
import ActivityLogsPanel from './panels/ActivityLogsPanel';
import KanbanGlobalPanel from './panels/KanbanGlobalPanel';
import PapanKerjaSpkPanel from './panels/PapanKerjaSpkPanel';

// --- DYNAMIC MINI CALENDAR COMPONENT ---
function MiniCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(
      <div key={`empty-${i}`} className="p-0.5 text-[9px] text-transparent">
        .
      </div>
    );
  }

  const today = new Date();
  for (let d = 1; d <= totalDays; d++) {
    const isToday =
      today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    days.push(
      <div
        key={`day-${d}`}
        className={`p-0.5 text-[9px] text-center rounded font-bold ${
          isToday
            ? 'bg-indigo-650 bg-indigo-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {d}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full select-none">
      <div className="flex justify-between items-center w-full mb-1">
        <button
          onClick={handlePrevMonth}
          className="px-1 text-slate-400 hover:text-indigo-600 font-extrabold text-xs cursor-pointer"
        >
          &lsaquo;
        </button>
        <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-700">
          {monthNames[month]} {year}
        </span>
        <button
          onClick={handleNextMonth}
          className="px-1 text-slate-400 hover:text-indigo-600 font-extrabold text-xs cursor-pointer"
        >
          &rsaquo;
        </button>
      </div>
      <div className="grid grid-cols-7 w-full text-center text-[8.5px] text-slate-400 font-extrabold mb-1">
        <div>M</div>
        <div>S</div>
        <div>S</div>
        <div>R</div>
        <div>K</div>
        <div>J</div>
        <div>S</div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 w-full font-bold">{days}</div>
    </div>
  );
}

export default function ProductionApp() {
  const { user } = useAuth();

  // Sidebar Collapsed States
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Real-time Clock State
  const [timeString, setTimeString] = useState('');

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [modeInitialized, setModeInitialized] = useState(false);

  // Active Tab: default based on active mode
  const [activeTab, setActiveTab] = useState('');

  const {
    jobs,
    claimPool,
    loading,
    tahapList,
    staffList,
    inventory,
    customers,
    pricelists,
    divisions,
    globalJobs,
    logs,
    error,
    fetchJobs,
    fetchMetadata,
    fetchAdminData,
    fetchCustomers,
    fetchPricelists,
    fetchDivisions,
    claimJob,
    startJob,
    forwardJob,
  } = useProductionData();

  const getDashboardUrl = () => {
    if (['owner', 'manager', 'admin'].includes(user?.role?.toLowerCase())) return '/dashboard';
    return '/staff-dashboard';
  };

  // Selected states for modals
  const [selectedWorkspaceJob, setSelectedWorkspaceJob] = useState(null);
  const [selectedForwardJob, setSelectedForwardJob] = useState(null);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTimeString(`${h}:${m}:${s}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set isAdminMode ONCE when user data is available (after AuthContext resolves)
  useEffect(() => {
    if (user && !modeInitialized) {
      const roleLower = user.role?.toLowerCase();
      const privileged = ['owner', 'manager', 'admin'].includes(roleLower);
      setIsAdminMode(privileged);
      
      let defaultTab = 'claim_pool';
      if (['owner', 'manager'].includes(roleLower)) {
        defaultTab = 'papan_kerja_spk';
      } else if (roleLower === 'admin') {
        defaultTab = 'global_list';
      }
      
      setActiveTab(defaultTab);
      setModeInitialized(true);
    }
  }, [user, modeInitialized]);

  // Fetch data hanya setelah mode diinisialisasi
  useEffect(() => {
    if (!modeInitialized) return;
    fetchMetadata();
    if (isAdminMode) {
      // Admin: fetchAdminData sudah include /jobs/ — tidak perlu fetchJobs() lagi
      fetchAdminData();
    } else {
      fetchJobs();
    }
  }, [isAdminMode, modeInitialized, fetchJobs, fetchMetadata, fetchAdminData]);

  // Real-time background polling every 5 seconds
  useEffect(() => {
    if (!modeInitialized) return;
    const intervalId = setInterval(() => {
      if (isAdminMode) {
        fetchAdminData();
      } else {
        fetchJobs(true); // Silent refresh
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [modeInitialized, isAdminMode, fetchAdminData, fetchJobs]);

  // Sync selectedWorkspaceJob with background updates
  useEffect(() => {
    if (selectedWorkspaceJob) {
      const listToSearch = isAdminMode ? globalJobs : jobs;
      const freshJob = listToSearch.find((j) => j.id === selectedWorkspaceJob.id);
      if (freshJob) {
        if (JSON.stringify(freshJob) !== JSON.stringify(selectedWorkspaceJob)) {
          setSelectedWorkspaceJob(freshJob);
        }
      }
    }
  }, [jobs, globalJobs, selectedWorkspaceJob, isAdminMode]);

  // Lazy load tab data dynamically on activeTab change
  useEffect(() => {
    if (!modeInitialized) return;
    if (activeTab === 'customers') {
      fetchCustomers();
    } else if (activeTab === 'pricelist') {
      fetchPricelists();
    } else if (activeTab === 'divisions') {
      fetchDivisions();
    }
  }, [activeTab, modeInitialized, fetchCustomers, fetchPricelists, fetchDivisions]);

  // Handle action triggers
  const handleClaim = async (jobId) => {
    const res = await claimJob(jobId);
    if (res.ok) {
      alert('Pekerjaan berhasil diklaim!');
    } else {
      alert(res.error);
    }
  };

  const handleStart = async (jobId) => {
    const res = await startJob(jobId);
    if (res.ok) {
      if (selectedWorkspaceJob && selectedWorkspaceJob.id === jobId) {
        setSelectedWorkspaceJob((prev) => ({ ...prev, status_pekerjaan: 'dikerjakan' }));
      }
    } else {
      alert(res.error);
    }
  };

  const handleComplete = (job) => {
    setSelectedForwardJob(job);
  };

  const handleForwardSubmit = async (jobId, data) => {
    setSavingAction(true);
    const res = await forwardJob(jobId, data);
    setSavingAction(false);
    if (res.ok) {
      setSelectedForwardJob(null);
      setSelectedWorkspaceJob(null);
      alert('Tugas berhasil diperbarui!');
    } else {
      alert(res.error);
    }
  };

  // Render current panel based on active tab
  const renderPanel = () => {
    if (isAdminMode) {
      switch (activeTab) {
        case 'papan_kerja_spk':
          return <PapanKerjaSpkPanel />;
        case 'kanban_global':
          return <KanbanGlobalPanel />;
        case 'global_list':
          return <GlobalListPanel />;
        case 'inventory':
          return <InventoryPanel items={inventory} refresh={fetchAdminData} />;
        case 'customers':
          return <CustomerPanel customers={customers} refresh={fetchAdminData} />;
        case 'pricelist':
          return <PricelistPanel items={pricelists} refresh={fetchAdminData} />;
        case 'divisions':
          return (
            <DivisionPanel
              divisions={divisions}
              staffList={staffList}
              globalJobs={globalJobs}
              tahapList={tahapList}
              refresh={fetchAdminData}
            />
          );
        case 'logs':
          return <ActivityLogsPanel logs={logs} />;
        default:
          if (['owner', 'manager'].includes(user?.role?.toLowerCase())) {
            return <PapanKerjaSpkPanel />;
          }
          return <GlobalListPanel />;
      }
    } else {
      // Staff Mode Panels
      switch (activeTab) {
        case 'claim_pool':
          return <ClaimPool claimPool={claimPool} onClaim={handleClaim} loading={loading} />;
        case 'kanban_personal':
          return (
            <KanbanPersonal
              jobs={jobs}
              onSelectJob={(job) => setSelectedWorkspaceJob(job)}
              onStart={handleStart}
              onComplete={handleComplete}
            />
          );
        case 'logs':
          return <ActivityLogsPanel logs={logs} />;
        default:
          return <ClaimPool claimPool={claimPool} onClaim={handleClaim} loading={loading} />;
      }
    }
  };

  const roleLower = user?.role?.toLowerCase();
  let menuItems = [];
  if (['owner', 'manager'].includes(roleLower)) {
    menuItems = [
      { id: 'papan_kerja_spk', label: 'Papan Kerja SPK', icon: ClipboardList },
      { id: 'global_list', label: 'Monitor Pesanan', icon: Globe },
      { id: 'inventory', label: 'Master Inventory', icon: Package },
      { id: 'customers', label: 'Database Konsumen', icon: Users },
      { id: 'pricelist', label: 'Daftar Harga', icon: Tag },
      { id: 'divisions', label: 'Monitoring Divisi', icon: FolderTree },
      { id: 'logs', label: 'Log Aktivitas', icon: Bell },
    ];
  } else if (roleLower === 'admin') {
    menuItems = [
      { id: 'global_list', label: 'Monitor Pesanan', icon: Globe },
      { id: 'inventory', label: 'Master Inventory', icon: Package },
      { id: 'customers', label: 'Database Konsumen', icon: Users },
      { id: 'pricelist', label: 'Daftar Harga', icon: Tag },
      { id: 'divisions', label: 'Monitoring Divisi', icon: FolderTree },
      { id: 'logs', label: 'Log Aktivitas', icon: Bell },
    ];
  } else {
    menuItems = [
      { id: 'claim_pool', label: 'Antrean Global', icon: Inbox },
      { id: 'kanban_personal', label: 'Pekerjaan Saya', icon: ClipboardList },
      { id: 'logs', label: 'Log Aktivitas', icon: Bell },
    ];
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#f1f5f9] text-[#0f172a] p-4 select-none font-sans">
        <div className="max-w-md w-full bg-white border border-[#e2e8f0] rounded-xl p-8 flex flex-col items-center text-center shadow-md gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center border-4 border-rose-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center border border-white text-white text-[11px] font-black">
              !
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
              Papan Kerja Ditutup
            </h2>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              PERHATIAN SYSTEM
            </p>
            <p className="text-[12px] text-slate-600 leading-relaxed font-semibold">
              Akses ke Papan Produksi dinonaktifkan secara otomatis. Anda dideteksi belum melakukan{' '}
              <strong>Absen Masuk (Clock-In)</strong> atau sudah melakukan{' '}
              <strong>Absen Pulang (Clock-Out)</strong> untuk hari ini.
            </p>
          </div>

          <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-left space-y-2.5">
            <p className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              ATURAN KEAMANAN OPERASIONAL
            </p>
            <div className="flex items-start gap-2.5 text-[11px] text-slate-650">
              <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[8px] font-black shrink-0">
                ✓
              </span>
              <span>
                <strong>Clock-In Aktif:</strong> Papan produksi dan pengerjaan tugas otomatis
                terbuka.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-[11px] text-slate-655 text-slate-650">
              <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[8px] font-black shrink-0">
                ✕
              </span>
              <span>
                <strong>Clock-Out Selesai:</strong> Papan produksi terkunci kembali demi keamanan
                data dan integritas waktu kerja.
              </span>
            </div>
          </div>

          <button
            onClick={() => (window.location.href = getDashboardUrl())}
            className="w-full py-2.5 bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all cursor-pointer text-center text-[12px]"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 h-screen w-screen bg-[#f1f5f9] text-[#0f172a] overflow-hidden font-sans text-[11px] select-none">
      {/* TOP BAR (HEADER STATUS) */}
      <div className="h-12 bg-white border border-[#e2e8f0] rounded-lg px-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (window.location.href = getDashboardUrl())}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-md font-extrabold transition-all cursor-pointer text-[10px]"
            title="Kembali ke Dashboard Utama"
          >
            <ArrowLeft size={11} />
            <span>Kembali</span>
          </button>
          <span className="text-slate-350 font-light text-slate-300">/</span>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-650 bg-indigo-600 text-white flex items-center justify-center font-black text-[10px]">
              P
            </div>
            <div className="font-extrabold text-[12px] text-slate-800 tracking-wider uppercase">
              Papan Produksi
            </div>
            <span className="text-slate-300 mx-1">|</span>
            <div className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase flex items-center gap-1">
              <span className="text-slate-400 text-[9px]">DIVISI:</span>
              <span className="bg-indigo-50 text-indigo-650 text-indigo-600 px-2 py-0.5 rounded font-black text-[9px] uppercase border border-indigo-100">
                {['owner', 'manager', 'admin'].includes(user?.role)
                  ? 'ADMIN'
                  : user?.divisi_nama || 'UMUM'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px]">
          <span className="bg-[#f8fafc] border border-[#e2e8f0] px-3 py-1 rounded-full font-bold flex items-center gap-1.5 text-slate-700 capitalize">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>
              {user?.username} ({user?.role})
            </span>
          </span>
          <span className="font-extrabold text-slate-800 tracking-wider">{timeString}</span>
        </div>
      </div>

      {/* THREE-COLUMN GRID */}
      <div
        className="flex-1 min-h-0 grid gap-2 transition-all duration-300 relative"
        style={{
          gridTemplateColumns: `${leftCollapsed ? '60px' : '220px'} 1fr ${rightCollapsed ? '0px' : '220px'}`,
        }}
      >
        {/* ================= PANEL KIRI ================= */}
        <div className="relative flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5">
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="absolute top-1 right-[-4px] z-10 w-4 h-4 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center font-extrabold text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all cursor-pointer"
          >
            {leftCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
          </button>

          {!leftCollapsed ? (
            <>
              {/* Profile & Absensi Card */}
              <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 flex flex-col gap-2 shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm uppercase">
                    {user?.username?.[0] || 'U'}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-800 leading-tight capitalize">
                      {user?.username}
                    </h4>
                    <p className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider">
                      {user?.role}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-[#e2e8f0] rounded-md p-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[8.5px] font-extrabold text-slate-400 tracking-wider">
                    <span>ABSEN HARI INI</span>
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black uppercase text-[8px]">
                      CLOCKED-IN
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = '/attendance';
                    }}
                    className="w-full text-center py-1 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold rounded-md transition-all cursor-pointer"
                  >
                    ABSENSI PANEL
                  </button>
                </div>
              </div>

              {/* Navigation Menu */}
              <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 flex flex-col gap-1 shadow-sm">
                <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1.5 mb-1">
                  NAVIGASI {isAdminMode ? 'ADMIN' : 'STAFF'}
                </div>
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-2 p-2 rounded-md transition-all text-left text-[10.5px] cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-600 font-bold border-l-2 border-indigo-600'
                          : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon size={14} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            // Collapsed Icons
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-2 flex flex-col gap-2 items-center shadow-sm h-full">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="w-full border-t border-slate-100 my-1"></div>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={item.label}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600 font-bold'
                        : 'hover:bg-slate-50 text-slate-400 hover:text-slate-650'
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= PANEL TENGAH (WORKSPACE UTAMA) ================= */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 shadow-md flex flex-col min-h-0 overflow-y-auto">
          {/* Stats Bar */}
          {activeTab === 'global_list' && isAdminMode && (
            <div className="grid grid-cols-3 gap-2 mb-3 shrink-0">
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2 flex flex-col justify-center">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-blue-500">
                  SPK AKTIF GLOBAL
                </span>
                <div className="text-sm font-black text-blue-700 mt-0.5">
                  {globalJobs.filter((j) => j.status_pekerjaan !== 'selesai').length} SPK
                </div>
              </div>
              <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-2 flex flex-col justify-center">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-rose-500">
                  DEADLINE KRITIS
                </span>
                <div className="text-sm font-black text-rose-700 mt-0.5">
                  {
                    globalJobs.filter(
                      (j) => j.status_pekerjaan !== 'selesai' && j.prioritas === 'tinggi'
                    ).length
                  }{' '}
                  JOB
                </div>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 flex flex-col justify-center">
                <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-500">
                  STAFF AKTIF
                </span>
                <div className="text-sm font-black text-emerald-700 mt-0.5">
                  {staffList.length} Org
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0">
            {selectedWorkspaceJob ? (
              <WorkspaceSPK
                job={selectedWorkspaceJob}
                onClose={() => setSelectedWorkspaceJob(null)}
                onStart={handleStart}
                onComplete={handleComplete}
                saving={savingAction}
              />
            ) : (
              renderPanel()
            )}
          </div>
        </div>

        {/* ================= PANEL KANAN ================= */}
        {!rightCollapsed ? (
          <div className="relative flex flex-col gap-2 min-h-0 overflow-y-auto pl-0.5">
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="absolute top-1 left-[-4px] z-10 w-4 h-4 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center font-extrabold text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all cursor-pointer"
            >
              <ChevronRight size={10} />
            </button>

            {/* Customer Details Context Widget */}
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 flex flex-col gap-2 shadow-sm shrink-0">
              <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1.5">
                DATA KONSUMEN TERKAIT
              </div>
              {selectedWorkspaceJob ? (
                <div className="flex flex-col gap-1.5 text-[10.5px]">
                  <div>
                    <span className="text-[8.5px] text-slate-400 uppercase font-extrabold block">
                      Nama Pelanggan
                    </span>
                    <span className="font-bold text-slate-800">
                      {selectedWorkspaceJob.pelanggan_nama ||
                        selectedWorkspaceJob.customer_name ||
                        'Umum'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-400 uppercase font-extrabold block">
                      WhatsApp
                    </span>
                    <span className="font-bold text-indigo-600">
                      {selectedWorkspaceJob.pelanggan_wa || selectedWorkspaceJob.customer_wa || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-400 uppercase font-extrabold block">
                      Order ID
                    </span>
                    <span className="font-bold text-slate-700">
                      #{selectedWorkspaceJob.order_id || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-400 uppercase font-extrabold block">
                      Item Detail
                    </span>
                    <span className="text-slate-600 font-semibold leading-tight block">
                      {selectedWorkspaceJob.nama_produk || '-'} (
                      {selectedWorkspaceJob.ukuran || '-'})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-center py-3 italic text-[10px] leading-relaxed">
                  Pilih tugas di Layar Tengah untuk menampilkan info detail konsumen.
                </div>
              )}
            </div>

            {/* Calendar Widget */}
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 flex flex-col gap-2 shadow-sm shrink-0">
              <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1.5">
                JADWAL KALENDER
              </div>
              <MiniCalendar />
            </div>

            {/* Critical Stock Alerts */}
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 flex flex-col gap-2 shadow-sm flex-1 min-h-[150px]">
              <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                <span>MONITOR STOK KRITIS</span>
                <span className="bg-red-100 text-red-700 px-1 rounded font-black text-[7.5px] uppercase">
                  Alert
                </span>
              </div>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[220px] pr-0.5">
                {inventory.filter((item) => item.stok <= item.min_stok).length > 0 ? (
                  inventory
                    .filter((item) => item.stok <= item.min_stok)
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`border-l-[3px] p-2 rounded flex flex-col gap-0.5 ${
                          item.stok === 0
                            ? 'border-red-500 bg-red-550 bg-red-50 text-red-950 text-red-900'
                            : 'border-amber-500 bg-amber-550 bg-amber-50 text-amber-950 text-amber-900'
                        }`}
                        style={{
                          backgroundColor:
                            item.stok === 0
                              ? 'rgba(239, 68, 68, 0.05)'
                              : 'rgba(245, 158, 11, 0.05)',
                        }}
                      >
                        <div className="flex justify-between items-start text-[10px] font-bold text-slate-800 leading-tight gap-2">
                          <span className="uppercase break-words flex-1">{item.nama}</span>
                          <span
                            className={`font-extrabold shrink-0 ${item.stok === 0 ? 'text-red-600' : 'text-amber-600'}`}
                          >
                            {item.stok} {item.satuan}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">
                          {item.stok === 0 ? 'Stok Habis!' : `Min: ${item.min_stok} ${item.satuan}`}
                        </span>
                      </div>
                    ))
                ) : (
                  <div className="text-slate-400 text-center py-6 italic text-[10px] flex flex-col items-center gap-1">
                    <span className="text-emerald-500 font-black text-[14px]">✓</span>
                    <span>Semua stok bahan baku aman.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Collapsed Right Handle
          <div className="w-0 relative">
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="absolute top-1 left-[-11px] z-10 w-4 h-4 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center font-extrabold text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all cursor-pointer"
            >
              <ChevronLeft size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Forward/Complete Dialog */}
      {selectedForwardJob && (
        <ForwardJobModal
          job={selectedForwardJob}
          orderMap={{ [selectedForwardJob.order_item]: selectedForwardJob.order_item_detail || {} }}
          tahapList={tahapList}
          staffList={staffList}
          saving={savingAction}
          onSubmit={handleForwardSubmit}
          onClose={() => setSelectedForwardJob(null)}
        />
      )}
    </div>
  );
}
