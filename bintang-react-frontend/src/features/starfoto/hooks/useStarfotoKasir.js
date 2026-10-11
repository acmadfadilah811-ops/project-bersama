import { useEffect, useMemo, useState } from 'react';
import { usePaketFoto, usePengaturanStarfoto } from './useStarfoto';

// Mode StarFoto di Terminal Kasir (2026-10-11): aktif otomatis bila keranjang
// berisi produk yang terdaftar sebagai Paket Foto. Data sesi diisi sebelum
// pembayaran lalu dikirim sebagai blok `starfoto` ke /orders/checkout-pos/.
export default function useStarfotoKasir(cart) {
  const { paket } = usePaketFoto();
  const { pengaturan } = usePengaturanStarfoto();
  const [data, setData] = useState(null);
  const [modalTerbuka, setModalTerbuka] = useState(false);

  const paketByProduct = useMemo(() => Object.fromEntries(paket.map((p) => [p.product, p])), [paket]);
  const item = cart.find((it) => it.product?.id && paketByProduct[it.product.id]) || null;
  const paketAktif = item ? paketByProduct[item.product.id] : null;

  // Keranjang dikosongkan / paket dihapus -> data sesi ikut dibuang.
  useEffect(() => {
    if (!item) setData(null);
  }, [item]);

  return {
    item,
    paket: paketAktif,
    pengaturan,
    data,
    setData,
    modalTerbuka,
    bukaModal: () => setModalTerbuka(true),
    tutupModal: () => setModalTerbuka(false),
    reset: () => { setData(null); setModalTerbuka(false); },
  };
}

// Item keranjang paket dengan addon "tambah orang" disesuaikan ke `kelebihan`.
export function sesuaikanTambahOrang(item, paket, kelebihan) {
  const addonId = paket?.addon_tambah_orang;
  if (!addonId) return item;
  const addonsLama = item.addons || [];
  const totalAddonLama = addonsLama.reduce((s, a) => s + Number(a.harga || 0) * (item.addonQty?.[a.id] || 1), 0);
  const dasar = Number(item.hargaTotal ?? Number(item.harga || 0) * Number(item.qty || 1)) - totalAddonLama;
  const tanpaTambah = addonsLama.filter((a) => a.id !== addonId);
  const addonQty = { ...(item.addonQty || {}) };
  delete addonQty[addonId];
  const addons = kelebihan > 0
    ? [...tanpaTambah, { id: addonId, nama: paket.addon_tambah_orang_nama, harga: paket.addon_tambah_orang_harga }]
    : tanpaTambah;
  if (kelebihan > 0) addonQty[addonId] = kelebihan;
  const totalAddonBaru = addons.reduce((s, a) => s + Number(a.harga || 0) * (addonQty[a.id] || 1), 0);
  return {
    ...item,
    addons,
    addonIds: addons.map((a) => a.id),
    addonQty,
    hargaTotal: dasar + totalAddonBaru,
  };
}
