import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { notify } from '../../../utils/notify';
import { gabungPesananSiap, pesanNotifikasi, temukanPesananBaru } from '../utils/pesananSiap';

const POLL_INTERVAL_MS = 20000;

// Bunyi pendek supaya kasir yang sedang melayani pelanggan (mata ke layar
// lain) tetap sadar. Browser bisa memblokir audio sebelum ada interaksi
// pengguna -- itu bukan error, toast tetap tampil.
function bunyiPendek() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch {
    // audio tidak tersedia -- abaikan, toast tetap jalan
  }
}

/**
 * Memantau pesanan yang selesai diproduksi (status_global 'ready' pada Order
 * + transaksi POS ber-SPK yang semua job-nya selesai) -- alur "Proses selesai
 * -> Kasir" di diagram WORKFLOW SISTEM ERP.
 *
 * Mengembalikan jumlah pesanan siap (untuk badge menu) dan memunculkan
 * notifikasi saat ada pesanan yang BARU siap. Dipasang sekali di
 * KasirProvider, jadi aktif di semua halaman kasir.
 */
export function useNotifikasiSiapDiambil() {
  const [jumlahSiap, setJumlahSiap] = useState(0);
  const kunciSebelumnya = useRef(null);

  const muat = useCallback(async () => {
    try {
      const [resOrder, resPos] = await Promise.all([
        apiClient.get('/orders/', { params: { status_global: 'ready' } }),
        apiClient.get('/pos/sales/produksi/', { params: { status_produksi: 'ready' } }),
      ]);
      const daftar = gabungPesananSiap(resOrder.data || [], resPos.data || []);
      const baru = temukanPesananBaru(kunciSebelumnya.current, daftar);
      kunciSebelumnya.current = new Set(daftar.map((p) => p.kunci));
      setJumlahSiap(daftar.length);
      if (baru.length > 0) {
        notify({ type: 'success', title: 'Pesanan siap diambil', message: pesanNotifikasi(baru) });
        bunyiPendek();
      }
    } catch (error) {
      // Jaringan putus sesaat tidak boleh mengganggu kasir; coba lagi di
      // polling berikutnya. Baseline sengaja TIDAK direset.
      console.error('Gagal memuat pesanan siap diambil:', error);
    }
  }, []);

  useEffect(() => {
    muat();
    const interval = setInterval(muat, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [muat]);

  return { jumlahSiap, muatUlangSiapDiambil: muat };
}
