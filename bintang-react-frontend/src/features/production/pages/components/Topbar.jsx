import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { LogOut, Shield } from 'lucide-react';

export default function Topbar({ isAdminMode, setIsAdminMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Roles that are allowed to see/toggle admin views
  const isPrivileged = user && ['owner', 'manager', 'admin'].includes(user.role);

  const handleExit = () => {
    const role = user?.role?.toLowerCase();
    if (role === 'staff') {
      navigate('/staff-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm">
      {/* Left side: Greeting */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-slate-800">
          Selamat Datang, <span className="text-indigo-600">{user?.username}</span>
        </h2>
        {user?.role === 'staff' && user?.nip && (
          <span className="bg-slate-100 text-slate-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
            NIP: {user.nip}
          </span>
        )}
        {user?.divisi_nama && (
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-md">
            Divisi: {user.divisi_nama}
          </span>
        )}
      </div>

      {/* Right side: Controls & Profile */}
      <div className="flex items-center gap-4">
        {/* Privileged Role Switcher */}
        {isPrivileged && (
          <button
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isAdminMode
                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Shield size={14} />
            <span>Mode: {isAdminMode ? 'Admin / Kasir' : 'Staff Produksi'}</span>
          </button>
        )}

        {/* User Info / Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-700 capitalize leading-tight">
              {user?.role === 'owner' ? 'Owner' : user?.role || 'Karyawan'}
            </p>
            <p className="text-[9px] font-medium text-slate-400">Online</p>
          </div>

          <button
            onClick={handleExit}
            title="Kembali ke Aplikasi Utama"
            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
