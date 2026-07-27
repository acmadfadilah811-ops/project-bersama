import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function PengaturanSupplier() {
  const [suppliers, setSuppliers] = useState([
    { id: 1, name: 'Jaya Sentosa, CV', payableAccount: '', dueDate: '' },
    { id: 2, name: 'Jaya Makmur, CV', payableAccount: '', dueDate: '' },
    { id: 3, name: 'Sinar Cemerlang, PT', payableAccount: '', dueDate: '' }
  ]);

  // Items limit size dropdown
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editPayableAccount, setEditPayableAccount] = useState('');

  useEffect(() => {
    function handleClickOutside(event) {
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setEditDueDate(supplier.dueDate || '');
    setEditPayableAccount(supplier.payableAccount || '');
    setIsModalOpen(true);
  };

  const handleSaveUpdate = () => {
    if (!editingSupplier) return;

    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === editingSupplier.id
          ? { ...s, dueDate: editDueDate, payableAccount: editPayableAccount }
          : s
      )
    );

    notify({
      type: 'success',
      title: 'Supplier Diperbarui',
      message: `Pengaturan supplier ${editingSupplier.name} berhasil diperbarui.`
    });

    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const payableAccountOptions = [
    '21000 - Hutang dagang',
    '21002 - Cash Example',
    '22000 - Hutang bank'
  ];

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Main Single Card Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
        
        {/* Header inside Card: Title on Left, Items per Page on Right */}
        <div className="flex items-center justify-between select-none border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-800 tracking-wide">
            Pengaturan Supplier
          </h3>

          <div className="relative" ref={pageSizeRef}>
            <button
              type="button"
              onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-3xs cursor-pointer font-bold"
            >
              <span>{pageSize} item</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {isPageSizeOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 w-28 text-left animate-fade-in font-bold">
                {[15, 25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setIsPageSizeOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                  >
                    {size} item
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table grid */}
        <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-3xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-6 py-4 w-[35%]">Nama Supplier</th>
                <th className="px-6 py-4 w-[30%]">Akun Hutang</th>
                <th className="px-6 py-4 w-[25%]">Jatuh Tempo</th>
                <th className="px-6 py-4 w-[10%] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-slate-700 font-semibold">{s.name}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {s.payableAccount || '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {s.dueDate ? `${s.dueDate} Hari` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(s)}
                      className="text-[#0088E8] hover:text-[#0066BB] font-bold text-xs cursor-pointer transition-colors"
                    >
                      Ubah
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="pt-2 flex items-center justify-end gap-5 text-xs font-semibold text-slate-500 select-none">
          <span>Total {suppliers.length}</span>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-350 cursor-not-allowed"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white font-bold">
              1
            </span>
            <button
              type="button"
              disabled
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-350 cursor-not-allowed"
            >
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>Go to</span>
            <input
              type="text"
              defaultValue="1"
              disabled
              className="w-9 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none select-none font-bold"
            />
          </div>
        </div>

      </div>

      {/* Ubah Supplier Modal (Screenshot 2) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[560px] overflow-hidden text-xs font-semibold text-slate-700 animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-[#F8FAFC]">
              <h4 className="text-sm font-bold text-slate-800">
                {editingSupplier?.name} Tanggal Bayar
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 border border-slate-200 bg-[#F4F5F7] hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveUpdate}
                  className="px-5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  Perbarui
                </button>
              </div>
            </div>

            {/* Modal Body Form */}
            <div className="p-6 space-y-5">
              
              {/* Jatuh Tempo */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Jatuh Tempo
                </label>
                <div className="flex border border-slate-205 rounded-xl overflow-hidden bg-white shadow-3xs focus-within:border-[#0088E8] transition-all">
                  <input
                    type="number"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    placeholder=""
                    className="flex-1 px-3.5 py-2.5 outline-none text-xs font-semibold text-slate-800"
                  />
                  <span className="px-4 py-2.5 bg-slate-50 text-slate-400 font-bold border-l border-slate-205 select-none text-xs flex items-center justify-center">
                    Hari
                  </span>
                </div>
              </div>

              {/* Akun Hutang */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Akun Hutang
                </label>
                <select
                  value={editPayableAccount}
                  onChange={(e) => setEditPayableAccount(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer text-xs ${
                    editPayableAccount ? 'text-slate-800 font-bold' : 'text-slate-400 font-semibold'
                  }`}
                >
                  <option value="" disabled hidden>Pilih Akun (Autocomplete)</option>
                  {payableAccountOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
