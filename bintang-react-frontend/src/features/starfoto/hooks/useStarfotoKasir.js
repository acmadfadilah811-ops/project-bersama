import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { usePaketFoto, usePengaturanStarfoto } from './useStarfoto';

// Mode StarFoto di Terminal Kasir (2026-10-11).
// - Kasir ber-unit StarFoto (atau ?mode=starfoto) mendapat katalog bertab &
//   form pesanan foto di panel kanan.
// - Data sesi dikirim sebagai blok `starfoto` ke /orders/checkout-pos/.
export default function useStarfotoKasir(cart) {
  const { user } = useAuth();
  const { paket } = usePaketFoto();
  const { pengaturan } = usePengaturanStarfoto();
  const [data, setData] = useState(null);
  const [modalTerbuka, setModalTerbuka] = useState(false);

  const paketByProduct = useMemo(() => Object.fromEntries(paket.map((p) => [p.product, p])), [paket]);
  const item = cart.find((it) => it.product?.id && paketByProduct[it.product.id]) || null;
  const paketAktif = item ? paketByProduct[item.product.id] : null;
  const modeAktif = /starfoto/i.test(user?.unit_bisnis_nama || '')
    || new URLSearchParams(window.location.search).get('mode') === 'starfoto';

  // Keranjang dikosongkan / paket dihapus -> data sesi ikut dibuang; paket
  // baru -> data sesi bawaan sesuai paket.
  useEffect(() => {
    if (!item) setData(null);
    else if (!data || data.paketId !== paketAktif?.id) setData(dataAwal(paketAktif));
  }, [item, paketAktif]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    modeAktif,
    paketList: paket,
    paketByProduct,
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

export function dataAwal(paket) {
  const lokasi = paket?.lokasi === 'outdoor' ? 'outdoor' : 'studio';
  return {
    paketId: paket?.id,
    jenis: 'walkin',
    jumlah_orang: paket?.kuota_orang || 1,
    nomor_kantong: '',
    background: '',
    butuh_asisten: false,
    sesi: Array.from({ length: Math.max(1, paket?.jumlah_sesi || 1) }, () => ({ mulai: '', lokasi, alamat: '' })),
  };
}

// Blok `starfoto` untuk checkout: sesi ke-2 dst. yang belum dijadwalkan dibuang.
export function payloadStarfoto(data) {
  const { paketId, ...isi } = data; // eslint-disable-line no-unused-vars
  return {
    ...isi,
    jumlah_orang: Number(isi.jumlah_orang) || 1,
    sesi: isi.sesi
      .filter((s, i) => i === 0 || s.mulai)
      .map((s) => ({ mulai: s.mulai || null, lokasi: s.lokasi, alamat: s.lokasi === 'outdoor' ? s.alamat : '' })),
  };
}

export function galatData(data) {
  if (!data) return 'Isi data pesanan foto dulu.';
  if (data.jenis === 'booking_wa' && !data.sesi[0]?.mulai) return 'Booking wajib punya jadwal sesi pertama.';
  return '';
}

// Atur qty satu addon pada item keranjang (0 = hapus) dan hitung ulang hargaTotal.
export function aturAddon(item, addon, qty) {
  const addonsLama = item.addons || [];
  const qtyLama = item.addonQty || {};
  const totalLama = addonsLama.reduce((s, a) => s + Number(a.harga || 0) * (qtyLama[a.id] || 1), 0);
  const dasar = Number(item.hargaTotal ?? Number(item.harga || 0) * Number(item.qty || 1)) - totalLama;
  const addons = addonsLama.filter((a) => a.id !== addon.id);
  const addonQty = { ...qtyLama };
  delete addonQty[addon.id];
  if (qty > 0) {
    addons.push({ id: addon.id, nama: addon.nama, harga: addon.harga });
    addonQty[addon.id] = qty;
  }
  const totalBaru = addons.reduce((s, a) => s + Number(a.harga || 0) * (addonQty[a.id] || 1), 0);
  return { ...item, addons, addonIds: addons.map((a) => a.id), addonQty, hargaTotal: dasar + totalBaru };
}

// Item keranjang paket dengan addon "tambah orang" disesuaikan ke `kelebihan`.
export function sesuaikanTambahOrang(item, paket, kelebihan) {
  if (!paket?.addon_tambah_orang) return item;
  return aturAddon(item, {
    id: paket.addon_tambah_orang, nama: paket.addon_tambah_orang_nama, harga: paket.addon_tambah_orang_harga,
  }, kelebihan);
}
