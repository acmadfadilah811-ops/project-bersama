import { useState } from 'react';
import { X } from 'lucide-react';
import { notify, notifyApiError } from '../../../../utils/notify';
import AssetAccountSelect from './AssetAccountSelect';

const initialForm = { asset_code: '', name: '', acquisition_date: new Date().toISOString().slice(0, 10), acquisition_cost: '', residual_value: '0', useful_life_months: '', asset_account: null, depreciation_expense_account: null, accumulated_depreciation_account: null, counter_account: null, is_opening_balance: false, external_document_no: '', description: '' };

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold shadow-3xs text-slate-650';
const labelClass = 'text-[10px] text-slate-400 font-bold uppercase tracking-wider';

export default function AssetForm({ accounts, onSave, onClose }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        acquisition_cost: String(form.acquisition_cost),
        residual_value: String(form.residual_value),
        useful_life_months: form.useful_life_months === '' ? null : Number(form.useful_life_months),
      });
      notify({ type: 'success', title: 'Aset tersimpan', message: 'Register aset dan jurnal perolehan berhasil dibuat.' });
      onClose();
    } catch (error) {
      notifyApiError(error, 'Gagal menyimpan aset');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <form onSubmit={submit} className="bg-white border-l border-slate-200 w-[460px] h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Tambah Aset</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className={labelClass}>Kode Aset *</span><input required value={form.asset_code} onChange={(e) => set('asset_code', e.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5"><span className={labelClass}>Nama Aset *</span><input required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5"><span className={labelClass}>Tanggal Perolehan *</span><input required type="date" value={form.acquisition_date} onChange={(e) => set('acquisition_date', e.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5"><span className={labelClass}>No. Dokumen</span><input value={form.external_document_no} onChange={(e) => set('external_document_no', e.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5"><span className={labelClass}>Nilai Perolehan *</span><input required min="1" type="number" value={form.acquisition_cost} onChange={(e) => set('acquisition_cost', e.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5"><span className={labelClass}>Nilai Residu</span><input min="0" type="number" value={form.residual_value} onChange={(e) => set('residual_value', e.target.value)} className={inputClass} /></label>
          </div>

          <label className="space-y-1.5 block">
            <span className={labelClass}>Umur Manfaat (bulan)</span>
            <input min="1" type="number" placeholder="Kosongkan bila tidak disusutkan (mis. tanah)" value={form.useful_life_months} onChange={(e) => set('useful_life_months', e.target.value)} className={inputClass} />
          </label>

          <div className="pt-2 border-t border-slate-100 space-y-4">
            <span className="font-bold text-[#0088E8] text-xs block">Akun Jurnal</span>
            <AssetAccountSelect label="Akun Aset" value={form.asset_account} onChange={(value) => set('asset_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && !a.is_contra} />
            <div className="grid gap-3 sm:grid-cols-2">
              <AssetAccountSelect label="Beban Penyusutan" value={form.depreciation_expense_account} onChange={(value) => set('depreciation_expense_account', value)} accounts={accounts} filter={(a) => a.account_type === 'expense'} />
              <AssetAccountSelect label="Akumulasi Penyusutan" value={form.accumulated_depreciation_account} onChange={(value) => set('accumulated_depreciation_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && a.is_contra} />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.is_opening_balance} onChange={(e) => set('is_opening_balance', e.target.checked)} /> Aset ini adalah saldo awal
            </label>
            {!form.is_opening_balance && <AssetAccountSelect label="Akun Kredit Perolehan" value={form.counter_account} onChange={(value) => set('counter_account', value)} accounts={accounts} filter={(a) => a.is_active} />}
          </div>

          <label className="space-y-1.5 block">
            <span className={labelClass}>Catatan</span>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className={`${inputClass} min-h-[70px]`} />
          </label>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
            Batal
          </button>
          <button disabled={saving} className="px-5 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Aset'}
          </button>
        </div>
      </form>
    </div>
  );
}
