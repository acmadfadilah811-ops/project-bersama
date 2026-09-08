import { useState } from 'react';
import { X } from 'lucide-react';
import { notify, notifyApiError } from '../../../../utils/notify';

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold shadow-3xs text-slate-650';
const labelClass = 'text-[10px] text-slate-400 font-bold uppercase tracking-wider';

export default function AssetEditModal({ asset, onSave, onClose }) {
  const [form, setForm] = useState({
    name: asset.name,
    external_document_no: asset.external_document_no || '',
    description: asset.description || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(asset.id, form);
      notify({ type: 'success', title: 'Aset diperbarui', message: `${asset.asset_code} berhasil diperbarui.` });
      onClose();
    } catch (error) {
      notifyApiError(error, 'Gagal memperbarui aset');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-[420px] overflow-hidden animate-scale-up">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <span className="text-xs font-bold text-slate-800">Ubah Aset {asset.asset_code}</span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md text-slate-450 hover:text-slate-700 transition-all cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-[11px] font-normal text-slate-400 leading-4">
            Jurnal perolehan sudah terposting dan tidak bisa diedit -- hanya metadata register di bawah ini yang bisa diubah.
          </p>
          <label className="space-y-1.5 block"><span className={labelClass}>Nama Aset *</span><input required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} /></label>
          <label className="space-y-1.5 block"><span className={labelClass}>No. Dokumen</span><input value={form.external_document_no} onChange={(e) => set('external_document_no', e.target.value)} className={inputClass} /></label>
          <label className="space-y-1.5 block"><span className={labelClass}>Catatan</span><textarea value={form.description} onChange={(e) => set('description', e.target.value)} className={`${inputClass} min-h-[70px]`} /></label>
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-[#F8FAFC]">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
            Batal
          </button>
          <button disabled={saving} className="px-5 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
