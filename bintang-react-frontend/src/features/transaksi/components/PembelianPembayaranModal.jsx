import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import AturAkunDrawer from './AturAkunDrawer';
import apiClient from '../../../api/apiClient';

/**
 * Pop-up Pembayaran (Presisi 1:1 SS No. 1 & 2 Olsera).
 * Mendukung Tanggal Pembayaran, Referensi Pembayaran, Payment Jurnal + Gear Button Atur Akun Drawer,
 * Total Pembayaran, dan Checkbox Down Payment (DP).
 */
export default function PembelianPembayaranModal({ sisa = 0, isAdvance = false, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [referensi, setReferensi] = useState('');
  const [selectedJournal, setSelectedJournal] = useState('');
  const [nominal, setNominal] = useState(sisa > 0 ? String(sisa) : '0');

  // Accounts list + Drawer state
  const [accounts, setAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [showAturAkun, setShowAturAkun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountsError, setAccountsError] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/accounting/accounts/');
      const sourceAccounts = Array.isArray(data) ? data : [];
      const cashBankAccounts = sourceAccounts.filter((account) => (
        account.account_type === 'asset' && account.klasifikasi === 'Kas & Bank'
      ));
      setAllAccounts(sourceAccounts);
      setAccounts(cashBankAccounts);
      setSelectedJournal((current) => (
        cashBankAccounts.some((account) => String(account.id) === String(current))
          ? current
          : String(cashBankAccounts[0]?.id || '')
      ));
      setAccountsError('');
    } catch (err) {
      setAccounts([]);
      setAllAccounts([]);
      setAccountsError(err.response?.data?.detail || 'Akun Kas/Bank dari Akuntansi tidak dapat dimuat.');
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const nominalNum = Number(nominal) || 0;
  const canSave = nominalNum > 0 && Boolean(selectedJournal) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const selectedAccountObj = accounts.find((account) => String(account.id) === String(selectedJournal));
      const journalLabel = selectedAccountObj
        ? `${selectedAccountObj.code} ${selectedAccountObj.name}`
        : selectedJournal;

      await onSave?.({
        tanggal,
        nominal: nominalNum,
        referensi_pembayaran: referensi.trim(),
        payment_jurnal: journalLabel,
        payment_account_id: selectedAccountObj?.id,
        is_dp: isAdvance,
      });
    } finally {
      setSaving(false);
    }
  };

  const fmtRpDisplay = (val) => {
    const num = Number(val) || 0;
    return `Rp. ${num.toLocaleString('id-ID')},00`;
  };

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100">

          {/* Header Bar - Title Left & Buttons Right */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-xl">Pembayaran</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold text-slate-600 border border-slate-200 rounded-xl px-5 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={handleSave}
                className={`text-xs font-bold rounded-xl px-6 py-2.5 transition-colors shadow-xs ${
                  canSave
                    ? 'bg-[#76CB39] hover:bg-[#65b52c] text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6">

            {/* Field 1: Tanggal Pembayaran */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Tanggal Pembayaran</label>
              <div className="relative">
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl px-4 py-3 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 cursor-pointer"
                />
              </div>
            </div>

            {/* Field 2: Referensi Pembayaran */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Referensi Pembayaran</label>
              <span className="block text-[11px] text-slate-400">Referensi pembayaran dari Paypal/Bank</span>
              <input
                type="text"
                value={referensi}
                onChange={(e) => setReferensi(e.target.value)}
                placeholder="Masukkan Referensi Pembayaran"
                className="w-full text-xs border border-slate-300 rounded-xl px-4 py-3 text-slate-700 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>

            {/* Field 3: Payment jurnal + Gear Button */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Payment jurnal</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedJournal}
                  onChange={(e) => setSelectedJournal(e.target.value)}
                  className="flex-1 text-xs font-bold border border-slate-300 rounded-xl px-4 py-3 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 cursor-pointer"
                >
                  {accounts.length === 0 && <option value="">Tidak ada akun Kas/Bank aktif</option>}
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} {acc.name}
                    </option>
                  ))}
                </select>

                {/* Gear button (Biru) -> Membuka Atur Akun Drawer */}
                <button
                  type="button"
                  onClick={() => setShowAturAkun(true)}
                  className="w-11 h-11 rounded-xl bg-[#009bf2] hover:bg-[#0089d6] text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-xs"
                  title="Atur Akun Jurnal"
                >
                  <Settings size={18} />
                </button>
              </div>
              {accountsError && <p className="text-[11px] font-medium text-rose-600">{accountsError}</p>}
            </div>

            {/* Field 4: Total Pembayaran */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Total Pembayaran</label>
              <input
                type="number"
                min="0"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                className="w-full text-xs font-bold font-mono border border-slate-300 rounded-xl px-4 py-3 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
              <span className="text-[11px] font-bold text-slate-400 block font-mono">
                Format: {fmtRpDisplay(nominal)}
              </span>
            </div>

            <p className="text-xs font-semibold text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              {isAdvance ? 'Pembayaran ini dicatat sebagai Down Payment karena barang belum diterima.' : 'Pembayaran ini dicatat sebagai pelunasan Hutang Dagang.'}
            </p>

          </div>
        </div>
      </div>

      {/* Side Drawer Atur Akun (SS No. 2) */}
      {showAturAkun && (
        <AturAkunDrawer
          accounts={allAccounts}
          onRefreshAccounts={loadAccounts}
          onClose={() => setShowAturAkun(false)}
        />
      )}
    </>
  );
}
