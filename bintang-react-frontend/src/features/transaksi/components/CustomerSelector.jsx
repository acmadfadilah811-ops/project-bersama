import { Plus } from 'lucide-react';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

export default function CustomerSelector({
  customerSearch,
  onSearchCustomer,
  customers,
  onSelectCustomer,
  showDropdown,
  setShowDropdown,
  showAddCustomer,
  setShowAddCustomer,
  newCustomer,
  setNewCustomer,
  onAddCustomer,
}) {
  const updateField = (field, val) => {
    setNewCustomer((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div className="max-w-2xl space-y-3">
      <div>
        <label className="text-sm font-bold text-blue-600 flex items-center gap-1">
          Pelanggan <span className="text-red-500">*</span>
        </label>
        <span className="text-xs text-slate-400 block mb-2">Nama atau email</span>
        <div className="relative">
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => onSearchCustomer(e.target.value)}
            placeholder="Cari berdasarkan nama / email"
            className={inputClass}
          />
          
          {showDropdown && customers.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-50">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(c);
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex justify-between items-center cursor-pointer"
                >
                  <span className="font-semibold text-slate-800">{c.nama}</span>
                  <span className="text-slate-400 font-mono">{c.handphone || c.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Pelanggan tidak ditemukan? Daftarkan pelanggan baru</span>
        <button
          type="button"
          onClick={() => setShowAddCustomer(!showAddCustomer)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-1.5 flex items-center justify-center cursor-pointer transition-colors shadow-sm"
          title="Daftarkan Kontak Baru"
        >
          <Plus size={16} />
        </button>
      </div>

      {showAddCustomer && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 space-y-4 max-w-2xl animate-fade-in">
          <p className="text-xs font-bold text-slate-700">Daftarkan Pelanggan Baru</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Nama *</label>
              <input 
                type="text" 
                placeholder="Nama Pelanggan" 
                value={newCustomer.nama || ''} 
                onChange={e => updateField('nama', e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Contact Person / Perusahaan</label>
              <input 
                type="text" 
                placeholder="Contact Person / Perusahaan" 
                value={newCustomer.nama_perusahaan || ''} 
                onChange={e => updateField('nama_perusahaan', e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Email</label>
              <input 
                type="email" 
                placeholder="email@domain.com" 
                value={newCustomer.email || ''} 
                onChange={e => updateField('email', e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Telepon / HP *</label>
              <input 
                type="text" 
                placeholder="0812..." 
                value={newCustomer.handphone || ''} 
                onChange={e => updateField('handphone', e.target.value)} 
                className={inputClass} 
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Alamat</label>
              <textarea 
                placeholder="Alamat Lengkap" 
                value={newCustomer.alamat || ''} 
                onChange={e => updateField('alamat', e.target.value)} 
                rows={2}
                className={`${inputClass} resize-none`} 
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Kode Pos</label>
              <input 
                type="text" 
                placeholder="12345" 
                value={newCustomer.kode_pos || ''} 
                onChange={e => updateField('kode_pos', e.target.value)} 
                className={inputClass} 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 text-xs pt-2">
            <button 
              type="button" 
              onClick={() => setShowAddCustomer(false)} 
              className="px-3 py-1.5 text-slate-500 hover:bg-slate-200/50 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="button" 
              onClick={onAddCustomer} 
              className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 cursor-pointer shadow-sm"
            >
              Daftarkan & Pilih
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
