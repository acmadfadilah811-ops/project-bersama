import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notify, notifyApiError } from '../../../../utils/notify';

// Simpan preferensi akun default komisi penjualan ke AccountingSettings
// (singleton, sama pola dengan pos_sales_rounding_account dkk yang sudah
// ada). Belum ada aksi posting — ini murni preferensi akun untuk dipakai
// nanti ketika fitur posting komisi dibangun.
export default function KomisiPenjualanSettingsDrawer({ isOpen, onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [debitAcc, setDebitAcc] = useState('');
  const [creditAcc, setCreditAcc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    apiClient.get('/accounting/accounts/').then((res) => {
      setAccounts(res.data.results || res.data || []);
    }).catch(() => setAccounts([]));
    apiClient.get('/accounting/settings/').then((res) => {
      setDebitAcc(res.data.komisi_penjualan_debit_account || '');
      setCreditAcc(res.data.komisi_penjualan_kredit_account || '');
    }).catch((err) => notifyApiError(err, 'Gagal memuat pengaturan komisi penjualan.'));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/accounting/settings/', {
        komisi_penjualan_debit_account: debitAcc || null,
        komisi_penjualan_kredit_account: creditAcc || null,
      });
      notify({ type: 'success', title: 'Pengaturan Disimpan', message: 'Akun default komisi penjualan berhasil disimpan.' });
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan pengaturan komisi penjualan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border-l border-slate-200 w-[440px] h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan POS Komisi Penjualan</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-[#0088E8] text-xs">Pengaturan Akun Default</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Akun Debit Komisi
              </label>
              <select
                value={debitAcc}
                onChange={(e) => setDebitAcc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-650"
              >
                <option value="">Pilih akun</option>
                {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.code} {acc.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Akun Kredit Komisi
              </label>
              <select
                value={creditAcc}
                onChange={(e) => setCreditAcc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-650"
              >
                <option value="">Pilih akun</option>
                {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.code} {acc.name}</option>)}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleApply}
                disabled={saving}
                className="w-full py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer text-center block shadow-2xs disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Terapkan Default'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
