import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronDown, Loader2 } from 'lucide-react';
import { notify, notifyApiError } from '../../../utils/notify';
import apiClient from '../../../api/apiClient';

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getDaysAgoStr = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

export default function KonfirmasiSettlement() {
  const [dateFrom, setDateFrom] = useState(getDaysAgoStr(30));
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateRef = useRef(null);

  const [batches, setBatches] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const batchKey = (b) => `${b.date}__${b.payment_method_id}`;

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/accounting/settlements/', {
        params: { date_from: dateFrom, date_to: dateTo },
      });
      setBatches(res.data.results || []);
      setSelectedKeys(new Set());
    } catch (err) {
      notifyApiError(err, 'Gagal memuat daftar settlement.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    apiClient
      .get('/accounting/accounts/', { params: { classification: 'Kas & Bank' } })
      .then((res) => {
        const data = res.data.results || res.data || [];
        setBankAccounts(data);
        if (data.length > 0) setBankAccountId(String(data[0].id));
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat daftar akun kas/bank.'));
  }, []);

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

  const getActiveLabel = () => `${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`;

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCheckboxChange = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = (e) => {
    setSelectedKeys(e.target.checked ? new Set(batches.map(batchKey)) : new Set());
  };

  const selectedBatches = batches.filter((b) => selectedKeys.has(batchKey(b)));
  const totalAmountSelected = selectedBatches.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const isConfirmEnabled = selectedBatches.length > 0 && !!bankAccountId;
  const allChecked = batches.length > 0 && selectedKeys.size === batches.length;

  const handleConfirmAction = async () => {
    setConfirming(true);
    try {
      const res = await apiClient.post('/accounting/settlements/confirm/', {
        batches: selectedBatches.map((b) => ({ date: b.date, payment_method_id: b.payment_method_id })),
        bank_account_id: Number(bankAccountId),
      });
      notify({
        type: 'success',
        title: 'Settlement Dikonfirmasi',
        message: `${res.data.confirmed_count} batch settlement berhasil dikonfirmasi ke jurnal.`,
      });
      setIsConfirmOpen(false);
      fetchBatches();
    } catch (err) {
      notifyApiError(err, 'Gagal mengonfirmasi settlement.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Konfirmasi Settlement</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between overflow-visible">
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
                    setDateFrom(getDaysAgoStr(30));
                    setDateTo(getTodayStr());
                    setShowDatePicker(false);
                  }}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-250 text-slate-650 rounded cursor-pointer"
                >
                  30 hari terakhir
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold text-xs bg-slate-50/10">
            Tidak ada transaksi non-tunai yang menunggu settlement pada rentang ini.
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
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Metode Bayar</th>
                  <th className="px-5 py-3 text-center">Jumlah Transaksi</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {batches.map((row) => {
                  const key = batchKey(row);
                  return (
                    <tr key={key} className="hover:bg-slate-50/20 transition-colors">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => handleCheckboxChange(key)}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3 text-slate-550">{formatDateLabel(row.date)}</td>
                      <td className="px-5 py-3 text-slate-800 font-bold">
                        {row.payment_method_name}
                        <span className="ml-1.5 text-[10px] font-semibold text-slate-400">
                          ({row.payment_type})
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center text-slate-550">
                        {row.transaction_count}
                        <span className="ml-1 text-[10px] text-slate-400">
                          (POS {row.pos_sale_count} / Order {row.order_count})
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-extrabold text-slate-800">
                        {formatIDR(row.total_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 w-96 text-left space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Konfirmasi Settlement Transaksi</h3>
            <p className="text-xs font-semibold text-slate-550 leading-relaxed">
              Konfirmasi <span className="text-slate-800 font-bold">{selectedBatches.length} batch</span> dengan
              total <span className="text-emerald-600 font-extrabold">IDR {formatIDR(totalAmountSelected)}</span>{' '}
              akan mencairkan dana ke akun yang dipilih di bawah dan membuat jurnal secara otomatis.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">Akun Kas/Bank Tujuan</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 bg-white"
              >
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} — {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={confirming}
                className="px-4 py-1.5 border border-slate-200 bg-white text-slate-655 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={confirming || !bankAccountId}
                className="px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {confirming ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
