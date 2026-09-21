import { useState } from 'react';

// Tombol aksi sesuai status. Aturan sebenarnya ditegakkan backend; di sini hanya
// menampilkan tombol yang relevan dan meminta konfirmasi sebelum menulis jurnal.

export default function AksiPostingGaji({ pratinjau, akun, sedangProses, onPosting, onKoreksi, onBayar }) {
  const [formBayar, setFormBayar] = useState(false);
  const [akunKas, setAkunKas] = useState('');
  const [tanggal, setTanggal] = useState('');

  const aktif = pratinjau.posting_aktif;
  const bisaPosting = pratinjau.status_posting === 'belum' && pratinjau.masalah.length === 0;
  const bisaKoreksi = pratinjau.status_posting === 'berbeda';
  const bisaBayar = Boolean(aktif) && !aktif.payment_journal_entry;
  const akunKasBank = akun.filter((a) => a.klasifikasi === 'Kas & Bank');

  const konfirmasi = (teks, fn) => () => {
    if (window.confirm(teks)) fn();
  };

  const kirimBayar = async () => {
    if (await onBayar(Number(akunKas), tanggal)) setFormBayar(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {bisaPosting && (
          <button type="button" disabled={sedangProses}
            onClick={konfirmasi('Posting gaji periode ini ke jurnal? Jurnal yang sudah diposting tidak bisa dihapus, hanya dikoreksi.', onPosting)}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg">
            Posting Gaji
          </button>
        )}
        {bisaKoreksi && (
          <button type="button" disabled={sedangProses}
            onClick={konfirmasi('Data HR berubah setelah diposting. Balik jurnal lama dan posting ulang dengan data terbaru?', onKoreksi)}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg">
            Koreksi
          </button>
        )}
        {bisaBayar && !formBayar && (
          <button type="button" disabled={sedangProses} onClick={() => setFormBayar(true)}
            className="px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded-lg">
            Catat Pembayaran Gaji
          </button>
        )}
      </div>

      {formBayar && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700">
            Catat pembayaran gaji (Dr Hutang gaji, Cr Kas/Bank) sebesar total gaji bersih yang sudah diakui.
          </p>
          <div className="flex flex-wrap gap-2">
            <select value={akunKas} onChange={(e) => setAkunKas(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-xs">
              <option value="">Pilih akun Kas / Bank...</option>
              {akunKasBank.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormBayar(false)} className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded">
              Batal
            </button>
            <button type="button" disabled={!akunKas || sedangProses} onClick={kirimBayar}
              className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded">
              Konfirmasi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
