import { useAuth } from '../context/AuthContext';
import { Bell, Search } from 'lucide-react';

export default function Nav() {
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-between mb-2">
      {/* Search bar (opsional, bisa dikembangkan) */}
      <div className="relative hidden sm:flex items-center">
        <Search size={14} className="absolute left-3 text-gray-500" />
        <input
          type="text"
          placeholder="Cari sesuatu..."
          className="pl-9 pr-4 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-600 w-56"
        />
      </div>

      {/* Kanan: Notifikasi & Info User */}
      <div className="flex items-center gap-3 ml-auto">
        <button className="relative p-1.5 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors">
          <Bell size={16} />
        </button>

        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700">
          <div className="w-5 h-5 rounded-full bg-gray-700 overflow-hidden shrink-0">
            {user?.foto_profil ? (
              <img src={user.foto_profil} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-gray-400">
                {user?.username?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-white capitalize leading-none">
              {user?.username}
            </p>
            <p className="text-[8px] text-gray-500 font-medium capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
