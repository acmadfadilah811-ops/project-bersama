import { useEffect, useRef } from 'react';
import apiClient from '../../../api/apiClient';
import { useDynamicIsland } from '../../../context/DynamicIslandContext';

// Notifikasi bersuara untuk fotografer/asisten StarFoto (2026-10-21): tiap 30 detik cek
// Antrean Sesi; bila ada sesi baru, putar "audio/order-baru.mp3", tampilkan pop-up, dan
// beri tahu halaman Sesi Foto supaya memuat ulang. Muatan pertama hanya jadi patokan
// (tidak berbunyi) supaya antrean lama tidak berbunyi setiap halaman dibuka.
const INTERVAL_MS = 30000;
const EVENT_ANTREAN_BARU = 'antrean-sesi-baru'; // didengar SesiFotoPage

function putarSuara() {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const dasar = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    new Audio(`${dasar}audio/order-baru.mp3`).play().catch(() => {});
  } catch {
    // suara bersifat tambahan; abaikan bila browser menolak
  }
}

export default function NotifAntreanSesi() {
  const { triggerNotification } = useDynamicIsland() || {};
  const sudahDilihat = useRef(null);

  useEffect(() => {
    let aktif = true;
    const cek = async () => {
      try {
        const res = await apiClient.get('/starfoto/antrean-sesi/');
        if (!aktif) return;
        const daftar = Array.isArray(res.data) ? res.data : [];
        const kunci = (r) => `${r.pesanan_id}-${r.peran}`;
        if (sudahDilihat.current) {
          const baru = daftar.filter((r) => !sudahDilihat.current.has(kunci(r)));
          if (baru.length) {
            putarSuara();
            if (triggerNotification) {
              triggerNotification({
                type: 'announcement',
                title: 'Ada order sesi foto baru',
                message: `${baru[0].pelanggan || 'Pelanggan'} · ${baru[0].paket || ''} — ambil di tab Antrean.`,
              });
            }
            window.dispatchEvent(new Event(EVENT_ANTREAN_BARU));
          }
        }
        sudahDilihat.current = new Set(daftar.map(kunci));
      } catch {
        // belum absen / tidak berhak: diam saja, coba lagi di putaran berikutnya
      }
    };
    cek();
    const t = setInterval(cek, INTERVAL_MS);
    return () => { aktif = false; clearInterval(t); };
  }, [triggerNotification]);

  return null;
}
