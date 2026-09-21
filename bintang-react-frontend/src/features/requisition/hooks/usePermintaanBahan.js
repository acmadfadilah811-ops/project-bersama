import { useCallback, useEffect, useMemo, useState } from 'react';
import { notify, notifyApiError, notifySuccess } from '../../../utils/notify';
import { buatPermintaan, jalankanAksi, listPermintaan } from '../services/requisitionApi';

const AKSI_TINDAKAN = ['setujui', 'tolak', 'siapkan', 'terima'];
const STATUS_AKTIF = ['diajukan', 'disetujui', 'disiapkan'];

export const TAB = {
  perlu: { label: 'Perlu Tindakan', cocok: (p) => p.aksi.some((a) => AKSI_TINDAKAN.includes(a)) },
  aktif: { label: 'Aktif', cocok: (p) => STATUS_AKTIF.includes(p.status) },
  riwayat: { label: 'Riwayat', cocok: (p) => !STATUS_AKTIF.includes(p.status) },
};

const PESAN_BERHASIL = {
  setujui: 'Permintaan disetujui.',
  tolak: 'Permintaan ditolak.',
  siapkan: 'Bahan ditandai sudah disiapkan.',
  terima: 'Bahan ditandai sudah diterima.',
  batalkan: 'Permintaan dibatalkan.',
};

export function usePermintaanBahan() {
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [tab, setTab] = useState('perlu');
  const [sedangProses, setSedangProses] = useState(null);

  const muat = useCallback(async () => {
    try {
      setDaftar(await listPermintaan());
    } catch (error) {
      notifyApiError(error, 'Gagal memuat daftar permintaan bahan.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const tampil = useMemo(() => daftar.filter(TAB[tab].cocok), [daftar, tab]);
  const jumlahPerTab = useMemo(
    () => Object.fromEntries(Object.entries(TAB).map(([k, v]) => [k, daftar.filter(v.cocok).length])),
    [daftar],
  );

  const kirim = useCallback(async (payload) => {
    try {
      await buatPermintaan(payload);
      notifySuccess('Permintaan bahan', 'Permintaan terkirim ke atasan untuk disetujui.');
      await muat();
      return true;
    } catch (error) {
      notifyApiError(error, 'Gagal mengajukan permintaan bahan.');
      return false;
    }
  }, [muat]);

  const aksi = useCallback(async (id, nama, body) => {
    setSedangProses(id);
    try {
      const hasil = await jalankanAksi(id, nama, body);
      notifySuccess('Permintaan bahan', PESAN_BERHASIL[nama]);
      // Gudang: stok tercatat kurang dari yang disiapkan -> peringatan (tidak memblokir).
      (hasil.peringatan_stok || []).forEach((p) =>
        notify({
          type: 'warning',
          title: 'Stok tercatat kurang',
          message: `${p.nama}: disiapkan ${p.disiapkan} ${p.satuan}, stok tercatat ${p.stok_tercatat}.`,
        }),
      );
      await muat();
      return true;
    } catch (error) {
      notifyApiError(error, 'Aksi gagal diproses.');
      return false;
    } finally {
      setSedangProses(null);
    }
  }, [muat]);

  return { tampil, jumlahPerTab, tab, setTab, memuat, sedangProses, kirim, aksi, muat };
}
