import { useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';

// Rincian stok saat void / batal / retur (2026-09-26): menampilkan barang jadi &
// bahan yang terdampak, beserta keterangan mana yang kembali ke stok dan mana yang
// tidak, dan (untuk void POS / retur) pilihan kondisinya.
//   mode 'void_pos' : value = bahanTerpakai (bool)
//   mode 'retur'    : value = barangLayakJual (bool)
//   mode 'batal'    : info saja (bahan produksi yang sudah terpakai tidak kembali)

const fmt = (d) => `${d.nama} — ${Number(d.qty).toLocaleString('id-ID')} ${d.satuan || ''}`.trim();

function Daftar({ judul, items, keterangan, kembali }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-bold text-slate-600">{judul}</div>
      <ul className="text-xs text-slate-700 list-disc pl-5">
        {items.map((d) => <li key={`${d.nama}-${d.satuan}`}>{fmt(d)}</li>)}
      </ul>
      <div className={`text-[11px] font-semibold ${kembali ? 'text-emerald-700' : 'text-slate-500'}`}>{keterangan}</div>
    </div>
  );
}

function Pilihan({ nama, value, onChange, opsi }) {
  return (
    <div className="space-y-1.5">
      {opsi.map((o) => (
        <label key={String(o.nilai)} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="radio" name={nama} className="mt-0.5" checked={value === o.nilai} onChange={() => onChange(o.nilai)} />
          <span><b>{o.label}</b> — {o.ket}</span>
        </label>
      ))}
    </div>
  );
}

export default function RincianStokPengembalian({ url, mode, value, onChange }) {
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let batal = false;
    if (!url) return undefined;
    apiClient.get(url)
      .then((res) => { if (!batal) setData(res.data || { produk: [], bahan: [] }); })
      .catch(() => { if (!batal) setGagal(true); });
    return () => { batal = true; };
  }, [url]);

  if (gagal) return <p className="text-[11px] text-slate-400">Rincian stok tidak dapat dimuat.</p>;
  if (!data) return <p className="text-[11px] text-slate-400">Memuat rincian stok…</p>;
  const { produk = [], bahan = [] } = data;
  const kosong = !produk.length && !bahan.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3 text-left">
      <div className="text-xs font-extrabold text-slate-700">Rincian stok</div>
      {kosong && <p className="text-[11px] text-slate-500">Tidak ada barang/bahan yang stoknya dilacak pada transaksi ini.</p>}

      {mode === 'void_pos' && (
        <>
          <Daftar judul="Barang jadi" items={produk} kembali keterangan="Dikembalikan ke stok." />
          {bahan.length > 0 && (
            <>
              <Daftar
                judul="Bahan resep yang terpakai"
                items={bahan}
                kembali={!value}
                keterangan={value
                  ? 'Tidak dikembalikan — produk sudah dicetak/dibuat, bahan tetap tercatat sebagai biaya (HPP).'
                  : 'Dikembalikan ke stok bahan baku.'}
              />
              <Pilihan
                nama="bahan_terpakai"
                value={value}
                onChange={onChange}
                opsi={[
                  { nilai: false, label: 'Belum dicetak/dibuat', ket: 'bahan dikembalikan ke stok' },
                  { nilai: true, label: 'Sudah dicetak/dibuat', ket: 'bahan tidak bisa dipakai lagi, tidak dikembalikan' },
                ]}
              />
            </>
          )}
        </>
      )}

      {mode === 'retur' && (
        <>
          <Daftar
            judul="Barang jadi"
            items={produk}
            kembali={value}
            keterangan={value ? 'Masuk kembali ke stok saat retur dikonfirmasi.' : 'Tidak masuk stok — dicatat rusak/tidak layak jual.'}
          />
          {produk.length > 0 && (
            <Pilihan
              nama="barang_layak_jual"
              value={value}
              onChange={onChange}
              opsi={[
                { nilai: true, label: 'Layak dijual lagi', ket: 'barang masuk kembali ke stok' },
                { nilai: false, label: 'Rusak / tidak bisa dipakai', ket: 'barang tidak masuk stok' },
              ]}
            />
          )}
          <Daftar
            judul="Bahan produksi yang sudah terpakai"
            items={bahan}
            keterangan="Tidak dikembalikan — bahan sudah terpakai saat produksi (mis. banner sudah dicetak)."
          />
        </>
      )}

      {mode === 'batal' && (
        <>
          <Daftar judul="Barang jadi" items={produk} kembali keterangan="Dikembalikan ke stok." />
          <Daftar
            judul="Bahan produksi yang sudah terpakai"
            items={bahan}
            keterangan="Tidak dikembalikan — bahan sudah terpakai saat produksi."
          />
        </>
      )}
    </div>
  );
}
