import { useEffect, useState } from 'react';
import { Camera, Minus, Plus, Trash2, X } from 'lucide-react';
import { ambilAddonPaket, formatRupiah } from '../hooks/useStarfoto';
import { aturAddon, galatData, sesuaikanTambahOrang } from '../hooks/useStarfotoKasir';

// Form pesanan foto di panel kanan Terminal Kasir mode StarFoto (2026-10-11).
// Perubahan jumlah orang/tambahan langsung memperbarui item paket di keranjang
// (harga dari master; server menghitung ulang saat checkout, M6).

function Stepper({ nilai, onUbah, min = 0 }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onUbah(Math.max(min, nilai - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-white text-[#0088FF] hover:bg-blue-50" aria-label="Kurangi">
        <Minus size={14} />
      </button>
      <span className="w-8 text-center text-sm font-bold">{nilai}</span>
      <button type="button" onClick={() => onUbah(nilai + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0088FF] text-white hover:bg-blue-600" aria-label="Tambah">
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function StarfotoPesananPanel({ paket, item, data, setData, pengaturan, totalKeranjang, onUbahItem, onHapus, onTutup }) {
  const [addons, setAddons] = useState([]);

  useEffect(() => {
    let aktif = true;
    ambilAddonPaket(paket.product, paket.kategori)
      .then((daftar) => { if (aktif) setAddons(daftar.filter((a) => a.id !== paket.addon_tambah_orang)); })
      .catch(() => { if (aktif) setAddons([]); });
    return () => { aktif = false; };
  }, [paket.product, paket.kategori, paket.addon_tambah_orang]);

  if (!data) return null;
  const ubah = (kunci, nilai) => setData({ ...data, [kunci]: nilai });
  const ubahSesi = (i, kunci, nilai) => setData({ ...data, sesi: data.sesi.map((s, idx) => (idx === i ? { ...s, [kunci]: nilai } : s)) });

  const ubahJumlahOrang = (jumlah) => {
    setData({ ...data, jumlah_orang: jumlah });
    onUbahItem(sesuaikanTambahOrang(item, paket, Math.max(0, jumlah - Number(paket.kuota_orang || 0))));
  };
  const qtyAddon = (id) => ((item.addonIds || []).includes(id) ? Number(item.addonQty?.[id] || 1) : 0);
  const kelebihan = Math.max(0, Number(data.jumlah_orang || 0) - Number(paket.kuota_orang || 0));
  const persenDp = paket.dp_minimal_persen != null ? Number(paket.dp_minimal_persen) : Number(pengaturan?.dp_minimal_persen ?? 50);
  const durasi = paket.durasi_menit || pengaturan?.durasi_default_menit || 30;
  const galat = galatData(data);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-slate-200 bg-[#F4F7FE]">
      <div className="flex shrink-0 items-start justify-between bg-[#0088FF] px-5 py-3 text-white shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-blue-100"><Camera size={14} /> Pesanan Foto</p>
          <p className="text-base font-bold">{paket.nama} · {formatRupiah(paket.harga)}</p>
          <p className="text-xs text-blue-100">{paket.kuota_orang} orang · {paket.jumlah_edit} file edit · {durasi} menit{paket.jumlah_sesi > 1 ? ` × ${paket.jumlah_sesi} sesi` : ''}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onHapus} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Hapus paket"><Trash2 size={16} /></button>
          <button type="button" onClick={onTutup} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Tutup"><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
        {paket.isi_paket && <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-slate-600">{paket.isi_paket}</p>}
        <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-5">

        <div className="grid grid-cols-2 gap-2">
          {[['walkin', 'Datang Langsung'], ['booking_wa', 'Booking WhatsApp']].map(([id, label]) => (
            <button
              key={id} type="button" onClick={() => ubah('jenis', id)}
              className={`rounded-lg py-2 font-bold ${data.jenis === id ? 'bg-[#0088FF] text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-700">Jumlah orang</p>
            <p className="text-xs text-slate-500">
              {kelebihan > 0
                ? (paket.addon_tambah_orang ? `+${kelebihan} × ${formatRupiah(paket.addon_tambah_orang_harga)}` : 'Addon tambah orang belum diatur')
                : `Termasuk paket (maks ${paket.kuota_orang})`}
            </p>
          </div>
          <Stepper nilai={Number(data.jumlah_orang) || 1} onUbah={ubahJumlahOrang} min={1} />
        </div>

        {addons.length > 0 && (
          <div>
            <p className="mb-2 font-semibold text-slate-700">Tambahan</p>
            <div className="space-y-2">
              {addons.map((a) => (
                <div key={a.id} className={`flex items-center justify-between rounded-lg border bg-white px-3 py-2 ${qtyAddon(a.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                  <div>
                    <p className="font-medium text-slate-700">{a.nama}</p>
                    <p className="text-xs text-slate-500">{formatRupiah(a.harga)}</p>
                  </div>
                  <Stepper nilai={qtyAddon(a.id)} onUbah={(q) => onUbahItem(aturAddon(item, a, q))} />
                </div>
              ))}
            </div>
          </div>
        )}

        </div>

        <div className="space-y-5">
        <div className="space-y-3">
          {data.sesi.map((s, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-400">Jadwal sesi {i + 1}{i > 0 ? ' (boleh diisi nanti)' : ''}</p>
              <input type="datetime-local" value={s.mulai} onChange={(e) => ubahSesi(i, 'mulai', e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" />
              {i === 0 && data.jenis === 'walkin' && !s.mulai && <p className="text-xs text-slate-400">Kosong = mulai sekarang.</p>}
              <div className="flex gap-2">
                <select value={s.lokasi} onChange={(e) => ubahSesi(i, 'lokasi', e.target.value)} className="rounded-lg border border-slate-300 p-2">
                  <option value="studio">Studio</option>
                  <option value="outdoor">Outdoor</option>
                </select>
                {s.lokasi === 'outdoor' && (
                  <input value={s.alamat} onChange={(e) => ubahSesi(i, 'alamat', e.target.value)} placeholder="Alamat lokasi" className="flex-1 rounded-lg border border-slate-300 p-2" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><span className="font-semibold text-slate-700">No. Kantong</span>
            <p className="rounded-lg border border-dashed border-blue-300 bg-white p-2 text-slate-600">
              Otomatis{pengaturan?.kantong_berikutnya ? ` · ${pengaturan.kantong_berikutnya}` : ''}
            </p>
          </div>
          <label className="space-y-1"><span className="font-semibold text-slate-700">Background</span>
            <input value={data.background} onChange={(e) => ubah('background', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2" />
          </label>
        </div>
        <label className="flex items-center gap-2 font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(data.butuh_asisten)} onChange={(e) => ubah('butuh_asisten', e.target.checked)} />
          Butuh asisten fotografer
        </label>
        <p className="text-xs text-slate-400">Fotografer & asisten mengambil sesi sendiri dari Antrean Sesi di HP.</p>
        </div>
        </div>
      </div>

      {/* Pembayaran lewat tombol total di panel kiri; kanan bawah untuk tombol Bantuan. */}
      <div className="flex shrink-0 items-center gap-6 border-t border-slate-200 bg-white py-3 pl-5 pr-36 text-sm">
        <div><span className="text-slate-500">Total </span><span className="font-bold text-slate-800">{formatRupiah(totalKeranjang)}</span></div>
        <div><span className="text-slate-500">DP minimal ({persenDp}%) </span><span className="font-bold text-[#0088FF]">{formatRupiah(Math.ceil((Number(totalKeranjang) * persenDp) / 100))}</span></div>
        {galat && <p className="text-xs text-amber-700">{galat}</p>}
      </div>
    </div>
  );
}
