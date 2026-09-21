import { useCallback, useEffect, useState } from 'react';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import {
  ambilAkunGaji, ambilPemetaanGaji, ambilPratinjauGaji, ambilRiwayatGaji, bayarGaji,
  hapusPemetaanGaji, koreksiGaji, postingGaji, simpanPemetaanGaji,
} from '../services/payroll';

const bulanIni = () => new Date().toISOString().slice(0, 7);

export function usePostingGaji() {
  const [periode, setPeriode] = useState(bulanIni());
  const [pratinjau, setPratinjau] = useState(null);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [sedangProses, setSedangProses] = useState(false);
  const [riwayat, setRiwayat] = useState([]);
  const [pemetaan, setPemetaan] = useState([]);
  const [akun, setAkun] = useState([]);

  const [tahun, bulan] = periode.split('-').map(Number);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const [p, r, m] = await Promise.all([
        ambilPratinjauGaji(tahun, bulan).catch((e) => {
          // Kegagalan pratinjau (HR mati, akun belum lengkap) ditampilkan sebagai pesan, bukan toast.
          setPratinjau(null);
          setGalat(e.response?.data?.error || 'Gagal memuat pratinjau gaji.');
          return null;
        }),
        ambilRiwayatGaji(),
        ambilPemetaanGaji(),
      ]);
      if (p) setPratinjau(p);
      setRiwayat(r);
      setPemetaan(m);
    } catch (error) {
      notifyApiError(error, 'Gagal memuat data Posting Gaji.');
    } finally {
      setMemuat(false);
    }
  }, [tahun, bulan]);

  useEffect(() => {
    muat();
  }, [muat]);

  useEffect(() => {
    ambilAkunGaji().then(setAkun).catch((e) => notifyApiError(e, 'Gagal memuat daftar akun.'));
  }, []);

  const jalankan = useCallback(async (fn, pesan) => {
    setSedangProses(true);
    try {
      await fn();
      notifySuccess('Posting Gaji', pesan);
      await muat();
      return true;
    } catch (error) {
      notifyApiError(error, 'Aksi gagal diproses.');
      return false;
    } finally {
      setSedangProses(false);
    }
  }, [muat]);

  return {
    periode, setPeriode, pratinjau, galat, memuat, sedangProses, riwayat, pemetaan, akun, muat,
    posting: () => jalankan(() => postingGaji(tahun, bulan), 'Gaji berhasil diposting ke jurnal.'),
    koreksi: () => jalankan(() => koreksiGaji(tahun, bulan), 'Koreksi berhasil: jurnal lama dibalik, versi baru diposting.'),
    bayar: (akunKas, tanggal) => jalankan(() => bayarGaji(tahun, bulan, akunKas, tanggal || undefined), 'Pembayaran gaji dicatat.'),
    simpanPemetaan: (payload) => jalankan(() => simpanPemetaanGaji(payload), 'Pemetaan komponen disimpan.'),
    hapusPemetaan: (id) => jalankan(() => hapusPemetaanGaji(id), 'Pemetaan dihapus.'),
  };
}
