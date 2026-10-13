import { getLogoUrl } from '../../../utils/logo';

/**
 * Satu sumber pengaturan cetak resi/invoice (2026-10-13).
 *
 * Sebelumnya tiap komponen cetak (ReceiptPrint, QZ HTML, TM-U220, faktur
 * pesanan, invoice papan produksi) membaca pengaturan sendiri-sendiri, sebagian
 * dengan alamat/telepon/rekening karangan sebagai nilai bawaan. Di sini semua
 * disatukan: isian yang kosong berarti barisnya tidak dicetak.
 *
 * `settings` = businessSettings dari /business-settings/.
 */
export const NAMA_BAWAAN = 'StarPhoto & Advertising';
const JUDUL_BAWAAN = 'RESI PEMBELIAN';

const teks = (nilai) => (typeof nilai === 'string' ? nilai.trim() : '');

export function cetakConfig(settings) {
  const ext = settings?.pos_ext_settings || {};
  return {
    nama: teks(settings?.nama_bisnis) || NAMA_BAWAAN,
    alamat: teks(settings?.alamat),
    telepon: teks(settings?.no_telepon),
    // Kunci belum pernah disimpan -> tagline bawaan; sudah disimpan kosong -> tanpa tagline.
    tagline: settings?.tagline === undefined ? 'Solusi Cetak & Promosi Terpercaya' : teks(settings.tagline),
    infoPembayaran: teks(settings?.info_pembayaran) || teks(settings?.deskripsi),
    syarat: teks(settings?.invoice_terms),
    logoUrl: getLogoUrl(settings?.logo_url),
    judul: teks(settings?.pos_resi_judul) || JUDUL_BAWAAN,
    catatan: teks(settings?.pos_resi_catatan),
    sembunyikanNomor: !!settings?.pos_resi_sembunyikan_no_pesanan,
    ext,
    a4: !!ext.pos_custom_resi_windows,
    hematKertas: !!ext.enable_paper_saving,
    gabungQty: !!ext.merge_qty_item_resi,
    catatanItem: !!ext.print_note_item_resi,
    totalQty: !!ext.print_total_qty_resi,
  };
}

/** Item yang akan dicetak: item sama digabung bila "Gabungkan Qty item di resi" aktif. */
export function itemUntukCetak(items, cfg) {
  const daftar = Array.isArray(items) ? items : [];
  if (!cfg?.gabungQty) return daftar;
  const gabung = new Map();
  daftar.forEach((item) => {
    const kunci = `${item.product ?? item.nama_snapshot}|${item.variant ?? ''}|${item.harga_snapshot ?? ''}|${item.uom_kode ?? ''}`;
    const ada = gabung.get(kunci);
    if (ada) {
      ada.qty = Number(ada.qty || 0) + Number(item.qty || 0);
      ada.subtotal = Number(ada.subtotal || 0) + Number(item.subtotal || 0);
      ada.addons = [...(ada.addons || []), ...(item.addons || [])];
    } else {
      gabung.set(kunci, { ...item, addons: [...(item.addons || [])] });
    }
  });
  return [...gabung.values()];
}

export function totalQtyItem(items) {
  return (items || []).reduce((jumlah, item) => jumlah + Number(item.qty || 0), 0);
}

/** Judul dokumen: judul pengaturan, atau judul khusus dokumen (mis. "Draf/Pengecekan"). */
export function judulDokumen(receipt, cfg) {
  return receipt?.documentTitle || cfg.judul;
}
