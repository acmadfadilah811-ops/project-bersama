import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import TambahAkunPopup from './TambahAkunPopup';

export default function CaraPembayaranStep({ caraPembayaran, onNext }) {
  const {
    paymentMethods,
    cashBankAccounts,
    loading,
    selectedIds,
    toggleSelected,
    toggleSelectAll,
    aturAkunOpen,
    aturAkunAccountId,
    setAturAkunAccountId,
    openAturAkun,
    cancelAturAkun,
    submitAturAkun,
    saving,
    previewAccountFor,
    tambahAkunOpen,
    setTambahAkunOpen,
    refetch,
  } = caraPembayaran;

  const hasSelection = selectedIds.length > 0;
  const selectableCount = paymentMethods.filter((m) => !m.is_locked).length;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setTambahAkunOpen((prev) => !prev)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
          >
            Tambah Akun
          </button>
          {tambahAkunOpen && (
            <TambahAkunPopup onClose={() => setTambahAkunOpen(false)} onCreated={refetch} />
          )}
        </div>

        {!hasSelection && (
          <button
            type="button"
            onClick={onNext}
            className="px-5 py-2 rounded-lg bg-[#0088E8] hover:bg-sky-600 text-white font-bold text-xs transition-all cursor-pointer"
          >
            Selanjutnya
          </button>
        )}

        {hasSelection && !aturAkunOpen && (
          <button
            type="button"
            onClick={openAturAkun}
            className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all cursor-pointer"
          >
            Atur Akun
          </button>
        )}

        </div>

        {hasSelection && aturAkunOpen && (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Akun pembayaran untuk metode terpilih</span>
              <select
                value={aturAkunAccountId}
                onChange={(e) => setAturAkunAccountId(e.target.value)}
                className="w-full min-w-[16rem] px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:border-[#0088E8] outline-none"
              >
                {cashBankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.account}>
                    {acc.account_code} {acc.account_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={cancelAturAkun}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitAturAkun}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Perbarui'}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectableCount > 0 && selectedIds.length === selectableCount}
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Nama Pembayaran</th>
                <th className="px-4 py-3">Tipe Pembayaran</th>
                <th className="px-4 py-3">Akun Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentMethods.map((method) => {
                const preview = previewAccountFor(method);
                return (
                  <tr key={method.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(method.id)}
                        disabled={method.is_locked}
                        onChange={() => toggleSelected(method.id, method.is_locked)}
                        className={method.is_locked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{method.name}</td>
                    <td className="px-4 py-3 text-slate-600">{method.payment_type}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {preview.code} - {preview.name}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
