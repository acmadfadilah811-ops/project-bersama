import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Plus, X, Loader2 } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function TransferModal() {
  // Date Range Filters
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateRef = useRef(null);

  // List of transfer modals
  const [transfers, setTransfers] = useState([
    {
      id: 1,
      date: '2026-07-26',
      storeName: 'Bintang Advertising pusat',
      description: 'Modal Awal Kasir Pagi',
      amount: 1500000,
      debitAcc: '11101 Kas',
      creditAcc: '11102 Bank',
      type: 'Transfer'
    }
  ]);

  // Form Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [destStore, setDestStore] = useState('');
  const [txDate, setTxDate] = useState('2026-07-26');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [debitAcc, setDebitAcc] = useState('11101 Kas');
  const [creditAcc, setCreditAcc] = useState('11102 Bank');
  const [destDebitAcc, setDestDebitAcc] = useState('');
  const [destCreditAcc, setDestCreditAcc] = useState('');

  // Dropdown lists
  const storeOptions = [
    'Bintang Advertising pusat',
    'Bintang Advertising cabang A',
    'Bintang Advertising cabang B',
  ];

  const debitAccountOptions = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '21000 Hutang Usaha',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
    '50000 Pembelian',
    '60100 Biaya Gaji',
    '60200 Biaya Listrik & Air',
    '81000 Penyesuaian Barang'
  ];

  const creditAccountOptions = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran'
  ];

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

  const handleSave = () => {
    if (!destStore) {
      notify({
        type: 'warning',
        title: 'Validasi Gagal',
        message: 'Silakan pilih Destinasi Toko terlebih dahulu.'
      });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      notify({
        type: 'warning',
        title: 'Validasi Gagal',
        message: 'Silakan masukkan jumlah transfer modal yang valid.'
      });
      return;
    }

    const newTransfer = {
      id: Date.now(),
      date: txDate,
      storeName: destStore,
      description: description || 'Transfer Modal',
      amount: Number(amount),
      debitAcc: debitAcc,
      creditAcc: creditAcc,
      type: 'Transfer'
    };

    setTransfers([newTransfer, ...transfers]);
    notify({
      type: 'success',
      title: 'Berhasil Disimpan',
      message: `Transfer modal ke ${destStore} sebesar IDR ${formatIDR(amount)} berhasil disimpan.`
    });

    // Reset Form
    setDestStore('');
    setAmount('');
    setDescription('');
    setIsAddOpen(false);
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filter list based on selected dates
  const filteredTransfers = transfers.filter((item) => {
    const itemDate = new Date(item.date);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return itemDate >= from && itemDate <= to;
  });

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Transfer Modal</h2>
      </div>

      {/* Filters row (Screenshot 1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between overflow-visible">
        
        {/* Left Date Range filter */}
        <div ref={dateRef} className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-205 text-slate-655 hover:bg-slate-55 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold text-xs"
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

        {/* Right + Tambah button (Screenshot 1) */}
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
        >
          <Plus size={13} />
          <span>Tambah</span>
        </button>
      </div>

      {/* Transfer Modals List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredTransfers.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold text-xs bg-slate-50/10">
            No Data
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Nama Toko</th>
                  <th className="px-5 py-3">Transaksi</th>
                  <th className="px-5 py-3 text-right">Jumlah</th>
                  <th className="px-5 py-3">Debit</th>
                  <th className="px-5 py-3">Kredit</th>
                  <th className="px-5 py-3 text-center">Tipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredTransfers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                    <td className="px-5 py-3 text-slate-550">
                      {formatDateLabel(row.date)}
                    </td>
                    <td className="px-5 py-3 text-slate-800 font-bold">
                      {row.storeName}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {row.description}
                    </td>
                    <td className="px-5 py-3 text-right font-extrabold text-slate-800">
                      {formatIDR(row.amount)}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{row.debitAcc}</td>
                    <td className="px-5 py-3 text-slate-500">{row.creditAcc}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E6F4FF] text-[#0958D9]">
                        {row.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transfer Modal (Screenshot 2) */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[700px] text-left overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-sm font-bold text-slate-800">
                Tambah Transfer
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Tutup
              </button>
            </div>

            {/* Left and Right Input Fields (Screenshot 2) */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column */}
              <div className="space-y-4">
                {/* Destinasi Toko select */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Destinasi Toko</label>
                  <select
                    value={destStore}
                    onChange={(e) => setDestStore(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                  >
                    <option value="">Pilih</option>
                    {storeOptions.map((store) => (
                      <option key={store} value={store}>
                        {store}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tanggal input */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Tanggal</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] text-xs font-bold text-slate-700 bg-white shadow-2xs"
                  />
                </div>

                {/* Jumlah input (prefixed with IDR select) */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Jumlah</label>
                  <div className="flex border border-slate-200 rounded-lg overflow-hidden shadow-2xs bg-white focus-within:border-[#0088E8]">
                    <div className="px-3.5 bg-slate-50 border-r border-slate-200 flex items-center justify-center font-bold text-slate-500 text-[10px]">
                      IDR
                    </div>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 px-3 py-1.5 outline-none text-xs text-slate-800 font-semibold"
                    />
                  </div>
                </div>

                {/* Deskripsi textarea */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Deskripsi</label>
                  <textarea
                    placeholder="Masukkan deskripsi..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 shadow-2xs min-h-[75px]"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Akun Debit select */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Akun Debit</label>
                  <select
                    value={debitAcc}
                    onChange={(e) => setDebitAcc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                  >
                    {debitAccountOptions.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Akun Kredit select */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Akun Kredit</label>
                  <select
                    value={creditAcc}
                    onChange={(e) => setCreditAcc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                  >
                    {creditAccountOptions.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Menuju Debit Akun select */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Menuju Debit Akun</label>
                  <select
                    value={destDebitAcc}
                    onChange={(e) => setDestDebitAcc(e.target.value)}
                    disabled={!destStore}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-755 shadow-2xs ${
                      destStore ? 'cursor-pointer' : 'cursor-not-allowed bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    {!destStore ? (
                      <option value="">No Data</option>
                    ) : (
                      <>
                        <option value="">Pilih</option>
                        {debitAccountOptions.map((acc) => (
                          <option key={acc} value={acc}>
                            {acc}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                {/* Menuju Kredit Akun select */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold">Menuju Kredit Akun</label>
                  <select
                    value={destCreditAcc}
                    onChange={(e) => setDestCreditAcc(e.target.value)}
                    disabled={!destStore}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-755 shadow-2xs ${
                      destStore ? 'cursor-pointer' : 'cursor-not-allowed bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    {!destStore ? (
                      <option value="">No Data</option>
                    ) : (
                      <>
                        <option value="">Pilih</option>
                        {creditAccountOptions.map((acc) => (
                          <option key={acc} value={acc}>
                            {acc}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-10 py-2 border border-slate-200 bg-white text-slate-655 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-10 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Simpan
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
