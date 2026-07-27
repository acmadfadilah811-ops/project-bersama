import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';

export default function UbahAkunModal({ isOpen, onClose, account, onUpdated }) {
  const [ignoreMinusClosing, setIgnoreMinusClosing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !account) return;
    setIgnoreMinusClosing(account.ignore_minus_closing || false);
  }, [isOpen, account]);

  if (!isOpen || !account) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/accounting/accounts/${account.id}/`, {
        ignore_minus_closing: ignoreMinusClosing,
      });
      notifySuccess('Berhasil', 'Informasi akun berhasil diubah.');
      onUpdated?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal mengubah akun');
    } finally {
      setSaving(false);
    }
  };

  const isIgnoreMinusClosingVisible = account.account_type === 'asset';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-xl w-full flex flex-col p-6 relative">
        {/* Header Section */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-150 mb-5">
          <h3 className="text-base font-bold text-slate-800">Ubah Akun</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs transition-colors"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-[#73C240] hover:bg-[#64B031] text-white font-bold text-xs rounded-lg cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              <span>Perbarui</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-4">
          {/* Kategori (Disabled) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500">Kategori</label>
            <input
              type="text"
              value={account.klasifikasi || ''}
              disabled
              title="Kolom ini tidak dapat diubah"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-xs font-semibold cursor-not-allowed outline-none select-none"
            />
          </div>

          {/* Nama Akun (Disabled) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500">Nama Akun</label>
            <input
              type="text"
              value={account.name}
              disabled
              title="Kolom ini tidak dapat diubah"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-xs font-semibold cursor-not-allowed outline-none select-none"
            />
          </div>

          {/* Nomor Akun (Disabled) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500">Nomor Akun</label>
            <input
              type="text"
              value={account.code}
              disabled
              title="Kolom ini tidak dapat diubah"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-xs font-semibold cursor-not-allowed outline-none select-none"
            />
          </div>

          {/* Hiraukan minus closing */}
          {isIgnoreMinusClosingVisible && (
            <div className="space-y-1 pt-1">
              <label className="block text-[11px] font-bold text-slate-500">Hiraukan minus closing</label>
              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="ignore_minus_closing_edit"
                    checked={ignoreMinusClosing === true}
                    onChange={() => setIgnoreMinusClosing(true)}
                    className="w-3.5 h-3.5 text-[#0088E8] border-slate-350 focus:ring-0 cursor-pointer"
                  />
                  <span>Ya</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="ignore_minus_closing_edit"
                    checked={ignoreMinusClosing === false}
                    onChange={() => setIgnoreMinusClosing(false)}
                    className="w-3.5 h-3.5 text-[#0088E8] border-slate-350 focus:ring-0 cursor-pointer"
                  />
                  <span>Tidak</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
