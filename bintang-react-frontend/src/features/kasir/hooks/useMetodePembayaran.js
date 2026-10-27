import { useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';

// Metode pembayaran kasir = master Finance (Pengaturan POS > Pembayaran, /pos-payment-methods/),
// bukan daftar tetap di kode: tambah/ubah/nonaktif oleh Finance langsung tampil di kasir
// (2026-10-27). `null` = belum dimuat, [] = gagal/kosong (pemanggil memakai daftar cadangan).
// Nama metode dikirim apa adanya ke server, yang mencocokkan metode & akun akuntansinya lewat nama.
export default function useMetodePembayaran(aktif = true) {
  const [metode, setMetode] = useState(null);

  useEffect(() => {
    if (!aktif) return undefined;
    let batal = false;
    (async () => {
      try {
        const res = await apiClient.get('/pos-payment-methods/', { params: { page_size: 200 } });
        const rows = Array.isArray(res.data) ? res.data : res.data?.results || [];
        const aktifSaja = rows
          .filter((m) => m.is_active && String(m.nama || '').trim())
          .sort((a, b) => (a.urutan - b.urutan) || (a.id - b.id));
        if (!batal) setMetode(aktifSaja);
      } catch {
        if (!batal) setMetode([]);
      }
    })();
    return () => { batal = true; };
  }, [aktif]);

  return metode;
}
