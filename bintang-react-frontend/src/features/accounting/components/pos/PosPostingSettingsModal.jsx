import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notify, notifyApiError } from '../../../../utils/notify';

export default function PosPostingSettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState(null);
  const [methods, setMethods] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([apiClient.get('/accounting/settings/'), apiClient.get('/accounting/payment-methods/')])
      .then(([settingsRes, methodsRes]) => {
        setSettings(settingsRes.data);
        setMethods(methodsRes.data || []);
      })
      .catch((error) => notifyApiError(error, 'Gagal memuat Pengaturan POS'));
  }, [isOpen]);

  if (!isOpen) return null;
  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/accounting/settings/', {
        pos_auto_post_enabled: settings.pos_auto_post_enabled,
        default_pos_payment_method: settings.default_pos_payment_method || null,
      });
      notify({ type: 'success', title: 'Pengaturan Disimpan', message: 'Pengaturan posting POS berhasil diperbarui.' });
      onClose();
    } catch (error) {
      notifyApiError(error, 'Gagal menyimpan Pengaturan POS');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[999] flex justify-end bg-slate-900/40"><div className="h-full w-[460px] max-w-full bg-white p-5 shadow-2xl"><div className="flex items-center justify-between border-b pb-3"><h3 className="font-bold text-slate-800">Pengaturan Posting POS</h3><button type="button" onClick={onClose}><X size={16} /></button></div>{settings ? <div className="space-y-5 pt-5 text-xs"><label className="flex items-center justify-between font-bold text-slate-700"><span>Memposting Otomatis Transaksi POS</span><input type="checkbox" checked={settings.pos_auto_post_enabled} onChange={(event) => setSettings({ ...settings, pos_auto_post_enabled: event.target.checked })} /></label><div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-slate-600 space-y-1.5"><p>• Cara pembayaran yang belum di-mapping akan memakai metode default menuju akun transit.</p><p>• Batal post membuat jurnal pembalik dan tidak diposting ulang otomatis.</p></div><label className="block font-bold text-slate-700">Metode pembayaran default (akun transit)<select value={settings.default_pos_payment_method || ''} onChange={(event) => setSettings({ ...settings, default_pos_payment_method: event.target.value ? Number(event.target.value) : null })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-semibold"><option value="">Belum dipilih — posting ditolak bila belum mapping</option>{methods.filter((method) => method.is_active).map((method) => <option key={method.id} value={method.id}>{method.name} — {method.account_code} {method.account_name}</option>)}</select></label><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button type="button" disabled={saving} onClick={save} className="rounded-lg bg-[#0088E8] px-4 py-2 text-white">{saving ? 'Menyimpan...' : 'Simpan'}</button></div></div> : <p className="pt-5 text-slate-400">Memuat pengaturan...</p>}</div></div>;
}
