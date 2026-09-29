import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { notify } from '../../../utils/notify';
import {
  gabungPesananMasuk,
  gabungPesananSiap,
  pesanNotifikasi,
  temukanPesananBaru,
} from '../utils/pesananSiap';

const POLL_INTERVAL_MS = 20000;
const RIWAYAT_MAKS = 30;

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
 * Memantau dua peristiwa yang perlu diketahui kasir (diagram WORKFLOW SISTEM
 * ERP):
 *  - Pesanan SELESAI diproduksi (status_global 'ready' pada Order + transaksi
 *    POS ber-SPK yang semua job-nya selesai) -- "Proses selesai -> Kasir".
 *  - Pesanan BARU masuk antrean dari WA/staff/CRM (status_global 'review').
 *
 * Selain jumlah untuk badge, disusun `riwayatNotifikasi` (lonceng notifikasi
 * di KasirTopbar) supaya notifikasi tidak cuma lewat sebagai toast lalu
 * hilang -- kasir bisa membuka kembali daftar peristiwa terakhir. Dipasang
 * sekali di KasirProvider, jadi aktif di semua halaman kasir.
 */
export function useNotifikasiSiapDiambil() {
  const [jumlahSiap, setJumlahSiap] = useState(0);
  const [riwayatNotifikasi, setRiwayatNotifikasi] = useState([]);
  const [jumlahBelumDibaca, setJumlahBelumDibaca] = useState(0);
  const kunciSiapSebelumnya = useRef(null);
  const kunciMasukSebelumnya = useRef(null);
  const idUrutan = useRef(0);

  const tambahKeRiwayat = useCallback((entri) => {
    setRiwayatNotifikasi((prev) => [...entri, ...prev].slice(0, RIWAYAT_MAKS));
    setJumlahBelumDibaca((prev) => prev + entri.length);
  }, []);

  const muat = useCallback(async () => {
    try {
      const [resOrder, resPos, resMasuk] = await Promise.all([
        apiClient.get('/orders/', { params: { status_global: 'ready' } }),
        apiClient.get('/pos/sales/produksi/', { params: { status_produksi: 'ready' } }),
        apiClient.get('/orders/', { params: { status_global: 'review', sumber: 'wa,staff,crm' } }),
      ]);

      const daftarSiap = gabungPesananSiap(resOrder.data || [], resPos.data || []);
      const siapBaru = temukanPesananBaru(kunciSiapSebelumnya.current, daftarSiap);
      kunciSiapSebelumnya.current = new Set(daftarSiap.map((p) => p.kunci));
      setJumlahSiap(daftarSiap.length);

      const daftarMasuk = gabungPesananMasuk(resMasuk.data || []);
      const masukBaru = temukanPesananBaru(kunciMasukSebelumnya.current, daftarMasuk);
      kunciMasukSebelumnya.current = new Set(daftarMasuk.map((p) => p.kunci));

      if (siapBaru.length > 0) {
        notify({ type: 'success', title: 'Pesanan siap diambil', message: pesanNotifikasi(siapBaru) });
        tambahKeRiwayat(
          siapBaru.map((p) => ({
            id: `siap-${p.kunci}-${idUrutan.current++}`,
            jenis: 'siap',
            judul: 'Pesanan siap diambil',
            pesan: `${p.label} · ${p.nama} sudah selesai diproduksi.`,
            tautan: '/kasir/pesanan',
            waktu: Date.now(),
          }))
        );
        bunyiPendek();
      }

      if (masukBaru.length > 0) {
        tambahKeRiwayat(
          masukBaru.map((p) => ({
            id: `masuk-${p.kunci}-${idUrutan.current++}`,
            jenis: 'masuk',
            judul: 'Pesanan baru masuk',
            pesan: `${p.label} · ${p.nama} masuk ke antrean.`,
            tautan: '/kasir/antrean-wa',
            waktu: Date.now(),
          }))
        );
      }
    } catch (error) {
      // Jaringan putus sesaat tidak boleh mengganggu kasir; coba lagi di
      // polling berikutnya. Baseline sengaja TIDAK direset.
      console.error('Gagal memuat notifikasi kasir:', error);
    }
  }, [tambahKeRiwayat]);

  useEffect(() => {
    muat();
    const interval = setInterval(muat, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [muat]);

  const tandaSemuaDibaca = useCallback(() => setJumlahBelumDibaca(0), []);

  return {
    jumlahSiap,
    muatUlangSiapDiambil: muat,
    riwayatNotifikasi,
    jumlahBelumDibaca,
    tandaSemuaDibaca,
  };
}
