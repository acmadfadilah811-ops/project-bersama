import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { notify } from '../../../utils/notify';
import { useAuth } from '../../../context/AuthContext';
import { isKasirStarfoto, paramUnitKasirStarfoto } from '../../../utils/unitBisnis';
import {
  gabungPesananMasuk,
  gabungPesananSiap,
  pesanNotifikasi,
  temukanPesananBaru,
} from '../utils/pesananSiap';

const POLL_INTERVAL_MS = 20000;
const RIWAYAT_MAKS = 30;
// Pesanan yang sudah dilihat kasir di lonceng (tanda "Baru" hilang). Disimpan
// di browser supaya tidak muncul "Baru" lagi setelah halaman dimuat ulang.
const KUNCI_DIBACA = 'kasir_notif_dibaca';

function bacaDibaca() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KUNCI_DIBACA) || '[]'));
  } catch {
    return new Set();
  }
}

function simpanDibaca(set) {
  try {
    localStorage.setItem(KUNCI_DIBACA, JSON.stringify([...set]));
  } catch {
    // storage tidak tersedia -- tanda "Baru" hanya bertahan selama sesi
  }
}

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
  const { user } = useAuth();
  // Kasir StarFoto belum memakai antrean WA (order WA lewat Terminal): hitung order staff/CRM saja.
  const sumberMasuk = isKasirStarfoto(user) ? 'staff,crm' : 'wa,staff,crm';
  // Kasir StarFoto: hitung pesanan StarFoto saja (selaras dengan Pesanan & Pelunasan).
  const unitKasir = paramUnitKasirStarfoto(user).unit_bisnis;
  const [jumlahSiap, setJumlahSiap] = useState(0);
  // Daftar pesanan yang menunggu tindakan kasir -- isi badge merah di sidebar
  // (Antrean Online & Offline, Pesanan & Pelunasan) dan daftar di lonceng.
  const [daftarMasuk, setDaftarMasuk] = useState([]);
  const [daftarSiap, setDaftarSiap] = useState([]);
  // Pesanan foto StarFoto yang sesinya selesai & menunggu konfirmasi kasir (2026-10-11).
  const [daftarSesiFoto, setDaftarSesiFoto] = useState([]);
  const [kunciDibaca, setKunciDibaca] = useState(bacaDibaca);
  const [riwayatNotifikasi, setRiwayatNotifikasi] = useState([]);
  const [jumlahBelumDibaca, setJumlahBelumDibaca] = useState(0);
  const kunciSiapSebelumnya = useRef(null);
  const kunciMasukSebelumnya = useRef(null);
  const kunciSesiSebelumnya = useRef(null);
  const idUrutan = useRef(0);

  const tambahKeRiwayat = useCallback((entri) => {
    setRiwayatNotifikasi((prev) => [...entri, ...prev].slice(0, RIWAYAT_MAKS));
    setJumlahBelumDibaca((prev) => prev + entri.length);
  }, []);

  const muat = useCallback(async () => {
    try {
      const [resOrder, resPos, resMasuk, resSesi, resApproval] = await Promise.all([
        apiClient.get('/orders/', { params: { status_global: 'ready', ...(unitKasir ? { unit_bisnis: unitKasir } : {}) } }),
        apiClient.get('/pos/sales/produksi/', { params: { status_produksi: 'ready', ...(unitKasir ? { unit_bisnis: unitKasir } : {}) } }),
        apiClient.get('/orders/', { params: { status_global: 'review', sumber: sumberMasuk, ...(unitKasir ? { unit_bisnis: unitKasir } : {}) } }),
        apiClient.get('/starfoto/pesanan/', { params: { status: 'menunggu_kasir' } }).catch(() => ({ data: [] })),
        apiClient.get('/starfoto/approval-tertunda/').catch(() => ({ data: [] })),
      ]);

      const daftarSesi = [
        ...(Array.isArray(resSesi.data) ? resSesi.data : resSesi.data?.results || []).map((p) => ({
          kunci: `sesi:${p.id}`,
          label: p.order,
          nama: p.pelanggan || 'Pelanggan',
          waktu: p.dibuat_pada,
          tautan: '/kasir/sesi-foto',
          keterangan: (p.usulan || []).some((u) => u.status === 'usulan')
            ? `${(p.usulan || []).filter((u) => u.status === 'usulan').length} usulan tambahan` : 'Pilih file & konfirmasi',
        })),
        // Approval hasil edit belum direspons pelanggan (Pengaturan StarFoto: jam pengingat).
        ...(Array.isArray(resApproval.data) ? resApproval.data : []).map((p) => ({
          kunci: `approval:${p.id}:${p.approval_putaran}`,
          label: p.order,
          nama: p.pelanggan || 'Pelanggan',
          waktu: p.approval_dikirim_pada,
          tautan: '/kasir/sesi-foto',
          keterangan: 'Approval edit belum direspons — follow up',
        })),
      ];
      const sesiBaru = temukanPesananBaru(kunciSesiSebelumnya.current, daftarSesi);
      kunciSesiSebelumnya.current = new Set(daftarSesi.map((p) => p.kunci));
      setDaftarSesiFoto(daftarSesi);
      if (sesiBaru.length > 0) {
        notify({ type: 'info', title: 'Pesanan foto perlu tindakan', message: `${sesiBaru.length} pesanan foto menunggu konfirmasi atau follow up approval.` });
        tambahKeRiwayat(sesiBaru.map((p) => ({
          id: `sesi-${p.kunci}-${idUrutan.current++}`,
          jenis: 'masuk',
          judul: 'Pesanan foto perlu tindakan',
          pesan: `${p.label} · ${p.nama}: ${p.keterangan}.`,
          tautan: p.tautan,
          waktu: Date.now(),
        })));
        bunyiPendek();
      }

      const daftarSiap = gabungPesananSiap(resOrder.data || [], resPos.data || []);
      const siapBaru = temukanPesananBaru(kunciSiapSebelumnya.current, daftarSiap);
      kunciSiapSebelumnya.current = new Set(daftarSiap.map((p) => p.kunci));
      setJumlahSiap(daftarSiap.length);
      setDaftarSiap(daftarSiap);

      const daftarMasuk = gabungPesananMasuk(resMasuk.data || []);
      const masukBaru = temukanPesananBaru(kunciMasukSebelumnya.current, daftarMasuk);
      kunciMasukSebelumnya.current = new Set(daftarMasuk.map((p) => p.kunci));
      setDaftarMasuk(daftarMasuk);

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
  }, [tambahKeRiwayat, sumberMasuk, unitKasir]);

  useEffect(() => {
    muat();
    const interval = setInterval(muat, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [muat]);

  // Buka lonceng = semua pesanan yang sedang tampil dianggap sudah dilihat.
  // Hanya kunci yang masih menunggu yang disimpan, supaya storage tidak membengkak.
  const tandaSemuaDibaca = useCallback(() => {
    setJumlahBelumDibaca(0);
    setKunciDibaca(() => {
      const baru = new Set([...daftarMasuk, ...daftarSiap, ...daftarSesiFoto].map((p) => p.kunci));
      simpanDibaca(baru);
      return baru;
    });
  }, [daftarMasuk, daftarSiap, daftarSesiFoto]);

  const jumlahBaru = [...daftarMasuk, ...daftarSiap, ...daftarSesiFoto].filter((p) => !kunciDibaca.has(p.kunci)).length;

  return {
    jumlahSiap,
    jumlahMasuk: daftarMasuk.length,
    daftarMasuk,
    daftarSiap,
    daftarSesiFoto,
    kunciDibaca,
    jumlahBaru,
    muatUlangSiapDiambil: muat,
    riwayatNotifikasi,
    jumlahBelumDibaca,
    tandaSemuaDibaca,
  };
}
