import { useState, useRef, useEffect } from 'react';
import { Search, FileText, Check, X, Loader2 } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function CaraPembayaran() {
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // Simulated initial payment channels data
  const [payments, setPayments] = useState([
    { id: 1, name: 'CASH', type: 'Tunai', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 2, name: 'Cashlez', type: 'Cashlez', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 3, name: 'Go-Pay', type: 'Go-Pay', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 4, name: 'Grab Cash', type: 'Grab Cash', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 5, name: 'Grab Cashlez', type: 'Grab Cashlez', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 6, name: 'Marketplace Tokopedia', type: 'Tokopedia', payAccount: '11103 Kas in register', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 7, name: 'Marketplace Shopee', type: 'Shopee', payAccount: '11103 Kas in register', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 8, name: 'Marketplace Lazada', type: 'Lazada', payAccount: '11103 Kas in register', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 9, name: 'Marketplace Blibli', type: 'Blibli', payAccount: '11103 Kas in register', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 10, name: 'Marketplace Bukalapak', type: 'Bukalapak', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 11, name: 'Marketplace TikTok', type: 'TikTok', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
    { id: 12, name: 'Qris by Netzme', type: 'Olsera-Qris', payAccount: '11101 Kas', debitMdr: '', creditMdr: '', savedDebitMdr: '', savedCreditMdr: '', rating: 0 },
  ]);

  // Logs state for each payment channel
  const [logs, setLogs] = useState({
    1: [{ time: '2026-07-25 08:00', user: 'System', detail: 'Setup Awal Pembayaran CASH' }],
    2: [{ time: '2026-07-25 08:00', user: 'System', detail: 'Setup Awal Pembayaran Cashlez' }],
    3: [{ time: '2026-07-25 08:00', user: 'System', detail: 'Setup Awal Pembayaran Go-Pay' }],
  });

  const debitOptions = [
    { value: '', label: 'Kosong' },
    { value: '50000', label: '50000 Pembelian' },
    { value: '50100', label: '50100 Pembelian antar cabang' },
    { value: '50300', label: '50300 Biaya pengiriman' },
    { value: '51000', label: '51000 Harga pokok penjualan' },
    { value: '50400', label: '50400 Return pembelian' },
    { value: '50500', label: '50500 Potongan pembelian' },
    { value: '60100', label: '60100 Biaya gaji' },
    { value: '60200', label: '60200 Biaya air listrik telephone' },
    { value: '60300', label: '60300 Biaya perlengkapan' },
    { value: '60400', label: '60400 Biaya penyusutan' },
    { value: '60500', label: '60500 Biaya transfer' },
  ];

  const creditOptions = [
    { value: '', label: 'Kosong' },
    { value: '11101', label: '11101 Kas' },
    { value: '11102', label: '11102 Bank' },
    { value: '11103', label: '11103 Kas in register' },
    { value: '11104', label: '11104 Giro' },
  ];

  // Save Modal States
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [pendingSaveRow, setPendingSaveRow] = useState(null);

  // History Log Modal States
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logPaymentName, setLogPaymentName] = useState('');
  const [activeLogs, setActiveLogs] = useState([]);

  const handleFieldChange = (id, field, value) => {
    setPayments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRatingChange = (id, direction) => {
    setPayments((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const currentRating = item.rating || 0;
          const newRating = direction === 'up' ? currentRating + 1 : Math.max(0, currentRating - 1);
          return { ...item, rating: newRating };
        }
        return item;
      })
    );
  };

  const handleCancelChanges = (id) => {
    setPayments((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, debitMdr: item.savedDebitMdr, creditMdr: item.savedCreditMdr }
          : item
      )
    );
    notify({
      type: 'info',
      title: 'Dibatalkan',
      message: 'Perubahan biaya MDR dibatalkan.'
    });
  };

  const triggerSaveCheck = (row) => {
    setPendingSaveRow(row);
    setIsSaveModalOpen(true);
  };

  const confirmSaveMdr = () => {
    if (!pendingSaveRow) return;

    const rowId = pendingSaveRow.id;
    const debitLabel = debitOptions.find((d) => d.value === pendingSaveRow.debitMdr)?.label || 'Kosong';
    const creditLabel = creditOptions.find((c) => c.value === pendingSaveRow.creditMdr)?.label || 'Kosong';

    setPayments((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? { ...item, savedDebitMdr: item.debitMdr, savedCreditMdr: item.creditMdr }
          : item
      )
    );

    // Append to logs
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 16);
    const logText = `Mengubah Debit MDR ke "${debitLabel}" dan Kredit MDR ke "${creditLabel}"`;
    const newLogEntry = { time: timeStr, user: 'owner_brendy', detail: logText };

    setLogs((prev) => ({
      ...prev,
      [rowId]: [newLogEntry, ...(prev[rowId] || [])],
    }));

    notify({
      type: 'success',
      title: 'Perubahan Disimpan',
      message: `Biaya MDR untuk ${pendingSaveRow.name} berhasil diperbarui.`
    });

    setIsSaveModalOpen(false);
    setPendingSaveRow(null);
  };

  const openHistoryLog = (row) => {
    const rowLogs = logs[row.id] || [
      { time: new Date().toISOString().replace('T', ' ').substring(0, 16), user: 'System', detail: 'Setup Awal Pembayaran' },
    ];
    setLogPaymentName(row.name);
    setActiveLogs(rowLogs);
    setIsLogModalOpen(true);
  };

  const filteredPayments = payments.filter((item) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      item.name.toLowerCase().includes(kw) ||
      item.type.toLowerCase().includes(kw) ||
      item.payAccount.toLowerCase().includes(kw)
    );
  });

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Top filter search bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Cara Pembayaran</h2>

        <div className="flex items-center gap-3">
          {/* Keyword Search Box */}
          <div className="relative w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={12} />
            </span>
            <input
              type="text"
              placeholder="Ketikan keyword"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg text-xs bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold shadow-2xs"
            />
          </div>

          {/* Atur Akun Button */}
          <button
            type="button"
            onClick={() => notify({ type: 'info', title: 'Atur Akun', message: 'Fitur Atur Akun akan segera hadir.' })}
            className="px-4 py-1.5 border border-[#73C240] text-[#73C240] bg-white hover:bg-[#73C240]/5 rounded-lg cursor-pointer font-bold transition-colors shadow-2xs"
          >
            Atur Akun
          </button>
        </div>
      </div>

      {/* Main Cara Pembayaran Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 w-10">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Tipe</th>
                <th className="px-5 py-3">Akun Pembayaran</th>
                <th className="px-5 py-3 w-52">Debit (MDR)</th>
                <th className="px-5 py-3 w-52">Kredit (MDR)</th>
                <th className="px-5 py-3 text-center w-28">Rating (MDR)</th>
                <th className="px-5 py-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {filteredPayments.map((row) => {
                // If debitMdr and creditMdr are selected (meaning not empty/blank)
                // and at least one is different from saved state
                const isModified =
                  row.debitMdr !== row.savedDebitMdr || row.creditMdr !== row.savedCreditMdr;
                
                const hasInputValues = row.debitMdr !== '' || row.creditMdr !== '';

                return (
                  <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                    <td className="px-5 py-3">
                      <input type="checkbox" className="rounded border-slate-300 cursor-pointer" />
                    </td>
                    <td className="px-5 py-3 text-slate-800 font-bold">
                      {row.name}
                    </td>
                    <td className="px-5 py-3 text-slate-550">
                      {row.type}
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-medium">
                      {row.payAccount}
                    </td>

                    {/* Debit MDR select */}
                    <td className="px-5 py-3">
                      <select
                        value={row.debitMdr}
                        onChange={(e) => handleFieldChange(row.id, 'debitMdr', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                      >
                        {debitOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Kredit MDR select */}
                    <td className="px-5 py-3">
                      <select
                        value={row.creditMdr}
                        onChange={(e) => handleFieldChange(row.id, 'creditMdr', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                      >
                        {creditOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Rating MDR input with up/down controls */}
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center border border-slate-200 rounded-lg bg-white w-20 mx-auto overflow-hidden">
                        <div className="px-2 py-1 text-slate-700 font-bold select-none text-center flex-1">
                          {row.rating || 0}
                        </div>
                        <div className="flex flex-col border-l border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleRatingChange(row.id, 'up')}
                            className="px-1.5 py-0.5 hover:bg-slate-50 text-[8px] text-slate-400 hover:text-slate-700 font-bold border-b border-slate-200 transition-colors"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRatingChange(row.id, 'down')}
                            className="px-1.5 py-0.5 hover:bg-slate-50 text-[8px] text-slate-400 hover:text-slate-700 font-bold transition-colors"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Aksi Column: Check/X buttons if modified, otherwise Document log icon */}
                    <td className="px-5 py-3 text-center">
                      {isModified ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCancelChanges(row.id)}
                            className="p-1 rounded bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                            title="Batalkan Perubahan"
                          >
                            <X size={13} className="stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerSaveCheck(row)}
                            className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                            title="Simpan Perubahan"
                          >
                            <Check size={13} className="stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openHistoryLog(row)}
                          className="p-1 text-[#0088E8] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Lihat Log Riwayat"
                        >
                          <FileText size={14} className="stroke-[2.2]" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Save Changes Modal */}
      {isSaveModalOpen && pendingSaveRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 w-96 text-left space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Simpan Perubahan Biaya MDR
            </h3>
            <p className="text-xs font-semibold text-slate-550 leading-relaxed">
              Apakah Anda yakin ingin menyimpan perubahan biaya MDR (Merchant Discount Rate) untuk tipe pembayaran <span className="text-slate-800 font-bold">{pendingSaveRow.name}</span>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSaveModalOpen(false);
                  setPendingSaveRow(null);
                }}
                className="px-4 py-1.5 border border-slate-200 bg-white text-slate-650 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmSaveMdr}
                className="px-4 py-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Log Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 w-[420px] text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                Log Riwayat Biaya MDR - {logPaymentName}
              </h3>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {activeLogs.map((log, idx) => (
                <div key={idx} className="border-b border-slate-50 pb-2 last:border-0">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>{log.time}</span>
                    <span className="text-[#0088E8]">{log.user}</span>
                  </div>
                  <p className="text-xs text-slate-700 font-semibold mt-0.5">
                    {log.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
