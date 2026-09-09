import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';

// Pengaturan akun akrual Order (keputusan finance 2026-09-09): Pendapatan
// Order diakui PENUH saat order berstatus 'Selesai' -- Debit Piutang Usaha /
// Kredit Pendapatan. Pembayaran SEBELUM 'Selesai' (DP/cicilan) masuk Uang
// Muka Pelanggan (kewajiban, belum diakui pendapatan); pembayaran SETELAH
// 'Selesai' melunasi Piutang Usaha. Lihat
// accounting/services/order_posting.py untuk logic lengkapnya.
const FIELDS = [
  { key: 'order_sales_revenue_account', label: 'Pendapatan Order', required: true, types: ['revenue'] },
  { key: 'order_receivable_account', label: 'Piutang Usaha', required: true, types: ['asset'] },
  { key: 'order_customer_deposit_account', label: 'Uang Muka Pelanggan', required: true, types: ['liability'] },
  { key: 'order_hpp_expense_account', label: 'HPP Bahan Baku Order', required: false, types: ['expense'] },
  { key: 'order_material_inventory_account', label: 'Persediaan Bahan Baku Order', required: false, types: ['asset'] },
];

export default function PengaturanAkunOrderDrawer({ isOpen, onClose }) {
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
    }).catch((err) => notifyApiError(err, 'Gagal memuat pengaturan akun Order.'));
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleSimpan = async () => {
    const missingRequired = FIELDS.some(({ key, required }) => required && !values[key]);
    if (missingRequired) {
      notify({
        type: 'warning', title: 'Pengaturan Belum Lengkap',
        message: 'Pendapatan Order, Piutang Usaha, dan Uang Muka Pelanggan wajib dipilih supaya posting akrual Order berjalan.',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      FIELDS.forEach(({ key }) => { payload[key] = values[key] || null; });
      await apiClient.patch('/accounting/settings/', payload);
      notify({ type: 'success', title: 'Pengaturan Disimpan', message: 'Akun Order berhasil disimpan.' });
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan pengaturan akun Order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border-l border-slate-200 w-[460px] max-w-full h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan Akun Order</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-5">
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <p className="font-bold text-[#0088E8] mb-1">Accrual basis (keputusan finance 2026-09-09)</p>
            <p>
              Pendapatan Order diakui PENUH saat order berstatus <strong>Selesai</strong> (Debit Piutang
              Usaha, Kredit Pendapatan). Pembayaran SEBELUM Selesai (DP/cicilan) masuk Uang Muka
              Pelanggan — belum diakui pendapatan. Pembayaran SETELAH Selesai melunasi Piutang Usaha.
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
