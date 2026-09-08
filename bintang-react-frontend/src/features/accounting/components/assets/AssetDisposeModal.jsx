import { useState } from 'react';
import { X } from 'lucide-react';
import { notify, notifyApiError } from '../../../../utils/notify';
import AssetAccountSelect from './AssetAccountSelect';

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold shadow-3xs text-slate-650';
const labelClass = 'text-[10px] text-slate-400 font-bold uppercase tracking-wider';
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export default function AssetDisposeModal({ asset, accounts, onDispose, onClose }) {
  const [form, setForm] = useState({
    disposal_date: new Date().toISOString().slice(0, 10),
    proceeds: '0',
    proceeds_account: null,
    gain_loss_account: null,
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onDispose(asset.id, { ...form, proceeds: String(form.proceeds) });
      notify({ type: 'success', title: 'Aset dilepas', message: `${asset.asset_code} berhasil dilepas dari register & jurnal pelepasan terposting.` });
      onClose();
    } catch (error) {
      notifyApiError(error, 'Gagal melepas aset');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-[440px] overflow-hidden animate-scale-up">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <span className="text-xs font-bold text-slate-800">Lepas Aset {asset.asset_code}</span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md text-slate-450 hover:text-slate-700 transition-all cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-[11px] font-normal text-slate-400 leading-4">
            Menghapus aset ini dari buku (nilai perolehan &amp; akumulasi penyusutan) dan mengakui untung/rugi pelepasan.
            Nilai buku saat ini: <span className="font-bold text-slate-600">{money.format(asset.book_value ?? asset.acquisition_cost)}</span>.
          </p>

          <label className="space-y-1.5 block">
            <span className={labelClass}>Tanggal Pelepasan *</span>
            <input required type="date" value={form.disposal_date} onChange={(e) => set('disposal_date', e.target.value)} className={inputClass} />
          </label>

          <label className="space-y-1.5 block">
            <span className={labelClass}>Hasil Pelepasan (Rp)</span>
            <input min="0" type="number" value={form.proceeds} onChange={(e) => set('proceeds', e.target.value)} className={inputClass} />
          </label>
          <p className="text-[11px] font-normal text-slate-400 -mt-3">Isi 0 kalau aset dibuang/rusak tanpa nilai jual.</p>

          <AssetAccountSelect label="Akun Penerima Hasil Pelepasan" value={form.proceeds_account} onChange={(value) => set('proceeds_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && !a.is_contra} />
          <AssetAccountSelect label="Akun Untung/Rugi Pelepasan" value={form.gain_loss_account} onChange={(value) => set('gain_loss_account', value)} accounts={accounts} filter={(a) => a.is_active} />
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-[#F8FAFC]">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
            Batal
          </button>
          <button disabled={saving} className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50">
            {saving ? 'Memproses...' : 'Lepas Aset'}
          </button>
        </div>
      </form>
    </div>
  );
}
