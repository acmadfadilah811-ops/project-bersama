import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { formatRupiah } from '../hooks/useStarfoto';
import { sesuaikanTambahOrang } from '../hooks/useStarfotoKasir';

// Data sesi foto sebelum pembayaran di Terminal Kasir (2026-10-11).
// Jumlah orang di atas kuota otomatis menambah addon "tambah orang" di
// keranjang; DP minimal & bentrok jadwal tetap ditegakkan server.

const LOKASI_DEFAULT = { studio: 'studio', outdoor: 'outdoor', studio_outdoor: 'studio' };

export default function StarfotoSesiModal({ paket, item, pengaturan, awal, totalKeranjang, onSimpan, onClose }) {
  const [jenis, setJenis] = useState(awal?.jenis || 'walkin');
  const [jumlahOrang, setJumlahOrang] = useState(awal?.jumlah_orang || paket.kuota_orang || 1);
  const [background, setBackground] = useState(awal?.background || '');
  const [butuhAsisten, setButuhAsisten] = useState(Boolean(awal?.butuh_asisten));
  const [sesi, setSesi] = useState(() => {
    const jumlah = Math.max(1, paket.jumlah_sesi || 1);
    return Array.from({ length: jumlah }, (_, i) => awal?.sesi?.[i] || {
      mulai: '', lokasi: LOKASI_DEFAULT[paket.lokasi] || 'studio', alamat: '',
    });
  });
  const [galat, setGalat] = useState('');

  const kelebihan = Math.max(0, Number(jumlahOrang || 0) - Number(paket.kuota_orang || 0));
  const itemBaru = sesuaikanTambahOrang(item, paket, kelebihan);
  const selisih = Number(itemBaru.hargaTotal || 0) - Number(item.hargaTotal ?? Number(item.harga || 0) * Number(item.qty || 1));
  const total = Number(totalKeranjang || 0) + selisih;
  const persenDp = paket.dp_minimal_persen != null ? Number(paket.dp_minimal_persen) : Number(pengaturan?.dp_minimal_persen ?? 50);
  const dpMinimal = Math.ceil((total * persenDp) / 100);
  const durasi = paket.durasi_menit || pengaturan?.durasi_default_menit || 30;

  const ubahSesi = (i, kunci, nilai) => setSesi((prev) => prev.map((s, idx) => (idx === i ? { ...s, [kunci]: nilai } : s)));

  const simpan = () => {
    if (jenis === 'booking_wa' && !sesi[0].mulai) {
      setGalat('Booking wajib punya jadwal sesi pertama.');
      return;
    }
    const terisi = sesi.filter((s, i) => i === 0 || s.mulai);
    onSimpan({
      data: {
        jenis,
        jumlah_orang: Number(jumlahOrang) || 1,
        nomor_kantong: '',
        background: background.trim(),
        butuh_asisten: butuhAsisten,
        sesi: terisi.map((s) => ({ mulai: s.mulai || null, lokasi: s.lokasi, alamat: s.lokasi === 'outdoor' ? s.alamat : '' })),
      },
      item: itemBaru,
    });
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Camera size={16} /> Data Sesi Foto — {paket.nama}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {[['walkin', 'Datang Langsung'], ['booking_wa', 'Booking WhatsApp']].map(([id, label]) => (
              <button
                key={id} type="button" onClick={() => setJenis(id)}
                className={`rounded-lg py-2 font-bold ${jenis === id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-600">Jumlah orang</label>
            <input type="number" min={1} value={jumlahOrang} onChange={(e) => setJumlahOrang(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" />
            <p className="mt-1 text-xs text-slate-500">
              Paket untuk {paket.kuota_orang} orang.
              {kelebihan > 0 && (paket.addon_tambah_orang
                ? ` Tambah ${kelebihan} orang × ${formatRupiah(paket.addon_tambah_orang_harga)} otomatis masuk keranjang.`
                : ' Addon tambah orang belum diatur di master Paket Foto.')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-600">No. Kantong</label>
              <p className="rounded-lg border border-dashed border-slate-300 p-2 text-slate-500">Otomatis{pengaturan?.kantong_berikutnya ? ` · ${pengaturan.kantong_berikutnya}` : ''}</p>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-600">Background</label>
              <input value={background} onChange={(e) => setBackground(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" />
            </div>
          </div>

          {sesi.map((s, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-bold uppercase text-slate-400">
                Jadwal sesi {i + 1}{i > 0 ? ' (boleh diisi nanti)' : ''} · {durasi} menit
              </p>
              <input
                type="datetime-local" value={s.mulai} onChange={(e) => ubahSesi(i, 'mulai', e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2"
              />
              {i === 0 && jenis === 'walkin' && !s.mulai && <p className="text-xs text-slate-400">Kosong = mulai sekarang.</p>}
              <div className="flex gap-2">
                <select value={s.lokasi} onChange={(e) => ubahSesi(i, 'lokasi', e.target.value)} className="rounded-lg border border-slate-300 p-2">
                  <option value="studio">Studio</option>
                  <option value="outdoor">Outdoor</option>
                </select>
                {s.lokasi === 'outdoor' && (
                  <input
                    value={s.alamat} onChange={(e) => ubahSesi(i, 'alamat', e.target.value)} placeholder="Alamat lokasi"
                    className="flex-1 rounded-lg border border-slate-300 p-2"
                  />
                )}
              </div>
            </div>
          ))}

          <label className="flex items-center gap-2 font-semibold text-slate-600">
            <input type="checkbox" checked={butuhAsisten} onChange={(e) => setButuhAsisten(e.target.checked)} />
            Butuh asisten fotografer
          </label>
          <p className="text-xs text-slate-400">Fotografer & asisten mengambil sesi ini sendiri dari Antrean Sesi di HP.</p>

          {paket.isi_paket && <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{paket.isi_paket}</p>}
          {galat && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{galat}</p>}
        </div>

        <div className="space-y-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total pesanan</span><span className="font-bold">{formatRupiah(total)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">DP minimal ({persenDp}%)</span><span className="font-bold">{formatRupiah(dpMinimal)}</span></div>
          <button type="button" onClick={simpan} className="w-full rounded-xl bg-slate-800 py-2.5 font-bold text-white">
            Lanjut ke Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}
