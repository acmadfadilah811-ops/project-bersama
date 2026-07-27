import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Package,
  Users,
  Tag,
  FolderTree,
  Globe,
  Bell,
  Inbox,
  ClipboardList,
} from 'lucide-react';

export default function Sidebar({ collapsed, setCollapsed, activeTab, setActiveTab, isAdmin }) {
  const menuItems = isAdmin
    ? [
        { id: 'global_list', label: 'List Order Global', icon: Globe },
        { id: 'create_order', label: 'Buat Order', icon: ShoppingCart },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'customers', label: 'Konsumen', icon: Users },
        { id: 'pricelist', label: 'Daftar Harga', icon: Tag },
        { id: 'divisions', label: 'List Divisi', icon: FolderTree },
        { id: 'logs', label: 'Notifikasi & Logs', icon: Bell },
      ]
    : [
        { id: 'claim_pool', label: 'Antrean Global Divisi', icon: Inbox },
        { id: 'kanban_personal', label: 'Pekerjaan Saya', icon: ClipboardList },
        { id: 'logs', label: 'Logs Aktivitas', icon: Bell },
      ];

  return (
    <div
      className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 border-r border-slate-800 ${
        collapsed ? 'w-[64px]' : 'w-[240px]'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
              B
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Papan Produksi</h1>
              <p className="text-sm text-slate-500 font-medium">Bintang Advertising</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Menu List */}
      <div className="flex-1 py-4 space-y-1.5 px-3 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 text-center">
        {!collapsed ? (
          <p className="text-sm text-slate-600 font-semibold uppercase tracking-wider">
            v5.1 Production
          </p>
        ) : (
          <span className="text-sm text-slate-600 font-black">V5</span>
        )}
      </div>
    </div>
  );
}
