import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Plus, X, Loader2, RefreshCw } from 'lucide-react';
import { notify } from '../../../utils/notify';
import apiClient from '../../../api/apiClient';

export default function TransferModal() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getDaysAgoStr = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const [dateFrom, setDateFrom] = useState(getDaysAgoStr(30));
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateRef = useRef(null);

  // List & Accounts State
  const [transfers, setTransfers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [destStore, setDestStore] = useState('StarPhoto & Advertising pusat');
  const [txDate, setTxDate] = useState(getTodayStr());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [debitAccId, setDebitAccId] = useState('');
  const [creditAccId, setCreditAccId] = useState('');
  const [destDebitAccId, setDestDebitAccId] = useState('');
  const [destCreditAccId, setDestCreditAccId] = useState('');

  // Dropdown lists
  const storeOptions = [
    'StarPhoto & Advertising pusat',
    'StarPhoto & Advertising cabang A',
    'StarPhoto & Advertising cabang B',
  ];

  useEffect(() => {
    const handleOutside = (e) => {
      if (dateRef.current && !dateRef.current.contains(e.target)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch Accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await apiClient.get('/accounting/accounts/');
        const data = res.data.results || res.data || [];
        setAccounts(data);
        if (data.length >= 2) {
          setDebitAccId(data[0].id.toString());
          setCreditAccId(data[1].id.toString());
          setDestDebitAccId(data[0].id.toString());
          setDestCreditAccId(data[1].id.toString());
        }
      } catch (err) {
        console.error('Gagal memuat COA:', err);
      }
    }
    fetchAccounts();
  }, []);

  // Fetch Transfers
  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        source_type: 'manual',
      };
      const res = await apiClient.get('/accounting/journal-entries/', { params });
      setTransfers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Gagal memuat transfer modal:', err);
      notify({
        type: 'error',
        title: 'Gagal Memuat Data',
        message: err.response?.data?.detail || 'Gagal memuat data transfer modal.',
      });
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [dateFrom, dateTo]);

  // Save Transfer Journal Entry
  const handleSave = async () => {
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
        message: 'Nominal transfer modal harus lebih dari 0.',
      });
      return;
    }
    if (!debitAccId || !creditAccId) {
      notify({
        type: 'warning',
        title: 'Validasi Gagal',
        message: 'Akun Debit dan Kredit wajib dipilih.',
      });
      return;
    }
    if (debitAccId === creditAccId) {
      notify({
        type: 'warning',
        title: 'Validasi Gagal',
        message: 'Akun Debit dan Kredit tidak boleh sama.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: txDate,
        description: description || `Transfer Modal ke ${destStore}`,
        source_type: 'manual',
        lines: [
          { account: Number(debitAccId), debit: Number(amount), kredit: 0 },
          { account: Number(creditAccId), debit: 0, kredit: Number(amount) },
        ],
      };

      await apiClient.post('/accounting/journal-entries/', payload);
      notify({
        type: 'success',
        title: 'Transfer Berhasil',
        message: `Jurnal transfer modal ke ${destStore} berhasil disimpan dan diposting.`,
      });

      setIsAddOpen(false);
      setAmount('');
      setDescription('');
      fetchTransfers();
    } catch (err) {
      console.error('Gagal menyimpan transfer modal:', err);
      notify({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err.response?.data?.detail || 'Gagal membuat jurnal transfer modal.',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatIDR = (num) => {
    return (Number(num) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Transfer Modal</h2>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>Tambah Transfer Modal</span>
        </button>
      </div>

      {/* Filters row */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between">
        <div ref={dateRef} className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold text-xs"
          >
            <Calendar size={13} className="text-slate-400" />
            <span>{dateFrom} s/d {dateTo}</span>
            <ChevronDown size={12} className="text-slate-400" />
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
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1 text-[10px] bg-[#0088E8] text-white rounded cursor-pointer font-bold"
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={fetchTransfers}
          className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs font-bold"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-xs gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#0088E8]" />
            <span>Memuat jurnal transfer modal...</span>
          </div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold text-xs">
            Belum ada transaksi transfer modal untuk periode ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 w-12">No</th>
                  <th className="px-5 py-3">No. Jurnal</th>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Deskripsi</th>
                  <th className="px-5 py-3 text-right">Nominal</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {transfers.map((item, idx) => {
                  const totalAmt = (item.lines || []).reduce((sum, l) => sum + Number(l.debit || 0), 0);
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-5 py-3 font-bold text-[#0088E8]">{item.entry_number || `#JE-${item.id}`}</td>
                      <td className="px-5 py-3">{item.date}</td>
                      <td className="px-5 py-3 text-slate-800">{item.description}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">Rp {formatIDR(totalAmt)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.status || 'Posted'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <div>Menampilkan {transfers.length} entri transfer modal</div>
        </div>
      </div>

      {/* Add Modal Form (Full 2-Column Layout) */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in text-xs font-semibold text-slate-700">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[640px] overflow-hidden relative">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Transfer Modal</h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-650 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content: 2-Column Layout */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Destinasi Toko</label>
                    <select
                      value={destStore}
                      onChange={(e) => setDestStore(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                    >
                      {storeOptions.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Tanggal</label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Jumlah (IDR)</label>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-bold text-slate-900 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Keterangan</label>
                    <textarea
                      rows={2}
                      placeholder="Modal Awal Kasir Pagi..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Akun Debit</label>
                    <select
                      value={debitAccId}
                      onChange={(e) => setDebitAccId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Akun Kredit</label>
                    <select
                      value={creditAccId}
                      onChange={(e) => setCreditAccId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Menuju Debit Akun</label>
                    <select
                      value={destDebitAccId}
                      onChange={(e) => setDestDebitAccId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Menuju Kredit Akun</label>
                    <select
                      value={destCreditAccId}
                      onChange={(e) => setDestCreditAccId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-8 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                <span>Simpan Transfer</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
