import { useState } from 'react';
import { notify, notifyApiError } from '../../../../utils/notify';
import AssetAccountSelect from './AssetAccountSelect';

const initialForm = { asset_code: '', name: '', acquisition_date: new Date().toISOString().slice(0, 10), acquisition_cost: '', residual_value: '0', asset_account: null, depreciation_expense_account: null, accumulated_depreciation_account: null, counter_account: null, is_opening_balance: false, external_document_no: '', description: '' };

export default function AssetForm({ accounts, onSave, onClose }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, acquisition_cost: String(form.acquisition_cost), residual_value: String(form.residual_value) });
      notify({ type: 'success', title: 'Aset tersimpan', message: 'Register aset dan jurnal perolehan berhasil dibuat.' });
      onClose();
    } catch (error) {
      notifyApiError(error, 'Gagal menyimpan aset');
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><h2 className="font-bold">Tambah Aset</h2><button type="button" onClick={onClose}>Tutup</button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-bold">Kode Aset *<input required value={form.asset_code} onChange={(e) => set('asset_code', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">Nama Aset *<input required value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">Tanggal Perolehan *<input required type="date" value={form.acquisition_date} onChange={(e) => set('acquisition_date', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">Nilai Perolehan *<input required min="1" type="number" value={form.acquisition_cost} onChange={(e) => set('acquisition_cost', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">Nilai Residu<input min="0" type="number" value={form.residual_value} onChange={(e) => set('residual_value', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">No. Dokumen<input value={form.external_document_no} onChange={(e) => set('external_document_no', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
      </div>
      <AssetAccountSelect label="Akun Aset" value={form.asset_account} onChange={(value) => set('asset_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && !a.is_contra} />
      <div className="grid gap-3 md:grid-cols-2">
        <AssetAccountSelect label="Beban Penyusutan" value={form.depreciation_expense_account} onChange={(value) => set('depreciation_expense_account', value)} accounts={accounts} filter={(a) => a.account_type === 'expense'} />
        <AssetAccountSelect label="Akumulasi Penyusutan" value={form.accumulated_depreciation_account} onChange={(value) => set('accumulated_depreciation_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && a.is_contra} />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_opening_balance} onChange={(e) => set('is_opening_balance', e.target.checked)} /> Saldo awal</label>
      {!form.is_opening_balance && <AssetAccountSelect label="Akun Kredit Perolehan" value={form.counter_account} onChange={(value) => set('counter_account', value)} accounts={accounts} filter={(a) => a.is_active} />}
      <label className="block text-xs font-bold">Catatan<textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
      <button disabled={saving} className="rounded-lg bg-[#51a351] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan Aset'}</button>
    </form>
  );
}
