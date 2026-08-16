import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  Wallet,
  X as XIcon,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import PelunasanModal from './PelunasanModal';
import InvoiceModal from './InvoiceModal';

/**
 * Papan pesanan produksi untuk meja kasir.
 *
 * Dua kelompok:
 *   - SIAP DIAMBIL  : status_global 'ready' — seluruh item selesai diproduksi,
 *                     backend menandainya otomatis di api/views/jobs.py.
 *   - MASIH PROSES  : status_global 'desain'/'proses', dengan progres tiap item
 *                     per divisi.
 *
 * Dua mode tampilan. `ringkas` dipakai di dashboard: hanya angka dan tautan,
 * karena rincian per divisi terlalu panjang untuk ditumpuk di layar depan.
 * Mode penuh dipakai halaman Pesanan tersendiri, dan di sana pun rincian per
 * divisi baru terbuka saat barisnya diklik.
 *
 * Progres per divisi dibaca dari items[].jobs[] yang sudah disertakan
 * OrderSerializer (lihat prefetch di OrderViewSet.get_queryset) — tidak ada
 * permintaan tambahan per item.
 */

const POLL_INTERVAL_MS = 30000;

// Job dianggap tuntas hanya pada 'selesai'. 'gagal'/'batal' sengaja dibedakan
// agar tidak tampil sebagai centang hijau yang menyesatkan di meja kasir.
const statusIkon = {
  selesai: { simbol: '✓', warna: 'text-emerald-600', label: 'selesai' },
  dikerjakan: { simbol: '⏳', warna: 'text-blue-600', label: 'dikerjakan' },
  antrean: { simbol: '•', warna: 'text-slate-400', label: 'antrean' },
  kendala: { simbol: '!', warna: 'text-amber-600', label: 'kendala' },
  gagal: { simbol: '×', warna: 'text-rose-600', label: 'gagal' },
  batal: { simbol: '×', warna: 'text-slate-400', label: 'batal' },
};

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(v || 0);

const formatJam = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

/** Waktu selesai produksi = job terakhir yang rampung di seluruh order. */
const waktuSelesaiProduksi = (order) => {
  const waktu = (order.items || [])
    .flatMap((it) => it.jobs || [])
    .map((j) => j.waktu_selesai)
    .filter(Boolean)
    .sort();
  return waktu.length ? waktu[waktu.length - 1] : null;
};

/** Ringkasan "3/5 item selesai" untuk baris yang belum dibuka. */
const ringkasProgres = (order) => {
  const items = order.items || [];
  const tuntas = items.filter((it) => {
    const jobs = it.jobs || [];
    return jobs.length > 0 && jobs.every((j) => j.status_pekerjaan === 'selesai');
  }).length;
  return { tuntas, total: items.length };
};

