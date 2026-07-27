import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import NumericInput from '../../../components/NumericInput';

export default function MasukanSaldoAwalModal({ isOpen, onClose }) {
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
        setAccounts(res.data || []);
        setSaldoByAccount({});
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat Daftar Akun'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReset = () => setSaldoByAccount({});

  const handleSave = async () => {
    const entries = accounts.map((acc) => ({
      account: acc.id,
      amount: saldoByAccount[acc.id] || 0,
    }));
    setSaving(true);
    try {
      await apiClient.post('/accounting/opening-balances/', { entries });
      notifySuccess('Berhasil', 'Saldo awal berhasil disimpan.');
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan saldo awal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-4xl w-full flex flex-col max-h-[85vh] p-6">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Masukan Saldo Awal</h2>
            <p className="text-xs text-slate-500 font-medium">
              Klik bagian luar form untuk lewati proses ini.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                <tr>
                  <th className="px-4 py-3">Nomor Akun</th>
                  <th className="px-4 py-3">Nama Akun</th>
                  <th className="px-4 py-3">Klasifikasi</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="px-4 py-3 text-slate-600">{acc.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{acc.name}</td>
                    <td className="px-4 py-3 text-slate-500">{acc.klasifikasi}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-slate-400">IDR</span>
                        <NumericInput
                          value={saldoByAccount[acc.id] || 0}
                          onChange={(val) => setSaldoByAccount((prev) => ({ ...prev, [acc.id]: val }))}
                          min={0}
                          className="w-36 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-right font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
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
