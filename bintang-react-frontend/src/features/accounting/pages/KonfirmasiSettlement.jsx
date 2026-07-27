import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function KonfirmasiSettlement() {
  // Date Range Filters
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateRef = useRef(null);

  // Mock settlement items
  const [settlements, setSettlements] = useState([
    { id: 1, startDate: '2026-07-24', period: 'Harian', amount: 4500000, status: 'Belum Terkonfirmasi', checked: false },
    { id: 2, startDate: '2026-07-25', period: 'Harian', amount: 3200000, status: 'Belum Terkonfirmasi', checked: false },
    { id: 3, startDate: '2026-07-26', period: 'Harian', amount: 5120000, status: 'Belum Terkonfirmasi', checked: false },
  ]);

  // Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Close Date Picker dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (dateRef.current && !dateRef.current.contains(e.target)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const formatDateLabel = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getActiveLabel = () => {
    if (dateFrom === dateTo) {
      if (dateFrom === '2026-07-26') return 'Hari ini';
      return formatDateLabel(dateFrom);
    }
    return `${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`;
  };

  const handleCheckboxChange = (id) => {
    setSettlements((prev) =>
      prev.map((item) =>
        item.id === id && item.status === 'Belum Terkonfirmasi'
          ? { ...item, checked: !item.checked }
          : item
      )
    );
  };

  const handleSelectAll = (e) => {
    const isChecked = e.target.checked;
    setSettlements((prev) =>
      prev.map((item) =>
        item.status === 'Belum Terkonfirmasi' ? { ...item, checked: isChecked } : item
      )
    );
  };

  const selectedItems = settlements.filter((item) => item.checked && item.status === 'Belum Terkonfirmasi');
  const totalAmountSelected = selectedItems.reduce((sum, item) => sum + item.amount, 0);
  const isConfirmEnabled = selectedItems.length > 0;

  const handleConfirmAction = () => {
    setSettlements((prev) =>
      prev.map((item) =>
        item.checked && item.status === 'Belum Terkonfirmasi'
          ? { ...item, status: 'Terkonfirmasi', checked: false }
          : item
      )
    );
    notify({
      type: 'success',
      title: 'Settlement Dikonfirmasi',
      message: `${selectedItems.length} periode settlement berhasil dikonfirmasi ke buku besar.`
    });
    setIsConfirmOpen(false);
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filter settlements based on date selection
  const filteredSettlements = settlements.filter((item) => {
    const itemDate = new Date(item.startDate);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return itemDate >= from && itemDate <= to;
  });

  const allChecked =
    filteredSettlements.length > 0 &&
    filteredSettlements.every((item) => item.checked || item.status === 'Terkonfirmasi');

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Konfirmasi Settlement</h2>
      </div>

      {/* Filters row (Screenshot 1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between overflow-visible">
        
        {/* Left Date Range filter */}
        <div ref={dateRef} className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-205 text-slate-655 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold text-xs"
          >
            <Calendar size={13} className="text-slate-400" />
            <span>{getActiveLabel()}</span>
            <ChevronDown size={12} className="text-slate-450" />
          </button>
          
          {showDatePicker && (
            <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg p-3 w-64 text-left font-bold animate-fade-in space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Tanggal Mulai</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Tanggal Akhir</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 bg-white"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('2026-07-26');
                    setDateTo('2026-07-26');
                    setShowDatePicker(false);
                  }}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-250 text-slate-650 rounded cursor-pointer"
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1 text-[10px] bg-[#0088E8] text-white rounded cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Konfirmasi Button */}
        <button
          type="button"
          onClick={() => isConfirmEnabled && setIsConfirmOpen(true)}
          disabled={!isConfirmEnabled}
          className={`px-4 py-1.5 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-2xs ${
            isConfirmEnabled
              ? 'bg-[#0088E8] hover:bg-[#0077CC] text-white cursor-pointer'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          }`}
        >
          Konfirmasi
        </button>
      </div>

      {/* Settlement Table Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredSettlements.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold text-xs bg-slate-50/10">
            No Data
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-3">Tanggal Mulai</th>
                  <th className="px-5 py-3">Periode</th>
                  <th className="px-5 py-3 text-right">Jumlah</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredSettlements.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={row.checked}
                        disabled={row.status === 'Terkonfirmasi'}
                        onChange={() => handleCheckboxChange(row.id)}
                        className={`rounded border-slate-300 cursor-pointer ${
                          row.status === 'Terkonfirmasi' ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                      />
                    </td>
                    <td className="px-5 py-3 text-slate-550">
                      {formatDateLabel(row.startDate)}
                    </td>
                    <td className="px-5 py-3 text-slate-800 font-bold">
                      {row.period}
                    </td>
                    <td className="px-5 py-3 text-right font-extrabold text-slate-800">
                      {formatIDR(row.amount)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === 'Terkonfirmasi'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-[#FFF9E6] text-[#D9A300]'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation settlement action modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 w-96 text-left space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Konfirmasi Settlement Transaksi
            </h3>
            <p className="text-xs font-semibold text-slate-550 leading-relaxed">
              Apakah Anda yakin ingin mengonfirmasi settlement untuk <span className="text-slate-800 font-bold">{selectedItems.length} transaksi terpilih</span> dengan total jumlah sebesar <span className="text-emerald-600 font-extrabold">IDR {formatIDR(totalAmountSelected)}</span>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-1.5 border border-slate-200 bg-white text-slate-655 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
