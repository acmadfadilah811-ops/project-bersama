import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';

// Laporan Kerja kategori SPV & Kordiv (2026-10-19): ringkasan divisi tiap pimpinan
// (/laporan-produksi/ringkasan-pimpinan/) + laporan target & kendala yang mereka
// tulis (/laporan-produksi/target/). Keduanya read-only di sini.

function rentang(periode) {
  const sekarang = new Date();
  const iso = (d) => d.toLocaleDateString('sv-SE');
  if (periode === 'hari_ini') return [iso(sekarang), iso(sekarang)];
  if (periode === 'tujuh_hari') {
    const mulai = new Date(sekarang);
    mulai.setDate(sekarang.getDate() - 6);
    return [iso(mulai), iso(sekarang)];
  }
  if (periode === 'bulan_lalu') {
    return [
      iso(new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, 1)),
      iso(new Date(sekarang.getFullYear(), sekarang.getMonth(), 0)),
    ];
  }
  return [
    iso(new Date(sekarang.getFullYear(), sekarang.getMonth(), 1)),
    iso(new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0)),
  ];
}

export default function useLaporanPimpinan() {
  const [kategori, setKategori] = useState('semua');
  const [periode, setPeriode] = useState('hari_ini');
  const [pimpinan, setPimpinan] = useState([]);
  const [laporan, setLaporan] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    const [dari, sampai] = rentang(periode);
    setMemuat(true);
    setGalat('');
    Promise.all([
      apiClient.get('/laporan-produksi/ringkasan-pimpinan/', {
        params: { kategori, tanggal_dari: dari, tanggal_sampai: sampai },
      }),
      apiClient.get('/laporan-produksi/target/', {
        params: { kategori, tanggal_dari: dari, tanggal_sampai: sampai },
      }),
    ])
      .then(([resRingkasan, resLaporan]) => {
        setPimpinan(resRingkasan.data.pimpinan || []);
        const data = resLaporan.data;
        setLaporan(Array.isArray(data) ? data : data?.results || []);
      })
      .catch(() => setGalat('Gagal memuat laporan SPV & Kordiv. Coba muat ulang halaman.'))
      .finally(() => setMemuat(false));
  }, [kategori, periode]);

  useEffect(() => { muat(); }, [muat]);

  return { kategori, setKategori, periode, setPeriode, pimpinan, laporan, memuat, galat, muat };
}
