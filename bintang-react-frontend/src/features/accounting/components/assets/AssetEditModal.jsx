import { useState } from 'react';
import { notify, notifyApiError } from '../../../../utils/notify';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Ubah Aset {asset.asset_code}</h2>
          <button type="button" onClick={onClose} className="cursor-pointer">Tutup</button>
        </div>
        <p className="text-xs text-slate-500">
          Jurnal perolehan sudah terposting dan tidak bisa diedit -- hanya metadata register di bawah ini yang bisa diubah.
        </p>
        <label className="block text-xs font-bold">Nama Aset *<input required value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">No. Dokumen<input value={form.external_document_no} onChange={(e) => set('external_document_no', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <label className="block text-xs font-bold">Catatan<textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
        <button disabled={saving} className="w-full rounded-lg bg-[#51a351] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
      </form>
    </div>
  );
}
