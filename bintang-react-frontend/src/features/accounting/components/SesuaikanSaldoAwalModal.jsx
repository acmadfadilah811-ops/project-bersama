import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import NumericInput from '../../../components/NumericInput';

export default function SesuaikanSaldoAwalModal({ isOpen, onClose, onSaved }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saldoByAccount, setSaldoByAccount] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    apiClient
      .get('/accounting/accounts/')
      .then((res) => {
        const data = res.data || [];
        setAccounts(data);
        const initialSaldo = {};
        data.forEach((acc) => {
          initialSaldo[acc.id] = acc.saldo || 0;
        });
        setSaldoByAccount(initialSaldo);
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat Daftar Akun'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    const initialSaldo = {};
    accounts.forEach((acc) => {
      initialSaldo[acc.id] = 0;
    });
    setSaldoByAccount(initialSaldo);
  };

  const handleSave = async () => {
    const entries = accounts.map((acc) => ({
      account: acc.id,
      amount: saldoByAccount[acc.id] || 0,
    }));
    setSaving(true);
    try {
      await apiClient.post('/accounting/opening-balances/', { entries });
      notifySuccess('Berhasil', 'Saldo awal berhasil disesuaikan.');
      onSaved?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menyesuaikan saldo awal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-4xl w-full flex flex-col max-h-[85vh] p-6 relative">
        {/* Header Section */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Sesuaikan Saldo Awal</h2>
            <p className="text-xs text-slate-500 font-medium">
              Sesuaikan saldo awal untuk seluruh akun yang terdaftar
            </p>
          </div>
          <div className="flex items-center gap-3 pr-8">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              <span>Simpan</span>
            </button>
          </div>
          {/* Close button X */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-3 text-[#0088E8]" />
            <p className="text-xs font-semibold">Memuat Daftar Akun...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">Nomor Akun</th>
                  <th className="px-4 py-3">Nama Akun</th>
                  <th className="px-4 py-3">Klasifikasi</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 font-medium">{acc.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{acc.name}</td>
                    <td className="px-4 py-3 text-slate-500">{acc.klasifikasi}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">IDR</span>
                        <NumericInput
                          value={saldoByAccount[acc.id] || 0}
                          onChange={(val) => setSaldoByAccount((prev) => ({ ...prev, [acc.id]: val }))}
                          min={0}
                          className="w-36 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-800 text-right font-bold focus:bg-white focus:border-[#0088E8] outline-none text-xs"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
