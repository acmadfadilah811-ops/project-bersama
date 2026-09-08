import { useState } from 'react';
import { notify, notifyApiError } from '../../../../utils/notify';
import AssetAccountSelect from './AssetAccountSelect';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Lepas Aset {asset.asset_code}</h2>
          <button type="button" onClick={onClose} className="cursor-pointer">Tutup</button>
        </div>
        <p className="text-xs text-slate-500">
          Menghapus aset ini dari buku (nilai perolehan & akumulasi penyusutan) dan mengakui untung/rugi pelepasan.
          Nilai buku saat ini: <b>{Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(asset.book_value ?? asset.acquisition_cost)}</b>.
        </p>
        <label className="block text-xs font-bold">Tanggal Pelepasan *<input required type="date" value={form.disposal_date} onChange={(e) => set('disposal_date', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">Hasil Pelepasan (Rp)<input min="0" type="number" value={form.proceeds} onChange={(e) => set('proceeds', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <p className="text-[11px] text-slate-400 -mt-2">Isi 0 kalau aset dibuang/rusak tanpa nilai jual.</p>
        <AssetAccountSelect label="Akun Penerima Hasil Pelepasan" value={form.proceeds_account} onChange={(value) => set('proceeds_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && !a.is_contra} />
        <AssetAccountSelect label="Akun Untung/Rugi Pelepasan" value={form.gain_loss_account} onChange={(value) => set('gain_loss_account', value)} accounts={accounts} filter={(a) => a.is_active} />
        <button disabled={saving} className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Memproses...' : 'Lepas Aset'}</button>
      </form>
    </div>
  );
}
