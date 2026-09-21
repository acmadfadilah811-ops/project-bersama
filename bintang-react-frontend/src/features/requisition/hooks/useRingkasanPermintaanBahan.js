import { useEffect, useRef, useState } from 'react';
import { notify } from '../../../utils/notify';
import { ambilRingkasan } from '../services/requisitionApi';

const POLL_INTERVAL_MS = 30000;
export const ROLE_PERMINTAAN_BAHAN = ['owner', 'manager', 'admin', 'spv', 'kordiv'];

/**
 * Angka permintaan bahan yang menuntut tindakan pengguna ini (badge menu) +
 * toast saat angkanya NAIK dibanding polling sebelumnya. Polling pertama hanya
 * baseline (tidak membanjiri toast saat halaman dibuka). Hanya aktif untuk role
 * yang berhak, supaya role lain tidak menembak endpoint yang menjawab 403.
 */
export function useRingkasanPermintaanBahan(role) {
  const [total, setTotal] = useState(0);
  const sebelumnya = useRef(null);
  const aktif = ROLE_PERMINTAAN_BAHAN.includes(role);

  useEffect(() => {
    if (!aktif) return undefined;
    let dibatalkan = false;

    const muat = async () => {
      try {
        const data = await ambilRingkasan();
        if (dibatalkan) return;
        if (sebelumnya.current !== null && data.total > sebelumnya.current) {
          notify({
            type: 'info',
            title: 'Permintaan bahan',
            message: `Ada ${data.total - sebelumnya.current} permintaan bahan baru yang menunggu tindakan Anda.`,
          });
        }
        sebelumnya.current = data.total;
        setTotal(data.total);
      } catch (error) {
        // Gangguan jaringan sesaat: coba lagi di polling berikutnya, baseline tidak direset.
        console.error('Gagal memuat ringkasan permintaan bahan:', error);
      }
    };

    muat();
    const interval = setInterval(muat, POLL_INTERVAL_MS);
    return () => {
      dibatalkan = true;
      clearInterval(interval);
    };
  }, [aktif]);

  return { total: aktif ? total : 0 };
}