function ProgresItem({ item }) {
  const jobs = item.jobs || [];

  if (!jobs.length) {
    return (
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className="font-bold text-slate-700 min-w-[120px] truncate">{item.jenis_produk}</span>
        <span className="text-slate-400 font-semibold italic">SPK belum diterbitkan</span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2 text-[11px] flex-wrap">
      <span className="font-bold text-slate-700 min-w-[120px] truncate">{item.jenis_produk}</span>
      {jobs.map((job) => {
        const ikon = statusIkon[job.status_pekerjaan] || statusIkon.antrean;
        const divisi = job.tahap_divisi_nama || job.pic_divisi_nama || job.tahap_nama || 'Divisi';
        return (
          <span
            key={job.id}
            className={`font-semibold ${ikon.warna}`}
            title={`${divisi}: ${ikon.label}`}
          >
            {divisi} {ikon.simbol}
          </span>
        );
      })}
    </div>
  );
}

export default function SiapDiambilPanel({ ringkas = false }) {
  const navigate = useNavigate();

  const [siap, setSiap] = useState([]);
  const [proses, setProses] = useState([]);
  const [selesaiBelumLunas, setSelesaiBelumLunas] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [error, setError] = useState('');
  const [orderDibayar, setOrderDibayar] = useState(null);
  const [orderFaktur, setOrderFaktur] = useState(null);
  const [orderAkanDiselesaikan, setOrderAkanDiselesaikan] = useState(null);
  const [menyelesaikan, setMenyelesaikan] = useState(false);
  const [terbuka, setTerbuka] = useState({});
  const [pencarian, setPencarian] = useState('');
  const [waSendingId, setWaSendingId] = useState(null);
  const [waMessage, setWaMessage] = useState('');

  // Transaksi POS Lunas + SPK dinormalkan ke bentuk yang sama dengan Order
  // supaya helper (ringkasProgres, ProgresItem, pencarian) tidak perlu
  // bercabang per sumber. `_origin`/`_displayId` dipakai tempat yang benar-
  // benar butuh tahu asalnya (aksi Sudah Diambil, tombol Faktur/Lunasi yang
  // memang cuma berlaku utk Order). Sebelum ini transaksi POS Lunas+SPK
  // sama sekali tidak muncul di panel ini (bug ditemukan 2026-08-13).
  const normalisasiPosSale = (sale) => ({
    id: sale.id,
    _origin: 'pos',
    _displayId: sale.nomor,
    nama: sale.pelanggan_name || 'Pelanggan Umum',
    nomor_wa: sale.pelanggan?.nomor_wa || '',
    sisa_tagihan: 0,
    items: (sale.items || []).map((it) => ({ id: it.id, jenis_produk: it.nama_snapshot, jobs: it.jobs || [] })),
  });

  const muat = useCallback(async (tampilkanSpinner = false) => {
    if (tampilkanSpinner) setMemuat(true);
    try {
      const [resReady, resDesain, resProses, resSelesai, resPosReady, resPosProses] = await Promise.all([
        apiClient.get('/orders/', { params: { status_global: 'ready' } }),
        apiClient.get('/orders/', { params: { status_global: 'desain' } }),
        apiClient.get('/orders/', { params: { status_global: 'proses' } }),
        apiClient.get('/orders/', { params: { status_global: 'selesai' } }),
        apiClient.get('/pos/sales/produksi/', { params: { status_produksi: 'ready' } }),
        apiClient.get('/pos/sales/produksi/', { params: { status_produksi: 'proses' } }),
      ]);
      setSiap([...(resReady.data || []), ...(resPosReady.data || []).map(normalisasiPosSale)]);
      setProses([
        ...(resDesain.data || []),
        ...(resProses.data || []),
        ...(resPosProses.data || []).map(normalisasiPosSale),
      ]);
      // Pesanan yang sudah ditandai "Sudah Diambil" tapi sisa tagihannya belum
      // lunas — sebelumnya hilang total dari panel ini begitu status jadi
      // 'selesai' (query lama cuma ready/desain/proses), padahal dialog
      // konfirmasi "Sudah Diambil" sendiri menjanjikan "Pelunasan tetap dapat
      // dicatat setelah pesanan selesai". Sekarang benar-benar bisa dicatat
      // dari sini, bukan cuma janji di teks.
      setSelesaiBelumLunas((resSelesai.data || []).filter((o) => Number(o.sisa_tagihan || 0) > 0));
      setError('');
    } catch (err) {
      console.error('Gagal memuat pesanan produksi:', err);
      setError('Daftar pesanan gagal dimuat. Periksa koneksi lalu muat ulang.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muat(true);
    const id = setInterval(() => muat(false), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [muat]);

  const query = pencarian.trim().toLowerCase();
  const cocokPencarian = useCallback((order) => {
    if (!query) return true;
    return (
      String(order.id).toLowerCase().includes(query) ||
      String(order._displayId || '').toLowerCase().includes(query) ||
      (order.nama || '').toLowerCase().includes(query) ||
      (order.nomor_wa || '').toLowerCase().includes(query)
    );
  }, [query]);

  const siapTersaring = useMemo(() => siap.filter(cocokPencarian), [siap, cocokPencarian]);
  const prosesTersaring = useMemo(() => proses.filter(cocokPencarian), [proses, cocokPencarian]);
  const belumLunasTersaring = useMemo(
    () => selesaiBelumLunas.filter(cocokPencarian),
    [selesaiBelumLunas, cocokPencarian]
  );

  const totalTagihanSiap = useMemo(
    () => siapTersaring.reduce((sum, o) => sum + Number(o.sisa_tagihan || 0), 0),
    [siapTersaring]
  );

  const toggle = (id) => setTerbuka((prev) => ({ ...prev, [id]: !prev[id] }));

  const setelahBayar = () => {
    // Biarkan modal menunjukkan hasil pembayaran/cetak faktur. Menutupnya
    // langsung setelah POST membuat kasir tidak sempat melihat konfirmasi.
    muat(false);
  };

  const selesaikanPesananDiambil = async () => {
    if (!orderAkanDiselesaikan || menyelesaikan) return;
    setMenyelesaikan(true);
    try {
      const endpoint = orderAkanDiselesaikan._origin === 'pos'
        ? `/pos/sales/${orderAkanDiselesaikan.id}/selesaikan/`
        : `/orders/${orderAkanDiselesaikan.id}/selesaikan/`;
      await apiClient.post(endpoint);
      setOrderAkanDiselesaikan(null);
      await muat(false);
    } catch (err) {
      console.error('Gagal menyelesaikan pesanan yang sudah diambil:', err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          'Pesanan gagal ditandai selesai. Silakan coba kembali.'
      );
    } finally {
      setMenyelesaikan(false);
    }
  };

  // Transaksi POS tidak punya InvoiceModal (bentuk faktur khusus Order) —
  // resi PDF-nya dikirim langsung lewat endpoint yang sudah ada
  // (`/pos/sales/{id}/whatsapp-resi/`), lengkap dengan keterangan "siap
  // diambil" otomatis kalau SPK-nya sudah tuntas (instruksi user 2026-08-13:
  // "fakturnya untuk kirim pesan lewat wa blm ada di pesanan dan pelunasan").
  const kirimResiWa = async (order) => {
    if (waSendingId) return;
    setWaSendingId(order.id);
    setWaMessage('');
    try {
      await apiClient.post(`/pos/sales/${order.id}/whatsapp-resi/`);
      setWaMessage(`Resi WA terkirim untuk ${order._displayId || order.id}.`);
    } catch (err) {
      console.error('Gagal mengirim resi WA:', err);
      setWaMessage(
        err.response?.data?.error || err.response?.data?.detail || 'Gagal mengirim resi WA. Coba lagi.'
      );
    } finally {
      setWaSendingId(null);
    }
  };

  /* ---------- Mode ringkas: kartu kecil untuk dashboard ---------- */
  if (ringkas) {
    return (
      <button
        type="button"
        onClick={() => navigate('/kasir/pesanan')}
        className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left transition-all hover:shadow-lg hover:border-emerald-300 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Pesanan Produksi
          </span>
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <PackageCheck size={16} />
          </span>
        </div>

        {memuat ? (
          <Loader2 size={18} className="animate-spin text-slate-300" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 leading-none">{siap.length}</span>
              <span className="text-[11px] font-bold text-slate-500">siap diambil</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 mt-1.5">
              {proses.length} pesanan masih diproses
              {totalTagihanSiap > 0 && ` · tagihan ${formatCurrency(totalTagihanSiap)}`}
            </p>
          </>
        )}

        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mt-3 group-hover:text-emerald-600">
          Buka daftar <ArrowRight size={12} />
        </span>
      </button>
    );
  }

  /* ---------- Mode penuh: halaman Pesanan ---------- */
  return (
    <>
      {orderDibayar && (
        <PelunasanModal
          order={orderDibayar}
          onClose={() => setOrderDibayar(null)}
          onSelesai={setelahBayar}
        />
      )}
      {orderFaktur && <InvoiceModal order={orderFaktur} onClose={() => setOrderFaktur(null)} />}
      {orderAkanDiselesaikan && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5 print:hidden">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => !menyelesaikan && setOrderAkanDiselesaikan(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800">Konfirmasi Pesanan Sudah Diambil</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                {orderAkanDiselesaikan._displayId || orderAkanDiselesaikan.id} &middot; {orderAkanDiselesaikan.nama}
              </p>
            </div>
            <div className="p-5 text-xs text-slate-600 space-y-2">
              <p>
                {orderAkanDiselesaikan._origin === 'pos'
                  ? 'Setelah dikonfirmasi, transaksi POS ini ditandai sudah diambil pelanggan.'
                  : 'Setelah dikonfirmasi, pesanan dipindahkan ke Penjualan → Selesai.'}
              </p>
              {Number(orderAkanDiselesaikan.sisa_tagihan || 0) > 0 && (
                <p className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-amber-800 font-semibold">
                  Masih ada sisa tagihan {formatCurrency(orderAkanDiselesaikan.sisa_tagihan)}. Pelunasan tetap dapat dicatat setelah pesanan selesai.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                disabled={menyelesaikan}
                onClick={() => setOrderAkanDiselesaikan(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={menyelesaikan}
                onClick={selesaikanPesananDiambil}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                {menyelesaikan && <Loader2 size={14} className="animate-spin" />}
                Ya, Sudah Diambil
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <PackageCheck size={16} className="text-emerald-600" />
            <h2 className="text-sm font-extrabold text-slate-800">Pesanan Produksi</h2>
          </div>
          <button
            type="button"
            onClick={() => muat(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Muat ulang"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={pencarian}
              onChange={(e) => setPencarian(e.target.value)}
              placeholder="Cari pesanan: nomor, nama, atau nomor WhatsApp"
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {pencarian && (
              <button
                type="button"
                onClick={() => setPencarian('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Bersihkan pencarian"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-semibold">
            {error}
          </div>
        )}

        {waMessage && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-blue-50 text-blue-700 text-[11px] font-semibold flex items-center justify-between gap-2">
            <span>{waMessage}</span>
            <button
              type="button"
              onClick={() => setWaMessage('')}
              className="text-blue-400 hover:text-blue-600 cursor-pointer shrink-0"
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        {memuat ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Siap diambil */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Siap Diambil ({siapTersaring.length})
                </h3>
                {totalTagihanSiap > 0 && (
                  <span className="text-[11px] font-bold text-slate-500">
                    Total tagihan {formatCurrency(totalTagihanSiap)}
                  </span>
                )}
              </div>

              {siapTersaring.length === 0 ? (
                <p className="text-[11px] font-semibold text-slate-400 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {query ? 'Tidak ada pesanan siap diambil yang cocok dengan pencarian.' : 'Belum ada pesanan yang selesai produksi.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {siapTersaring.map((order) => {
                    const sisa = Number(order.sisa_tagihan || 0);
                    const jam = formatJam(waktuSelesaiProduksi(order));
                    return (
                      <div
                        key={`${order._origin || 'order'}-${order.id}`}
                        className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">{order._displayId || order.id}</span>
                            {order._origin === 'pos' && (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">POS</span>
                            )}
                            {jam && (
                              <span className="text-[10px] font-bold text-slate-400">selesai {jam}</span>
                            )}
                          </div>
                          <p className="text-[11px] font-semibold text-slate-600 truncate">
                            {order.nama} &middot; {(order.items || []).length} item
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right mr-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {sisa > 0 ? 'Sisa' : 'Status'}
                            </p>
                            <p
                              className={`text-xs font-black ${sisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                            >
                              {sisa > 0 ? formatCurrency(sisa) : 'LUNAS'}
                            </p>
                          </div>

                          {order._origin === 'pos' ? (
                            <button
                              type="button"
                              disabled={waSendingId === order.id}
                              onClick={() => kirimResiWa(order)}
                              className="px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              title="Kirim resi transaksi ke WhatsApp pelanggan"
                            >
                              {waSendingId === order.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Send size={12} />
                              )}{' '}
                              Resi WA
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOrderFaktur(order)}
                              className="px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              title="Lihat & cetak faktur"
                            >
                              <FileText size={12} /> Faktur
                            </button>
                          )}

                          {sisa > 0 && (
                            <button
                              type="button"
                              onClick={() => setOrderDibayar(order)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            >
                              <Wallet size={12} /> Lunasi
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setOrderAkanDiselesaikan(order)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Konfirmasi pesanan sudah diambil pelanggan"
                          >
                            <CheckCircle2 size={12} /> Sudah Diambil
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sudah diambil pelanggan tapi belum lunas — tidak lagi hilang
                begitu saja begitu status berubah jadi 'selesai'. */}
            {belumLunasTersaring.length > 0 && (
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-2">
                  <Wallet size={13} /> Selesai — Belum Lunas ({belumLunasTersaring.length})
                </h3>
                <div className="space-y-2">
                  {belumLunasTersaring.map((order) => (
                    <div
                      key={order.id}
                      className="border border-rose-200 bg-rose-50/40 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-800">{order.id}</span>
                        <p className="text-[11px] font-semibold text-slate-600 truncate">
                          {order.nama} &middot; {(order.items || []).length} item
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right mr-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sisa</p>
                          <p className="text-xs font-black text-rose-600">
                            {formatCurrency(order.sisa_tagihan)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOrderFaktur(order)}
                          className="px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                          title="Lihat & cetak faktur"
                        >
                          <FileText size={12} /> Faktur
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderDibayar(order)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        >
                          <Wallet size={12} /> Lunasi
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Masih diproses — rincian per divisi baru terbuka saat diklik */}
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                <Clock size={13} /> Masih Proses ({prosesTersaring.length})
              </h3>

              {prosesTersaring.length === 0 ? (
                <p className="text-[11px] font-semibold text-slate-400 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {query ? 'Tidak ada pesanan dalam proses yang cocok dengan pencarian.' : 'Tidak ada pesanan yang sedang dikerjakan.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {prosesTersaring.map((order) => {
                    const { tuntas, total } = ringkasProgres(order);
                    const rowKey = `${order._origin || 'order'}-${order.id}`;
                    const isTerbuka = !!terbuka[rowKey];
                    return (
                      <div key={rowKey} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggle(rowKey)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isTerbuka ? (
                              <ChevronDown size={14} className="text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-slate-400 shrink-0" />
                            )}
                            <span className="text-xs font-black text-slate-800">{order._displayId || order.id}</span>
                            {order._origin === 'pos' && (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">POS</span>
                            )}
                            <span className="text-[11px] font-semibold text-slate-500 truncate">
                              {order.nama}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 shrink-0">
                            {tuntas}/{total} item selesai
                          </span>
                        </button>

                        {isTerbuka && (
                          <div className="px-3 pb-3 pt-1 space-y-1 border-t border-slate-100 bg-slate-50/50">
                            {(order.items || []).map((item) => (
                              <ProgresItem key={item.id} item={item} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
