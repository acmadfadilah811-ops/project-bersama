import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileText, Loader2, Search, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';

const accountLabel = (code, name) => (code && name ? `${code} ${name}` : 'Kosong');
const formatLogTimestamp = (value) => {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export default function CaraPembayaran() {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cashBankAccounts, setCashBankAccounts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [pendingSaveId, setPendingSaveId] = useState(null);
  const [aturAkunOpen, setAturAkunOpen] = useState(false);
  const [aturAkunAccountId, setAturAkunAccountId] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [logState, setLogState] = useState({ open: false, title: '', entries: [], loading: false });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [methodsRes, accountsRes, cashBanksRes] = await Promise.all([
        apiClient.get('/accounting/payment-methods/'),
        apiClient.get('/accounting/accounts/'),
        apiClient.get('/accounting/cash-bank-accounts/'),
      ]);
      setPaymentMethods(methodsRes.data || []);
      setAccounts(accountsRes.data || []);
      setCashBankAccounts(cashBanksRes.data || []);
    } catch (error) {
      notifyApiError(error, 'Gagal memuat Cara Pembayaran');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cashBankOptions = useMemo(
    () => cashBankAccounts.map((item) => ({ id: String(item.account), label: accountLabel(item.account_code, item.account_name) })),
    [cashBankAccounts],
  );
  const selectableIds = useMemo(
    () => paymentMethods.filter((method) => !method.is_locked).map((method) => method.id),
    [paymentMethods],
  );
  const filteredPayments = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return paymentMethods;
    return paymentMethods.filter((method) => [
      method.name,
      method.payment_type,
      method.account_code,
      method.account_name,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [paymentMethods, searchKeyword]);

  const initialDraft = (method) => ({
    debit: method.mdr_debit_account ? String(method.mdr_debit_account) : '',
    kredit: method.mdr_kredit_account ? String(method.mdr_kredit_account) : '',
    percent: String(method.mdr_percent ?? 0),
  });
  const currentDraft = (method) => drafts[method.id] || initialDraft(method);
  const isModified = (method) => {
    const draft = currentDraft(method);
    const saved = initialDraft(method);
    return draft.debit !== saved.debit || draft.kredit !== saved.kredit || Number(draft.percent || 0) !== Number(saved.percent || 0);
  };
  const updateDraft = (method, key, value) => {
    setDrafts((previous) => ({ ...previous, [method.id]: { ...currentDraft(method), [key]: value } }));
  };
  const cancelDraft = (method) => {
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[method.id];
      return next;
    });
    notify({ type: 'info', title: 'Dibatalkan', message: 'Perubahan biaya MDR dibatalkan.' });
  };
  const adjustMdr = (method, amount) => {
    const value = Math.max(0, Math.min(100, Number(currentDraft(method).percent || 0) + amount));
    updateDraft(method, 'percent', value.toFixed(2));
  };

  const saveMdr = async () => {
    const method = paymentMethods.find((item) => item.id === pendingSaveId);
    if (!method) return;
    const draft = currentDraft(method);
    setSavingId(method.id);
    try {
      const response = await apiClient.patch(`/accounting/payment-methods/${method.id}/mdr/`, {
        mdr_debit_account: draft.debit ? Number(draft.debit) : null,
        mdr_kredit_account: draft.kredit ? Number(draft.kredit) : null,
        mdr_percent: Number(draft.percent || 0).toFixed(2),
      });
      setPaymentMethods((previous) => previous.map((item) => (item.id === method.id ? response.data : item)));
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[method.id];
        return next;
      });
      notify({ type: 'success', title: 'Perubahan Disimpan', message: `Biaya MDR ${method.name} berhasil diperbarui.` });
    } catch (error) {
      notifyApiError(error, 'Gagal menyimpan biaya MDR');
    } finally {
      setSavingId(null);
      setPendingSaveId(null);
    }
  };

  const toggleSelected = (method) => {
    if (method.is_locked) return;
    setSelectedIds((previous) => (previous.includes(method.id) ? previous.filter((id) => id !== method.id) : [...previous, method.id]));
  };
  const toggleSelectAll = () => setSelectedIds((previous) => (previous.length === selectableIds.length ? [] : selectableIds));
  const openAturAkun = () => {
    if (!selectedIds.length) {
      notify({ type: 'info', title: 'Pilih Cara Pembayaran', message: 'Centang minimal satu baris yang ingin diatur akunnya.' });
      return;
    }
    setAturAkunAccountId(cashBankOptions[0]?.id || '');
    setAturAkunOpen(true);
  };
  const saveAccount = async () => {
    if (!aturAkunAccountId) return;
    setSavingAccount(true);
    try {
      const response = await apiClient.post('/accounting/payment-methods/bulk-update-account/', {
        payment_method_ids: selectedIds,
        account: Number(aturAkunAccountId),
      });
      const updatedById = new Map((response.data || []).map((method) => [method.id, method]));
      setPaymentMethods((previous) => previous.map((method) => updatedById.get(method.id) || method));
      setSelectedIds([]);
      setAturAkunOpen(false);
      notify({ type: 'success', title: 'Akun Diperbarui', message: 'Akun pembayaran berhasil diperbarui.' });
    } catch (error) {
      notifyApiError(error, 'Gagal memperbarui akun pembayaran');
    } finally {
      setSavingAccount(false);
    }
  };
  const openHistoryLog = async (method) => {
    setLogState({ open: true, title: method.name, entries: [], loading: true });
    try {
      const response = await apiClient.get(`/accounting/payment-methods/${method.id}/log/`);
      setLogState({ open: true, title: method.name, entries: response.data || [], loading: false });
    } catch (error) {
      notifyApiError(error, 'Gagal memuat log Cara Pembayaran');
      setLogState((previous) => ({ ...previous, loading: false }));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Cara Pembayaran</h2>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Search size={12} /></span>
            <input type="text" placeholder="Ketikan keyword" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold shadow-2xs" />
          </div>
          <button type="button" onClick={openAturAkun} className="px-4 py-1.5 border border-[#73C240] text-[#73C240] bg-white hover:bg-[#73C240]/5 rounded-lg cursor-pointer font-bold transition-colors shadow-2xs">Atur Akun</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
          <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
            <tr>
              <th className="px-5 py-3 w-10"><input type="checkbox" checked={selectableIds.length > 0 && selectedIds.length === selectableIds.length} onChange={toggleSelectAll} className="rounded border-slate-300 cursor-pointer" aria-label="Pilih semua cara pembayaran" /></th>
              <th className="px-5 py-3">Nama</th><th className="px-5 py-3">Tipe</th><th className="px-5 py-3">Akun Pembayaran</th>
              <th className="px-5 py-3 w-52">Debit (MDR)</th><th className="px-5 py-3 w-52">Kredit (MDR)</th><th className="px-5 py-3 text-center w-28">Rating (MDR)</th><th className="px-5 py-3 text-center w-20">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {loading ? <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={16} />Memuat cara pembayaran...</td></tr> : filteredPayments.map((method) => {
              const draft = currentDraft(method);
              const modified = isModified(method);
              return <tr key={method.id} className="hover:bg-slate-50/20 transition-colors">
                <td className="px-5 py-3"><input type="checkbox" checked={selectedIds.includes(method.id)} onChange={() => toggleSelected(method)} disabled={method.is_locked} className="rounded border-slate-300 cursor-pointer disabled:cursor-not-allowed" aria-label={`Pilih ${method.name}`} /></td>
                <td className="px-5 py-3 text-slate-800 font-bold">{method.name}{method.is_locked && <span className="block text-[10px] font-medium text-slate-400">Terkunci</span>}</td>
                <td className="px-5 py-3 text-slate-550">{method.payment_type}</td>
                <td className="px-5 py-3 text-slate-500 font-medium">{accountLabel(method.account_code, method.account_name)}</td>
                <td className="px-5 py-3"><select value={draft.debit} onChange={(event) => updateDraft(method, 'debit', event.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"><option value="">Kosong</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} {account.name}</option>)}</select></td>
                <td className="px-5 py-3"><select value={draft.kredit} onChange={(event) => updateDraft(method, 'kredit', event.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"><option value="">Kosong</option>{cashBankOptions.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></td>
                <td className="px-5 py-3 text-center"><div className="flex items-center justify-center border border-slate-200 rounded-lg bg-white w-20 mx-auto overflow-hidden"><input aria-label={`Rating MDR ${method.name}`} type="number" min="0" max="100" step="0.01" value={draft.percent} onChange={(event) => updateDraft(method, 'percent', event.target.value)} className="w-12 px-1 py-1 text-slate-700 font-bold text-center outline-none" /><div className="flex flex-col border-l border-slate-200"><button type="button" onClick={() => adjustMdr(method, 0.01)} className="px-1.5 py-0.5 hover:bg-slate-50 text-[8px] text-slate-400 hover:text-slate-700 font-bold border-b border-slate-200 transition-colors">▲</button><button type="button" onClick={() => adjustMdr(method, -0.01)} className="px-1.5 py-0.5 hover:bg-slate-50 text-[8px] text-slate-400 hover:text-slate-700 font-bold transition-colors">▼</button></div></div></td>
                <td className="px-5 py-3 text-center">{modified ? <div className="flex items-center justify-center gap-1"><button type="button" onClick={() => cancelDraft(method)} className="p-1 rounded bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer" title="Batalkan Perubahan"><X size={13} className="stroke-[2.5]" /></button><button type="button" onClick={() => setPendingSaveId(method.id)} disabled={savingId === method.id} className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer disabled:opacity-60" title="Simpan Perubahan">{savingId === method.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} className="stroke-[2.5]" />}</button></div> : <button type="button" onClick={() => openHistoryLog(method)} className="p-1 text-[#0088E8] hover:bg-slate-100 rounded transition-colors cursor-pointer" title="Lihat Log Riwayat"><FileText size={14} className="stroke-[2.2]" /></button>}</td>
              </tr>;
            })}
            {!loading && filteredPayments.length === 0 && <tr><td colSpan="8" className="px-5 py-10 text-center text-slate-400">Cara pembayaran tidak ditemukan.</td></tr>}
          </tbody>
        </table>
      </div>

      {pendingSaveId && <Modal title="Simpan Perubahan Biaya MDR" onClose={() => setPendingSaveId(null)}><p className="text-xs font-semibold text-slate-550 leading-relaxed">Simpan perubahan Debit, Kredit, dan Rating MDR untuk cara pembayaran ini?</p><ModalActions onCancel={() => setPendingSaveId(null)} onConfirm={saveMdr} loading={savingId === pendingSaveId} /></Modal>}
      {aturAkunOpen && <Modal title="Atur Akun Pembayaran" onClose={() => setAturAkunOpen(false)}><p className="text-xs font-semibold text-slate-550">Akun ini akan diterapkan pada {selectedIds.length} cara pembayaran terpilih.</p><select value={aturAkunAccountId} onChange={(event) => setAturAkunAccountId(event.target.value)} className="mt-3 w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] font-semibold"><option value="">Pilih akun kas/bank</option>{cashBankOptions.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select><ModalActions onCancel={() => setAturAkunOpen(false)} onConfirm={saveAccount} loading={savingAccount} confirmLabel="Perbarui" /></Modal>}
      {logState.open && <Modal wide title={`Cara Pembayaran ${logState.title} Detail Log`} onClose={() => setLogState({ open: false, title: '', entries: [], loading: false })}><div className="max-h-80 overflow-auto border border-slate-100 rounded-lg">{logState.loading ? <div className="text-center py-8 text-slate-400"><Loader2 className="animate-spin inline mr-2" size={14} />Memuat log...</div> : logState.entries.length ? <table className="w-full min-w-[680px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Diproses Oleh</th><th className="px-3 py-2">Aksi</th><th className="px-3 py-2">Log Nomor Akun (Dari → Ke)</th><th className="px-3 py-2">Log Nama Akun (Dari → Ke)</th></tr></thead><tbody className="divide-y divide-slate-100">{logState.entries.map((entry) => <tr key={entry.id} className="align-top"><td className="px-3 py-3 whitespace-nowrap text-slate-600">{formatLogTimestamp(entry.created_at)}</td><td className="px-3 py-3"><p className="font-bold text-slate-700">{entry.actor_name || 'System'}</p><p className="mt-0.5 text-slate-400">{entry.actor_email || '-'}</p></td><td className="px-3 py-3 font-bold text-slate-700 uppercase">{entry.action}</td><td className="px-3 py-3 whitespace-nowrap"><span className="font-bold text-slate-700">{entry.previous_account_code || '0'}</span><span className="mx-2 font-bold text-[#0088E8]">→</span><span className="font-bold text-slate-700">{entry.account_code || '0'}</span></td><td className="px-3 py-3"><span className="font-semibold text-slate-700">{entry.previous_account_name || '-'}</span><span className="mx-2 font-bold text-[#0088E8]">→</span><span className="font-semibold text-slate-700">{entry.account_name || '-'}</span>{entry.detail && <p className="mt-1 text-[10px] font-medium text-slate-400">{entry.detail}</p>}</td></tr>)}</tbody></table> : <p className="py-8 text-center text-slate-400">Belum ada riwayat perubahan.</p>}</div><div className="flex justify-end pt-4"><button type="button" onClick={() => setLogState({ open: false, title: '', entries: [], loading: false })} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">Tutup</button></div></Modal>}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in"><div className={`bg-white rounded-xl border border-slate-200 shadow-2xl p-5 ${wide ? 'w-[760px]' : 'w-[420px]'} max-w-[calc(100vw-2rem)] text-left space-y-4`}><div className="flex items-center justify-between border-b border-slate-100 pb-2"><h3 className="text-sm font-bold text-slate-800">{title}</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup"><X size={15} /></button></div>{children}</div></div>;
}

function ModalActions({ onCancel, onConfirm, loading, confirmLabel = 'Simpan' }) {
  return <div className="flex items-center justify-end gap-2 pt-2"><button type="button" onClick={onCancel} disabled={loading} className="px-4 py-1.5 border border-slate-200 bg-white text-slate-650 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer">Batal</button><button type="button" onClick={onConfirm} disabled={loading} className="px-4 py-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs disabled:opacity-60">{loading ? <Loader2 size={13} className="animate-spin" /> : confirmLabel}</button></div>;
}
