import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';

// Akun pengganti per unit bisnis (2026-10-11). Kosong = jurnal unit memakai
// akun umum Pengaturan Akuntansi. Semua jurnal transaksi unit juga ditandai
// departemen unit sehingga Laba Rugi bisa difilter per unit.
// Lihat accounting/services/unit_bisnis.py.
const FIELDS = [
  { key: 'order_sales_revenue_account', label: 'Pendapatan Pesanan', types: ['revenue'] },
  { key: 'pos_sales_revenue_account', label: 'Pendapatan Penjualan Kasir (POS)', types: ['revenue'] },
  { key: 'order_hpp_expense_account', label: 'HPP Bahan Pesanan', types: ['expense'] },
  { key: 'pos_cogs_expense_account', label: 'HPP Penjualan Barang', types: ['expense'] },
  { key: 'kas_tunai_account', label: 'Kas Laci Kasir (pembayaran tunai)', types: ['asset'] },
];

export default function PengaturanAkunUnitBisnisDrawer({ isOpen, onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [units, setUnits] = useState([]);
  const [aktif, setAktif] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    apiClient.get('/accounting/accounts/').then((res) => setAccounts(res.data.results || res.data || []))
      .catch(() => setAccounts([]));
    apiClient.get('/accounting/akun-unit-bisnis/').then((res) => {
      setUnits(res.data || []);
      if (res.data?.length) pilihUnit(res.data[0]);
    }).catch((err) => notifyApiError(err, 'Gagal memuat Akun Unit Bisnis.'));
  }, [isOpen]);

  if (!isOpen) return null;

  function pilihUnit(unit) {
    setAktif(unit);
    const next = {};
    FIELDS.forEach(({ key }) => { next[key] = unit[key] || ''; });
    setValues(next);
  }

  const handleSimpan = async () => {
    if (!aktif) return;
    setSaving(true);
    try {
      const payload = {};
      FIELDS.forEach(({ key }) => { payload[key] = values[key] || null; });
      const res = await apiClient.patch(`/accounting/akun-unit-bisnis/${aktif.unit_bisnis}/`, payload);
      setUnits((prev) => prev.map((u) => (u.unit_bisnis === aktif.unit_bisnis ? res.data : u)));
      setAktif(res.data);
      notify({ type: 'success', title: 'Pengaturan Disimpan', message: `Akun ${aktif.unit_bisnis_nama} berhasil disimpan.` });
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan Akun Unit Bisnis.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border-l border-slate-200 w-[460px] max-w-full h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Akun per Unit Bisnis</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            Isi akun khusus unit bila pendapatan, HPP, atau kas lacinya ingin dipisah. Kolom kosong = memakai
            akun umum. Semua jurnal kasir & pesanan unit ditandai departemen <strong>{aktif?.department_nama || '-'}</strong>,
            sehingga Laba Rugi bisa difilter per unit.
          </div>

          <div className="flex flex-wrap gap-1.5">
            {units.map((u) => (
              <button
                key={u.unit_bisnis} type="button" onClick={() => pilihUnit(u)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-bold ${aktif?.unit_bisnis === u.unit_bisnis ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {u.unit_bisnis_nama}
              </button>
            ))}
          </div>

          {aktif && FIELDS.map(({ key, label, types }) => (
            <label key={key} className="block space-y-1.5">
              <span className="font-bold text-slate-700">{label}</span>
              <select
                value={values[key] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : '' }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-700"
              >
                <option value="">Pakai akun umum</option>
                {accounts
                  .filter((acc) => !types || types.includes(acc.account_type))
                  .map((acc) => <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
            Tutup
          </button>
          <button
            type="button" onClick={handleSimpan} disabled={saving || !aktif}
            className="px-5 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
