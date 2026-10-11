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
    <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-4 pt-3">
      {TAB_STARFOTO.map(({ id, label, icon: Ikon }) => (
        <button
          key={id} type="button" onClick={() => setTab(id)}
          className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-4 py-2 text-sm font-bold ${tab === id ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
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
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari paket..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
      </div>
      {kelompok.map(([kategori, daftar]) => (
        <div key={kategori}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{kategori}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {daftar.map((p) => (
              <button
                key={p.id} type="button" onClick={() => onPilihPaket(p)}
                className={`rounded-xl border p-3 text-left transition-colors ${paketAktifId === p.id ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}
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
      {!kelompok.length && <p className="py-10 text-center text-sm text-slate-400">Paket tidak ditemukan.</p>}
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
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${dipilih === p.id ? 'bg-slate-800 font-bold text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {p.nama.replace(/^Pigura /, '')}
          </button>
        ))}
        {!pigura.length && <p className="text-sm text-slate-400">Belum ada pigura.</p>}
      </div>
      {produk && (
        <div>
          <p className="mb-1 text-sm font-bold text-slate-800">{produk.nama}</p>
          <p className="mb-3 text-xs text-slate-500">Pilih ukuran. Catat kode warna di catatan item.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {(produk.variants || []).map((v) => (
              <button
                key={v.id} type="button" onClick={() => onTambahPigura(produk, v)}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-slate-400"
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
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#F8FAFC]">
      <StarfotoTabBar tab={tab} setTab={setTab} />
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'paket'
          ? <KatalogPaket paketList={paketList} paketAktifId={paketAktifId} onPilihPaket={onPilihPaket} />
          : <KatalogPigura onTambahPigura={onTambahPigura} />}
      </div>
    </div>
  );
}
