import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Pencil, X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notify, notifyApiError } from '../../../../utils/notify';
import PosAutoPostToggle from './PosAutoPostToggle';
import { POS_ACCOUNT_FIELDS, POS_DEFAULT_ACCOUNT_CODES } from './posDefaultAccounts';
import PosLogModal from './PosLogModal';
import { formatPosPostingAuditTimestamp } from './posPostingLogFormat';
import usePosAutoPostSetting from './usePosAutoPostSetting';

const responseList = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function PosSettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [methods, setMethods] = useState([]);
  const [editingDefaults, setEditingDefaults] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postingLogs, setPostingLogs] = useState([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const { isAutoPostSaving, toggleAutoPost } = usePosAutoPostSetting(settings, setSettings);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    Promise.all([
      apiClient.get('/accounting/settings/'),
      apiClient.get('/accounting/accounts/'),
      apiClient.get('/accounting/payment-methods/'),
    ])
      .then(([settingsRes, accountsRes, methodsRes]) => {
        if (cancelled) return;
        const currentSettings = settingsRes.data;
        setSettings(currentSettings);
        setAccounts(responseList(accountsRes.data));
        setMethods(responseList(methodsRes.data));
        setEditingDefaults(!POS_ACCOUNT_FIELDS.some(({ key }) => currentSettings[key]));
      })
      .catch((error) => {
        if (!cancelled) notifyApiError(error, 'Gagal memuat Pengaturan POS');
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [Number(account.id), account])),
    [accounts],
  );
  const selectedDefaults = settings
    ? POS_ACCOUNT_FIELDS
      .map((field) => ({ ...field, account: accountsById.get(Number(settings[field.key])) }))
      .filter(({ account }) => account)
    : [];

  if (!isOpen) return null;

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const applyDefaults = () => {
    const next = { ...settings };
    POS_ACCOUNT_FIELDS.forEach(({ key }) => {
      const account = accounts.find((item) => String(item.code) === POS_DEFAULT_ACCOUNT_CODES[key]);
      if (account) next[key] = account.id;
    });
    setSettings(next);
  };
  const save = async () => {
    const missingRequired = POS_ACCOUNT_FIELDS.some(({ key, required }) => required && !settings[key]);
    if (missingRequired) {
      notify({ type: 'warning', title: 'Pengaturan Tidak Lengkap', message: 'Pengiriman, pembulatan, dan pembayaran unik wajib dipilih.' });
      return;
    }
    setSaving(true);
    try {
      const payload = [
        'pos_auto_post_enabled',
        'pos_post_discount_line_enabled',
        'default_pos_payment_method',
        ...POS_ACCOUNT_FIELDS.map(({ key }) => key),
      ].reduce((result, key) => ({
        ...result,
        [key]: typeof settings[key] === 'boolean' ? settings[key] : settings[key] || null,
      }), {});
      const response = await apiClient.patch('/accounting/settings/', payload);
      setSettings(response.data);
      setEditingDefaults(false);
      notify({ type: 'success', title: 'Pengaturan Disimpan', message: 'Akun default POS sudah tersimpan dan dipakai sebagai konfigurasi aktif.' });
    } catch (error) {
      notifyApiError(error, 'Gagal menyimpan Pengaturan POS');
    } finally {
      setSaving(false);
    }
  };
  const openPostingLog = async () => {
    setIsLogOpen(true);
    try {
      const response = await apiClient.get('/accounting/settings/pos-posting-logs/');
      setPostingLogs(responseList(response.data).map((log) => ({
        timestamp: formatPosPostingAuditTimestamp(log.created_at),
        user: [log.actor_name || 'Sistem', log.actor_email].filter(Boolean).join('\n'),
        action: log.action === 'enable' ? 'ENABLE' : 'DISABLE',
      })));
    } catch (error) {
      notifyApiError(error, 'Gagal memuat log posting otomatis POS');
      setPostingLogs([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex justify-end bg-slate-900/40 backdrop-blur-xs text-xs font-semibold text-slate-700">
      <div className="flex h-full w-[560px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan POS</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        {!settings ? <p className="p-5 text-slate-400">Memuat pengaturan...</p> : <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section className="space-y-3 border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between gap-4 font-bold text-slate-800">
              <span>Memposting Otomatis Transaksi (POS)</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={openPostingLog} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-600 hover:bg-slate-50"><FileText size={12} /> Log</button>
                <PosAutoPostToggle
                  enabled={Boolean(settings.pos_auto_post_enabled)}
                  disabled={isAutoPostSaving || saving}
                  onToggle={toggleAutoPost}
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-4 font-bold text-slate-800">
              <span>Posting dengan baris diskon</span>
              <input type="checkbox" checked={Boolean(settings.pos_post_discount_line_enabled)} onChange={(event) => update('pos_post_discount_line_enabled', event.target.checked)} />
            </label>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
              <p>• Cara pembayaran yang belum di-mapping akan memakai metode default menuju akun transit.</p>
              <p>• Aksi batal posting membuat jurnal pembalik dan tidak diposting ulang otomatis.</p>
            </div>
            <label className="block space-y-1.5">
              <span className="font-bold text-slate-700">Metode pembayaran default (akun transit)</span>
              <select value={settings.default_pos_payment_method || ''} onChange={(event) => update('default_pos_payment_method', event.target.value ? Number(event.target.value) : null)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="">Belum dipilih — posting ditolak jika belum ada mapping</option>
                {methods.filter((method) => method.is_active).map((method) => <option key={method.id} value={method.id}>{method.name} — {method.account_code || 'Tanpa akun'}</option>)}
              </select>
            </label>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold uppercase tracking-wide text-slate-800">Pengaturan Akun Default</h4>
              {!editingDefaults && <button type="button" onClick={() => setEditingDefaults(true)} className="inline-flex items-center gap-1 text-[#0088E8]"><Pencil size={12} /> Ubah</button>}
            </div>
            {!editingDefaults ? <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 size={15} /> Akun default aktif</div>
              {selectedDefaults.map(({ key, label, account }) => <div key={key} className="flex justify-between gap-3 border-t border-emerald-100 pt-2 text-emerald-900"><span>{label}</span><span className="text-right">{account.code} — {account.name}</span></div>)}
            </div> : <>
              <div className="flex justify-end"><button type="button" onClick={applyDefaults} className="rounded-lg border border-[#0088E8] px-3 py-1.5 text-[#0088E8]">Terapkan Default</button></div>
              {POS_ACCOUNT_FIELDS.map(({ key, label, required }) => <label key={key} className="block space-y-1.5">
                <span className="font-bold text-slate-600">{label} {required && <span className="text-rose-500">*</span>}</span>
                <select value={settings[key] || ''} onChange={(event) => update(key, event.target.value ? Number(event.target.value) : null)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
                  <option value="">Pilih akun</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
                </select>
              </label>)}
            </>}
          </section>
        </div>}

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-5 py-2">Batal</button>
          <button type="button" disabled={!settings || saving} onClick={save} className="rounded-lg bg-[#0088E8] px-6 py-2 font-bold text-white disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
      <PosLogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        title="Log Memposting Otomatis Transaksi POS"
        type="settings"
        logs={postingLogs}
      />
    </div>
  );
}
