import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';

// Akun jurnal uang makan mingguan dari HR (2026-10-30): saat HR menandai uang makan dibayar, ERP
// otomatis mencatat Debit Biaya uang makan / Kredit Kas (tunai) atau Bank (transfer). Akun kosong =
// jurnal ditolak dan HR menampilkan "jurnal gagal" sampai diatur. Lihat
// accounting/services/uang_makan_posting.py.
const FIELDS = [
  { key: 'uang_makan_expense_account', label: 'Biaya uang makan', required: true, types: ['expense'] },
  { key: 'uang_makan_tunai_account', label: 'Kas untuk pembayaran tunai', required: true, types: ['asset'] },
  { key: 'uang_makan_transfer_account', label: 'Bank untuk pembayaran transfer', required: true, types: ['asset'] },
];

export default function PengaturanAkunUangMakanDrawer({ isOpen, onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    apiClient.get('/accounting/accounts/').then((res) => {
      setAccounts(res.data.results || res.data || []);
    }).catch(() => setAccounts([]));
    apiClient.get('/accounting/settings/').then((res) => {
      const next = {};
      FIELDS.forEach(({ key }) => { next[key] = res.data[key] || ''; });
      setValues(next);
    }).catch((err) => notifyApiError(err, 'Gagal memuat pengaturan akun uang makan.'));
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleSimpan = async () => {
    const missingRequired = FIELDS.some(({ key, required }) => required && !values[key]);
    if (missingRequired) {
      notify({
        type: 'warning', title: 'Pengaturan Belum Lengkap',
        message: 'Biaya uang makan, Kas, dan Bank wajib dipilih supaya uang makan dari HR bisa terjurnal.',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      FIELDS.forEach(({ key }) => { payload[key] = values[key] || null; });
      await apiClient.patch('/accounting/settings/', payload);
      notify({ type: 'success', title: 'Pengaturan Disimpan', message: 'Akun uang makan berhasil disimpan.' });
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan pengaturan akun uang makan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border-l border-slate-200 w-[460px] max-w-full h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan Akun Uang Makan</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-5">
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <p className="font-bold text-[#0088E8] mb-1">Uang makan mingguan dari HR</p>
            <p>
              Saat HR menandai uang makan dibayar, ERP otomatis mencatat <strong>Debit Biaya uang makan</strong>,
              <strong> Kredit Kas</strong> (tunai) atau <strong>Bank</strong> (transfer). Pembatalan di HR dicatat
              sebagai jurnal pembalik.
            </p>
          </div>

          {FIELDS.map(({ key, label, required, types }) => (
            <label key={key} className="block space-y-1.5">
              <span className="font-bold text-slate-700">
                {label} {required && <span className="text-rose-500">*</span>}
              </span>
              <select
                value={values[key] || ''}
                onChange={(e) => update(key, e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-650"
              >
                <option value="">Pilih akun</option>
                {accounts
                  .filter((acc) => !types || types.includes(acc.account_type))
                  .map((acc) => <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={saving}
            className="px-5 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
