// Wilayah Indonesia untuk form alamat (Provinsi -> Kota/Kabupaten -> Kecamatan), 2026-10-27.
// Daftar provinsi & kota: data/wilayahIndonesia.json (Kepmendagri 2025, 38 provinsi / 514 kab-kota).
// Kecamatan: data/wilayahKecamatan.json ({ "Kabupaten Cilacap": ["Adipala", ...] }; 514 kab/kota, 7.285
// kecamatan, sumber sama: github.com/cahyadsn/wilayah, MIT), dimuat malas supaya tidak membebani bundel awal. Kolom tetap teks bebas -- saran hanya mempersempit pilihan.
import WILAYAH from '../data/wilayahIndonesia.json';

export const PROVINSI = WILAYAH.map((w) => w.provinsi);
export const SEMUA_KOTA = WILAYAH.flatMap((w) => w.kota);

const kunci = (teks) => String(teks || '').trim().toLowerCase();

// Data lama (impor Olsera) memakai "Cilacap - Kabupaten"; daftar resmi "Kabupaten Cilacap".
export function normalisasiKota(kota) {
  const teks = String(kota || '').trim();
  const m = /^(.*?)\s*-\s*(Kabupaten|Kota)$/i.exec(teks);
  if (!m) return teks;
  const jenis = m[2].toLowerCase() === 'kota' ? 'Kota' : 'Kabupaten';
  return `${jenis} ${m[1].trim()}`;
}

export function cocokKota(kota) {
  const k = kunci(normalisasiKota(kota));
  return SEMUA_KOTA.find((nama) => kunci(nama) === k) || '';
}

export function kotaDiProvinsi(provinsi) {
  const cocok = WILAYAH.find((w) => kunci(w.provinsi) === kunci(provinsi));
  return cocok ? cocok.kota : SEMUA_KOTA;
}

export function provinsiDariKota(kota) {
  const resmi = cocokKota(kota);
  if (!resmi) return '';
  return WILAYAH.find((w) => w.kota.includes(resmi))?.provinsi || '';
}

let petaKecamatan = null;
export async function muatKecamatan() {
  if (petaKecamatan) return petaKecamatan;
  try {
    const modul = await import('../data/wilayahKecamatan.json');
    petaKecamatan = modul.default || {};
  } catch {
    petaKecamatan = {};
  }
  return petaKecamatan;
}

export function kecamatanDiKota(peta, kota) {
  const resmi = cocokKota(kota);
  return (resmi && peta?.[resmi]) || [];
}

// Provinsi diganti: bila provinsi itu resmi dan kota terisi tidak termasuk di dalamnya, kota & kecamatan
// dikosongkan. Selama masih mengetik (belum cocok persis) tidak ada yang dihapus.
export function ubahProvinsi(form, nilai) {
  const hasil = { ...form, provinsi: nilai };
  const dikenal = WILAYAH.some((w) => kunci(w.provinsi) === kunci(nilai));
  if (dikenal && hasil.kota) {
    const resmi = cocokKota(hasil.kota);
    if (!resmi || !kotaDiProvinsi(nilai).includes(resmi)) {
      hasil.kota = '';
      hasil.kecamatan = '';
    }
  }
  return hasil;
}

// Kota dipilih/diketik persis: provinsinya otomatis ikut, dan kecamatan yang bukan milik kota itu dikosongkan.
export function ubahKota(form, nilai, peta) {
  const hasil = { ...form, kota: nilai };
  const resmi = cocokKota(nilai);
  if (!resmi) return hasil; // masih mengetik atau alamat di luar daftar resmi
  hasil.kota = resmi;
  const provinsi = provinsiDariKota(resmi);
  if (provinsi) hasil.provinsi = provinsi;
  const kec = kecamatanDiKota(peta, resmi);
  if (hasil.kecamatan && kec.length > 0 && !kec.some((k) => kunci(k) === kunci(hasil.kecamatan))) {
    hasil.kecamatan = '';
  }
  return hasil;
}
