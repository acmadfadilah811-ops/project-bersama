import { useState } from 'react';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1.5 md:gap-6 md:items-center">
      <label className="text-sm text-blue-600">{label}</label>
      <div>{children}</div>
    </div>
  );
}

/**
 * Form "Tambah Tipe Transaksi" (tampilan satu halaman penuh).
 * Isi nama tipe lalu pilih Pendapatan / Pengeluaran.
 */
export default function TambahTipeTransaksiForm({ onCancel, onSave }) {
  const [nama, setNama] = useState('');
  const [tipe, setTipe] = useState('Pendapatan');
  const canSave = nama.trim().length > 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
        <h3 className="text-slate-800 font-bold text-[15px]">Tambah Tipe Transaksi</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave?.({ nama, tipe })}
            className={`text-sm font-semibold rounded-lg px-5 py-2 transition-colors ${
              canSave
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Simpan
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        <Field label="Nama Tipe Transaksi">
          <input value={nama} onChange={(e) => setNama(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Tipe Transaksi">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {['Pendapatan', 'Pengeluaran'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipe(t)}
                className={`px-5 py-2 text-sm font-semibold cursor-pointer border-r border-slate-200 last:border-r-0 transition-colors ${
                  tipe === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}
