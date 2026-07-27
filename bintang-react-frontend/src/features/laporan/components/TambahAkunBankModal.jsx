import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

const BANKS = [
  'BCA',
  'BNI',
  'BRI',
  'Bank Mandiri',
  'CIMB Niaga',
  'Bank BTN',
  'Bank Danamon',
  'Permata Bank',
];

/**
 * Modal "Tambah Akun Bank" — untuk menerima dana settlement.
 */
export default function TambahAkunBankModal({ onClose, onSave }) {
  const [namaBank, setNamaBank] = useState('');
  const [cabang, setCabang] = useState('');
  const [namaAkun, setNamaAkun] = useState('');
  const [nomorAkun, setNomorAkun] = useState('');

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Tambah Akun Bank</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onSave?.({ namaBank, cabang, namaAkun, nomorAkun })}
              className="text-sm font-semibold rounded-lg px-5 py-2 bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-sm transition-colors"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-500">
            Pastikan Nama dan Nomor akun sesuai dengan buku tabungan Anda
          </p>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Nama Bank</label>
            <div className="relative">
              <select
                value={namaBank}
                onChange={(e) => setNamaBank(e.target.value)}
                className={`${inputClass} appearance-none cursor-pointer pr-9 ${
                  namaBank ? '' : 'text-slate-400'
                }`}
              >
                <option value="">Pilih tipe bisnis Anda</option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Cabang</label>
            <input value={cabang} onChange={(e) => setCabang(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Nama Akun</label>
            <input
              value={namaAkun}
              onChange={(e) => setNamaAkun(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Nomor Akun</label>
            <input
              value={nomorAkun}
              onChange={(e) => setNomorAkun(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
