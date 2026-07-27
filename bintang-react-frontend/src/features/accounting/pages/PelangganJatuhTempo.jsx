import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import UbahJatuhTempoModal from '../components/pos/UbahJatuhTempoModal';

export default function PelangganJatuhTempo() {
  const [dueCustomers, setDueCustomers] = useState([
    { id: 1, name: 'KEVIN', address: '-', due: '-' },
    { id: 2, name: 'AGUS', address: '-', due: '-' },
    { id: 3, name: 'BAYU', address: '-', due: '-' },
    { id: 4, name: 'Bella', address: 'Jalan Angkasa Pura No. 17', due: '-' },
    { id: 5, name: 'Dika', address: 'Jalan Angkasa Pura No. 16', due: '-' },
    { id: 6, name: 'PT Sinar Cemerlang', address: 'Jalan Angkasa Pura No. 15', due: '-' },
    { id: 7, name: 'Gm h', address: '-', due: '-' }
  ]);

  const [selectedDueCustomer, setSelectedDueCustomer] = useState(null);
  const [isUbahDueOpen, setIsUbahDueOpen] = useState(false);
  const [duePageSize, setDuePageSize] = useState(15);
  const [isDuePageSizeOpen, setIsDuePageSizeOpen] = useState(false);
  const duePageSizeRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (duePageSizeRef.current && !duePageSizeRef.current.contains(event.target)) {
        setIsDuePageSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header Title Panel matching Screenshot 1 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-2xs select-none">
        <h3 className="text-sm font-bold text-slate-800">
          Pelanggan Jatuh Tempo
        </h3>
        
        {/* Page Size Dropdown */}
        <div className="relative" ref={duePageSizeRef}>
          <button
            type="button"
            onClick={() => setIsDuePageSizeOpen(!isDuePageSizeOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
          >
            <span>{duePageSize} item</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {isDuePageSizeOpen && (
            <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 w-28 font-semibold text-slate-700 text-left animate-fade-in">
              {[15, 25, 50, 100].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setDuePageSize(size);
                    setIsDuePageSizeOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {size} item
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area / Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 space-y-4 min-h-[360px] relative">
        
        <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-5 py-3.5 w-[35%] rounded-tl-lg">Nama Pelanggan</th>
                <th className="px-5 py-3.5 w-[35%]">Alamat</th>
                <th className="px-5 py-3.5 w-[20%]">Jatuh Tempo</th>
                <th className="px-5 py-3.5 w-[10%] text-center rounded-tr-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dueCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-800 font-bold">
                    {cust.name}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 font-semibold">
                    {cust.address}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 font-semibold">
                    {cust.due}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDueCustomer(cust);
                        setIsUbahDueOpen(true);
                      }}
                      className="text-[#0088E8] hover:underline font-extrabold cursor-pointer text-xs"
                    >
                      Ubah
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <div>
            <span>Total {dueCustomers.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &lt;
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &gt;
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-8 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Modal: Ubah Jatuh Tempo */}
      <UbahJatuhTempoModal
        isOpen={isUbahDueOpen}
        onClose={() => {
          setIsUbahDueOpen(false);
          setSelectedDueCustomer(null);
        }}
        customer={selectedDueCustomer}
        onUpdate={(id, days) => {
          setDueCustomers((prev) =>
            prev.map((c) => (c.id === id ? { ...c, due: `${days} Hari` } : c))
          );
        }}
      />

    </div>
  );
}
