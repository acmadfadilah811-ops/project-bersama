import { useEffect, useMemo, useState } from 'react';
import { Camera, Frame, Package, Search } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { formatRupiah } from '../hooks/useStarfoto';

// Panel kanan Terminal Kasir mode StarFoto (2026-10-11): paket foto per
// kategori & pigura per ukuran. Tab "Produk Lain" memakai katalog biasa
// (dirender PosTerminal) lewat setTab('lain').

export const TAB_STARFOTO = [
  { id: 'paket', label: 'Paket Foto', icon: Camera },
  { id: 'pigura', label: 'Pigura', icon: Frame },
  { id: 'lain', label: 'Produk Lain', icon: Package },
];

export function StarfotoTabBar({ tab, setTab }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-10 border-b border-blue-400/40 bg-[#0088FF] px-6 pt-3 text-white">
      {TAB_STARFOTO.map(({ id, label, icon: Ikon }) => (
        <button
          key={id} type="button" onClick={() => setTab(id)}
          className={`flex cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-xs font-bold transition-all ${tab === id ? 'border-white text-white' : 'border-transparent text-blue-100 hover:text-white'}`}
        >
          <Ikon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

function KatalogPaket({ paketList, paketAktifId, onPilihPaket }) {
  const [cari, setCari] = useState('');
  const kelompok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const hasil = {};
    paketList
      .filter((p) => !q || p.nama.toLowerCase().includes(q) || (p.kategori_nama || '').toLowerCase().includes(q))
      .forEach((p) => {
        const k = (p.kategori_nama || 'Lainnya').replace(/^Paket /, '');
        (hasil[k] = hasil[k] || []).push(p);
      });
    return Object.entries(hasil);
  }, [paketList, cari]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari paket..." className="w-full max-w-sm rounded-md bg-white py-1.5 pl-9 pr-3 text-sm shadow-sm outline-none" />
      </div>
      {kelompok.map(([kategori, daftar]) => (
        <div key={kategori}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-100">{kategori}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {daftar.map((p) => (
              <button
                key={p.id} type="button" onClick={() => onPilihPaket(p)}
                className={`cursor-pointer rounded-lg bg-white p-3 text-left shadow-sm transition-all hover:shadow-md ${paketAktifId === p.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0088FF]' : ''}`}
              >
                <p className="text-sm font-bold leading-tight text-slate-800">{p.nama}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{formatRupiah(p.harga)}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {p.kuota_orang} orang · {p.jumlah_edit} edit{p.jumlah_sesi > 1 ? ` · ${p.jumlah_sesi} sesi` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}
      {!kelompok.length && <p className="py-10 text-center text-sm text-blue-100">Paket tidak ditemukan.</p>}
    </div>
  );
}

function KatalogPigura({ onTambahPigura }) {
  const [pigura, setPigura] = useState([]);
  const [dipilih, setDipilih] = useState(null);

  useEffect(() => {
    let aktif = true;
    apiClient.get('/products/', { params: { search: 'Pigura', is_active: 'true', page_size: 200 } })
      .then((res) => {
        const daftar = (Array.isArray(res.data) ? res.data : res.data?.results || []).filter((p) => p.nama.startsWith('Pigura'));
        if (aktif) { setPigura(daftar); setDipilih((d) => d || daftar[0]?.id || null); }
      })
      .catch(() => { if (aktif) setPigura([]); });
    return () => { aktif = false; };
  }, []);

  const produk = pigura.find((p) => p.id === dipilih);
  const stok = (v) => Number(v.qty_stok || 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="space-y-1">
        {pigura.map((p) => (
          <button
            key={p.id} type="button" onClick={() => setDipilih(p.id)}
            className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm ${dipilih === p.id ? 'bg-white font-bold text-[#0088FF] shadow-sm' : 'text-blue-50 hover:bg-blue-600/60'}`}
          >
            {p.nama.replace(/^Pigura /, '')}
          </button>
        ))}
        {!pigura.length && <p className="text-sm text-blue-100">Belum ada pigura.</p>}
      </div>
      {produk && (
        <div>
          <p className="mb-1 text-sm font-bold text-white">{produk.nama}</p>
          <p className="mb-3 text-xs text-blue-100">Pilih ukuran. Catat kode warna di catatan item.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {(produk.variants || []).map((v) => (
              <button
                key={v.id} type="button" onClick={() => onTambahPigura(produk, v)}
                className="cursor-pointer rounded-lg bg-white p-3 text-left shadow-sm transition-all hover:shadow-md"
              >
                <p className="text-sm font-bold text-slate-800">{v.nama_varian}</p>
                <p className="text-sm text-slate-700">{formatRupiah(v.harga_jual_toko)}</p>
                <p className={`text-[11px] ${stok(v) > 0 ? 'text-slate-400' : 'text-amber-700'}`}>Stok {stok(v)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StarfotoKatalogPanel({ tab, setTab, paketList, paketAktifId, onPilihPaket, onTambahPigura }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0088FF]">
      <StarfotoTabBar tab={tab} setTab={setTab} />
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'paket'
          ? <KatalogPaket paketList={paketList} paketAktifId={paketAktifId} onPilihPaket={onPilihPaket} />
          : <KatalogPigura onTambahPigura={onTambahPigura} />}
      </div>
    </div>
  );
}
