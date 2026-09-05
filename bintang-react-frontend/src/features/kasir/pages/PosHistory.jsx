import { useState, useEffect } from 'react';
import { Cloud, Search, Filter, MoreVertical, Banknote, Clock, User, DollarSign, Printer, Mail, Smartphone, Factory, XCircle, Eye, X, Check, FileText, Send, Calendar, Globe2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { notifyApiError, notifyError, notifySuccess } from '../../../utils/notify';
import { useAuth } from '../../../context/AuthContext';
import PosHeaderBar from '../components/PosHeaderBar';
import SpkPublishModal from '../components/SpkPublishModal';
import ReceiptPrint from '../components/ReceiptPrint';
import VoidOrderModal from '../components/VoidOrderModal';
import VoidOrderOtpModal from '../components/VoidOrderOtpModal';
import { getPrintErrorMessage, printReceipt } from '../../printing/services/printService';

const ORDER_STATUS_LABEL = {
  draft: 'DRAFT',
  quotation: 'PENAWARAN',
  review: 'REVIEW',
  desain: 'PROSES DESAIN',
  proses: 'PROSES PRODUKSI',
  ready: 'SIAP DIAMBIL',
  selesai: 'SELESAI',
  batal: 'DIBATALKAN',
};

const ORDER_SUMBER_LABEL = {
  wa: 'Order via WA',
  pos: 'Order via Kasir (DP)',
  manual: 'Order Manual',
};

// Satu bentuk item yang sama dipakai baik untuk baris POSSaleItem maupun
// OrderItem, supaya render di bawah tidak perlu tahu asalnya — dan tidak lagi
// salah baca nama field (penyebab NaN sebelumnya: kode lama pakai `harga`/
// `jumlah`/`harga_total` yang memang tidak pernah ada di kedua model ini).
function normalizePosItem(it) {
  const qty = Number(it.qty) || 0;
  const jumlah = Number(it.subtotal || 0);
  const namaSatuan = Number(it.harga_snapshot || 0);
  const nama = it.nama_snapshot || it.nama || 'Item';
  return {
    // Bentuk baru dipakai render tabel di layar ini.
    nama, qty, harga_satuan: namaSatuan, jumlah,
    // Alias nama field lama — ReceiptPrint.jsx (Cetak Resi) baca field ini
    // langsung, jangan diubah supaya cetak resi POS tidak ikut rusak.
    nama_snapshot: nama, harga_snapshot: namaSatuan, subtotal: jumlah,
    uom_kode: it.uom_kode,
  };
}

function normalizeOrderItem(it) {
  const qty = Number(it.qty) || 0;
  const jumlah = Number(it.harga_jual || 0); // harga_jual di OrderItem = total baris, bukan per-satuan
  const hargaSatuan = qty > 0 ? jumlah / qty : jumlah;
  const nama = it.jenis_produk || it.product_nama || 'Item';
  return {
    nama, qty, harga_satuan: hargaSatuan, jumlah,
    // Alias supaya Cetak Resi (ReceiptPrint.jsx) tetap bisa dipakai untuk Pesanan juga.
    nama_snapshot: nama, harga_snapshot: hargaSatuan, subtotal: jumlah,
  };
}

export default function PosHistory({ onToggleSidebar }) {
  const { businessSettings, user } = useAuth();
  const isKasir = user?.role?.toLowerCase() === 'kasir';
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [showPaymentFilterModal, setShowPaymentFilterModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showSpkModal, setShowSpkModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showVoidOtpModal, setShowVoidOtpModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showWaModal, setShowWaModal] = useState(false);
  const [waInput, setWaInput] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showReturModal, setShowReturModal] = useState(false);
  const [returCatatan, setReturCatatan] = useState('');
  const [returNominal, setReturNominal] = useState('');
  const [returTanggal, setReturTanggal] = useState('');
  const [returLangsungKonfirmasi, setReturLangsungKonfirmasi] = useState(false);
  const [processingRetur, setProcessingRetur] = useState(false);

  // Volume transaksi advertising bisa ~100/hari -- filter tanggal (default
  // hari ini) supaya jumlah baris yang ditarik dari server tetap terbatas
  // (kelas masalah sama dengan fetch-all katalog produk yang diperbaiki
  // sebelumnya), plus paginasi di sisi render supaya daftar tidak makin
  // berat seiring waktu. "Cari Semua" mengabaikan rentang tanggal.
  // Riwayat menggabungkan 2 sumber (/pos/sales/ & /orders/) jadi satu daftar
  // -- paginasi gabungan lintas-sumber di server tidak sepele, jadi di sini
  // paginasinya di sisi render atas hasil yang SUDAH dibatasi tanggal
  // (bukan lagi seluruh riwayat sepanjang masa seperti sebelumnya).
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [cariSemua, setCariSemua] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const dateParams = cariSemua ? {} : { date_from: dateFrom, date_to: dateTo };
      const [posData, orderData] = await Promise.all([
        fetchAllPages('/pos/sales/', { params: dateParams }),
        fetchAllPages('/orders/', { params: dateParams }),
      ]);

      const posFormatted = posData.map((item) => {
        const items = (item.items || []).map(normalizePosItem);
        return {
          tipe: 'pos',
          id: item.id,
          nomor: item.nomor,
          created_at: item.created_at,
          date_str: new Date(item.created_at).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          kasir_name: item.kasir_name || '-',
          pelanggan_name: item.pelanggan_name || '',
          pelanggan: item.pelanggan || null, // PK Contact = nomor_wa, dipakai utk Kirim Resi WA
          metode_bayar: (item.metode_bayar || 'CASH').toUpperCase(),
          status: (item.status || '').toUpperCase(),
          is_void: (item.status || '').toUpperCase() === 'VOID',
          diambil_pada: item.diambil_pada || null,
          total: Number(item.total || 0),
          dp_dibayar: 0,
          sisa_tagihan: 0,
          items_summary: items.map((i) => `${i.qty}x ${i.nama}`).join(', '),
          items,
          // Field mentah untuk ReceiptPrint (Cetak Resi) — sama seperti yang
          // dikembalikan POSSaleSerializer, tidak diringkas ulang di sini.
          subtotal: item.subtotal,
          diskon: item.diskon,
          pajak: item.pajak,
          dibayar: item.dibayar,
          kembalian: item.kembalian,
          catatan: item.catatan,
        };
      });

      const orderFormatted = orderData.map((order) => {
        const items = (order.items || []).map(normalizeOrderItem);
        const sisaTagihan = Number(order.sisa_tagihan || 0);
        const dpDibayar = Number(order.dp_dibayar || 0);
        const isBatal = order.status_global === 'batal';
        return {
          tipe: 'order',
          id: order.id,
          nomor: order.id,
          created_at: order.waktu,
          date_str: new Date(order.waktu).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          kasir_name: order.dilayani_oleh_nama || '-',
          pelanggan_name: order.nama || '',
          pelanggan: order.nomor_wa || null,
          metode_bayar: (order.metode_pembayaran || '-').toUpperCase(),
          status: isBatal ? 'VOID' : (ORDER_STATUS_LABEL[order.status_global] || order.status_global || '').toUpperCase(),
          status_global: order.status_global,
          sumber: order.sumber || 'manual',
          sumber_label: ORDER_SUMBER_LABEL[order.sumber] || 'Order Manual',
          is_void: isBatal,
          total: Number(order.total_harga || 0),
          dp_dibayar: dpDibayar,
          sisa_tagihan: sisaTagihan,
          // Keterangan pembayaran khusus Pesanan (DP/lunas) — POS selalu lunas
          // di muka jadi tidak perlu keterangan ini.
          keterangan_bayar: isBatal
            ? ''
            : sisaTagihan > 0
              ? (dpDibayar > 0
                  ? `Baru bayar DP Rp ${dpDibayar.toLocaleString('id-ID')} — Sisa tagihan Rp ${sisaTagihan.toLocaleString('id-ID')}`
                  : `Belum dibayar — Sisa tagihan Rp ${sisaTagihan.toLocaleString('id-ID')}`)
              : 'Lunas',
          items_summary: items.map((i) => `${i.qty}x ${i.nama}`).join(', '),
          items,
          subtotal: order.total_harga,
          diskon: order.diskon_kupon + order.diskon_otomatis,
          pajak: 0,
          dibayar: dpDibayar,
          kembalian: 0,
          catatan: order.catatan_pelanggan,
        };
      });

      const formatted = [...posFormatted, ...orderFormatted].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      setSales(formatted);
      setSelectedSale((prev) => formatted.find((s) => s.tipe === prev?.tipe && s.id === prev?.id) || formatted[0] || null);
    } catch (err) {
      setSales([]);
      setSelectedSale(null);
      notifyApiError(err, 'Gagal memuat riwayat transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [dateFrom, dateTo, cariSemua]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, paymentFilter, dateFrom, dateTo, cariSemua]);

  const handleKirimResiWaSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSale) return;
    let phone = (waInput || '').replace(/[^0-9]/g, '');
    if (phone.length < 8 || phone.length > 15) {
      notifyApiError(null, 'Nomor WhatsApp tidak valid. Gunakan 8–15 digit.');
      return;
    }
    if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
    else if (!phone.startsWith('62')) phone = `62${phone}`;

    let msg = `*Resi ${selectedSale.nomor}*\n\n`;
    (selectedSale.items || []).forEach((it) => {
      msg += `• ${it.nama_snapshot || it.nama} x${it.qty} = Rp ${Number(it.subtotal || 0).toLocaleString('id-ID')}\n`;
    });
    msg += `\nTotal: Rp ${Number(selectedSale.total).toLocaleString('id-ID')}\nMetode Bayar: ${selectedSale.metode_bayar}\n\nTerima kasih telah berbelanja!`;

    setSendingWa(true);
    try {
      await apiClient.post('/whatsapp/send/', { number: phone, text: msg });
      notifySuccess('Resi terkirim', `Resi ${selectedSale.nomor} dikirim ke WhatsApp ${phone}.`);
      setShowWaModal(false);
    } catch (err) {
      notifyApiError(err, 'Gagal mengirim resi via WhatsApp.');
    } finally {
      setSendingWa(false);
    }
  };

  const handleEmailResiSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSale || !emailInput || !emailInput.trim()) return;
    setSendingEmail(true);
    try {
      const res = await apiClient.post(`/pos/sales/${selectedSale.id}/email-resi/`, { email: emailInput.trim() });
      notifySuccess('Berhasil', res.data?.message || `Resi dikirim ke ${emailInput.trim()}.`);
      setShowEmailModal(false);
    } catch (err) {
      notifyApiError(err, 'Gagal mengirim resi via email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleConfirmVoid = async (alasan) => {
    if (!selectedSale) return;
    setVoiding(true);
    try {
      if (selectedSale.tipe === 'order') {
        await apiClient.post(`/orders/${selectedSale.id}/batalkan/`, { alasan });
        notifySuccess('Berhasil', `Pesanan ${selectedSale.nomor} berhasil dibatalkan.`);
      } else {
        await apiClient.post(`/pos/sales/${selectedSale.id}/void/`, { alasan });
        notifySuccess('Berhasil', `Transaksi ${selectedSale.nomor} berhasil di-void / refund.`);
      }
      fetchSales();
    } catch (err) {
      notifyApiError(err, selectedSale.tipe === 'order' ? 'Gagal membatalkan pesanan.' : 'Gagal memproses Refund/Void.');
    } finally {
      setVoiding(false);
    }
  };

  const openReturModal = () => {
    if (!selectedSale) return;
    setReturCatatan('');
    setReturNominal(String(Math.round(selectedSale.total || 0)));
    setReturTanggal(new Date().toISOString().slice(0, 10));
    setReturLangsungKonfirmasi(false);
    setShowActionDropdown(false);
    setShowReturModal(true);
  };

  const handleConfirmRetur = async (e) => {
    e.preventDefault();
    if (!selectedSale || processingRetur) return;
    setProcessingRetur(true);
    try {
      await apiClient.post(`/orders/${selectedSale.id}/retur/`, {
        catatan: returCatatan,
        tanggal_pengembalian: returTanggal,
        nominal_refund: Number(returNominal) || 0,
        // 'Dikonfirmasi' langsung memicu pengembalian stok (lihat retur() di
        // backend) — 'Tunda' cuma mencatat pengajuan, stok baru kembali kalau
        // dikonfirmasi belakangan (mis. lewat Transaksi > Penjualan).
        status: returLangsungKonfirmasi ? 'Dikonfirmasi' : 'Tunda',
      });
      notifySuccess(
        'Berhasil',
        returLangsungKonfirmasi
          ? `Retur ${selectedSale.nomor} dikonfirmasi — stok sudah otomatis ditambahkan kembali.`
          : `Pengembalian pesanan ${selectedSale.nomor} berhasil diajukan (status Tunda) — stok belum berubah sampai dikonfirmasi.`
      );
      setShowReturModal(false);
      fetchSales();
    } catch (err) {
      notifyApiError(err, 'Gagal mengajukan pengembalian pesanan.');
    } finally {
      setProcessingRetur(false);
    }
  };

  // Filter sales based on search term & payment method filter
  const filteredSales = sales.filter((item) => {
    const matchSearch =
      item.nomor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.pelanggan_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.items_summary || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    if (paymentFilter === 'ALL') return true;
    return item.metode_bayar.toUpperCase() === paymentFilter.toUpperCase();
  });

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const pagedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  const paymentOptions = [
    { id: 'ALL', label: 'Semua Tipe Pembayaran' },
    { id: 'CASH', label: 'CASH' },
    { id: 'Online ShopeePay', label: 'Online ShopeePay' },
    { id: 'Online Dana', label: 'Online Dana' },
    { id: 'Online OVO', label: 'Online OVO' },
    { id: 'Online Virtual Bank', label: 'Online Virtual Bank' },
    { id: 'Online Credit Card', label: 'Online Credit Card' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#EAEAEA] overflow-hidden select-none">
      {/* Top Header Bar SS 1 with Setrip 3 */}
      <PosHeaderBar
        onToggleSidebar={onToggleSidebar}
      />

      {/* Sub-Header Blue Bar SS 1, 2, 3 */}
      <div className="bg-[#0088FF] px-4 py-2 text-white flex items-center justify-between shadow-sm shrink-0 gap-4 text-xs font-semibold border-t border-white/10">
        {/* Left Section: Cloud Online, Search Bar, Payment Filter Button */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-1.5 shrink-0 font-bold">
            <Cloud size={16} />
            <span>Online</span>
          </div>

          {/* Search Input */}
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-slate-800 pl-8 pr-3 py-1 rounded text-xs focus:outline-none placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Payment Method Filter Button */}
          <button
            type="button"
            onClick={() => setShowPaymentFilterModal(true)}
            className="flex items-center gap-2 hover:bg-white/10 px-3 py-1 rounded cursor-pointer transition-all shrink-0"
          >
            <span>{paymentFilter === 'ALL' ? 'Semua Tipe Pembayaran' : paymentFilter}</span>
            <Filter size={15} />
          </button>
        </div>

        {/* Right Section: Filter Tanggal, Cari Semua & Header Vertical Dots */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1 bg-white/10 rounded px-2 py-1 ${cariSemua ? 'opacity-40 pointer-events-none' : ''}`}>
            <Calendar size={13} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-white text-[11px] font-bold outline-none [color-scheme:dark]"
            />
            <span className="text-white/50 text-[10px]">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-white text-[11px] font-bold outline-none [color-scheme:dark]"
            />
          </div>
          <button
            type="button"
            onClick={() => setCariSemua((v) => !v)}
            title="Cari semua tanggal (abaikan filter tanggal)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all ${
              cariSemua ? 'bg-white text-[#0088FF]' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <Globe2 size={12} /> Semua
          </button>
          <button type="button" className="hover:bg-white/10 p-1 rounded cursor-pointer">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Main Split Content: Left List & Right Detail SS 1 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: Daftar Semua Riwayat Transaksi (~60% width) */}
        <div className="flex-[3] bg-white border-r border-slate-300 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat riwayat transaksi...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada transaksi ditemukan</div>
          ) : (
            pagedSales.map((sale) => {
              const isSelected = selectedSale?.id === sale.id;

              return (
                <div
                  key={sale.id}
                  onClick={() => {
                    setSelectedSale(sale);
                    setShowActionDropdown(false);
                  }}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#F0F7FF] border-l-4 border-[#0088FF]'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Banknote Green Icon */}
                    <div className="w-10 h-10 rounded-lg bg-white border border-emerald-400 flex items-center justify-center text-emerald-600 shadow-sm shrink-0 mt-0.5">
                      <Banknote size={24} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-900 text-xs tracking-tight flex items-center gap-1.5 flex-wrap">
                        <span>{sale.nomor}</span>
                        {sale.tipe === 'order' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            {sale.sumber_label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-700 font-semibold truncate mt-0.5">
                        {sale.items_summary}
                      </div>
                      <div className="text-xs font-black text-slate-900 mt-0.5">
                        {Math.round(sale.total).toLocaleString('id-ID')} - {sale.metode_bayar}
                        {sale.pelanggan_name && (
                          <span className="font-bold text-slate-800 ml-1">({sale.pelanggan_name})</span>
                        )}
                      </div>
                      {sale.tipe === 'order' && sale.keterangan_bayar && (
                        <div className={`text-[11px] font-bold mt-0.5 ${
                          sale.sisa_tagihan > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}>
                          {sale.keterangan_bayar}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Date & Time (Top Right of Card) */}
                  <div className="text-[11px] font-extrabold text-slate-800 shrink-0 self-start mt-0.5 pl-2">
                    {sale.date_str}
                  </div>
                </div>
              );
            })
          )}
        </div>

          {!loading && filteredSales.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-[10px] font-bold text-slate-500 bg-slate-50/60 shrink-0 border-t border-slate-200">
              <div className="flex items-center gap-1.5">
                <span>{filteredSales.length} transaksi</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none cursor-pointer text-slate-700"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2 py-1 cursor-pointer"
                >
                  &lt;
                </button>
                <span>{page}/{totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2 py-1 cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Detail Per Transaksi (~40% width) SS 1 */}
        {selectedSale ? (
          <div className="flex-[2] bg-[#EAEAEA] flex flex-col min-h-0 overflow-hidden relative">
            
            {/* Metadata Info Header List SS 1 */}
            <div className="p-4 space-y-2 text-xs font-semibold text-slate-700 bg-[#EAEAEA] shrink-0 border-b border-slate-300">
              <div className="flex items-center gap-2 text-slate-700 font-bold flex-wrap">
                <Clock size={16} className="text-slate-600 shrink-0" />
                <span>{selectedSale.nomor}</span>
                {selectedSale.tipe === 'order' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                    {selectedSale.sumber_label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock size={16} className="text-slate-600 shrink-0" />
                <span>{selectedSale.date_str}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <User size={16} className="text-slate-600 shrink-0" />
                <span>{selectedSale.kasir_name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <User size={16} className="text-slate-600 shrink-0" />
                <span>{selectedSale.pelanggan_name || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <DollarSign size={16} className="text-slate-700 shrink-0" />
                <span>{selectedSale.metode_bayar} ({selectedSale.status})</span>
              </div>
              {selectedSale.tipe === 'order' && selectedSale.keterangan_bayar && (
                <div className={`flex items-center gap-2 font-bold ${
                  selectedSale.sisa_tagihan > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  <Banknote size={16} className="shrink-0" />
                  <span>{selectedSale.keterangan_bayar}</span>
                </div>
              )}
            </div>

            {/* Items Table SS 1 */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#EAEAEA] overflow-hidden">
              {/* Table Header: Dark Grey SS 1 */}
              <div className="bg-[#555555] text-white text-xs font-bold px-4 py-2 flex justify-between items-center shrink-0">
                <span className="w-1/2">Item</span>
                <span className="w-1/4 text-center">Qty</span>
                <span className="w-1/4 text-right">Jumlah</span>
              </div>

              {/* Table Items Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#EAEAEA]">
                {selectedSale.items && selectedSale.items.length > 0 ? (
                  selectedSale.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-semibold text-slate-800">
                      <span className="w-1/2 font-bold truncate">{it.nama}</span>
                      <span className="w-1/4 text-center text-slate-600 font-bold">
                        {it.qty} x {Math.round(it.harga_satuan).toLocaleString('id-ID')}
                      </span>
                      <span className="w-1/4 text-right font-bold text-slate-900">
                        {Math.round(it.jumlah).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-400 text-xs font-semibold">Tidak ada item.</div>
                )}
              </div>

              {/* Item Count Summary Row SS 1 */}
              <div className="px-4 py-2.5 bg-[#EAEAEA] text-xs font-semibold text-slate-700 shrink-0 border-t border-slate-300">
                Jumlah Item: {selectedSale.items ? selectedSale.items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0) : 0}
              </div>
            </div>

            {/* Bottom Total Blue Bar & Three Dots Button SS 1 & SS 2 */}
            <div className="bg-[#EAEAEA] border-t border-slate-300 flex items-center justify-between shrink-0 relative">
              <div className="flex-1 py-3 text-center text-[#0088FF] font-black text-xl">
                Rp {Math.round(selectedSale.total).toLocaleString('id-ID')}
              </div>

              {/* Three Dots Button for Action Dropdown SS 2 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionDropdown(!showActionDropdown)}
                  className="w-12 h-12 bg-[#0088FF] hover:bg-blue-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                >
                  <MoreVertical size={20} />
                </button>

                {/* Dropdown Popup Menu SS 2 */}
                {showActionDropdown && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs font-bold text-slate-800 animate-fade-in">
                    <button
                      type="button"
                      disabled={sendingWa}
                      onClick={async () => {
                        setShowActionDropdown(false);
                        // ReceiptPrint dirender di luar dropdown (hidden, hanya
                        // muncul saat print:block). QZ Tray atau dialog browser
                        // dipilih oleh konfigurasi perangkat kasir.
                        try {
                          await printReceipt({ receipt: selectedSale, businessSettings });
                        } catch (error) {
                          notifyError('Cetak resi gagal', getPrintErrorMessage(error));
                        }
                      }}
                      className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer disabled:opacity-50"
                    >
                      <Printer size={16} className="text-slate-600" />
                      <span>Cetak Resi</span>
                    </button>

                    {selectedSale?.tipe !== 'order' && (
                      <button
                        type="button"
                        disabled={sendingEmail}
                        onClick={() => {
                          setShowActionDropdown(false);
                          setEmailInput('');
                          setShowEmailModal(true);
                        }}
                        className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer disabled:opacity-50"
                      >
                        <Mail size={16} className="text-slate-600" />
                        <span>Email Resi</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowActionDropdown(false);
                        setWaInput(selectedSale?.pelanggan || '');
                        setShowWaModal(true);
                      }}
                      className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer"
                    >
                      <Smartphone size={16} className="text-slate-600" />
                      <span>Kirim Resi (WA)</span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        voiding || selectedSale?.status === 'VOID' ||
                        (selectedSale?.tipe === 'order' && selectedSale?.status_global === 'selesai') ||
                        (selectedSale?.tipe === 'pos' && !!selectedSale?.diambil_pada)
                      }
                      onClick={() => {
                        setShowActionDropdown(false);
                        if (isKasir) {
                          setShowVoidOtpModal(true);
                        } else {
                          setShowVoidModal(true);
                        }
                      }}
                      className="w-full px-4 py-2.5 hover:bg-rose-50 text-rose-600 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle size={16} className="text-rose-500" />
                      <span>
                        {selectedSale?.status === 'VOID'
                          ? (selectedSale?.tipe === 'order' ? 'Sudah Dibatalkan' : 'Telah Di-Void')
                          : selectedSale?.tipe === 'order' && selectedSale?.status_global === 'selesai'
                            ? 'Sudah Selesai — Gunakan Retur'
                            : selectedSale?.tipe === 'pos' && selectedSale?.diambil_pada
                              ? 'Sudah Diambil — Tidak Bisa Void'
                              : (selectedSale?.tipe === 'order' ? 'Batalkan Pesanan' : 'Refund/Void')}
                      </span>
                    </button>

                    {selectedSale?.tipe === 'order' && selectedSale?.status_global === 'selesai' && (
                      <button
                        type="button"
                        onClick={openReturModal}
                        className="w-full px-4 py-2.5 hover:bg-amber-50 text-amber-700 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer"
                      >
                        <XCircle size={16} className="text-amber-600" />
                        <span>Retur Pesanan</span>
                      </button>
                    )}

                    {selectedSale?.tipe !== 'order' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionDropdown(false);
                          setShowSpkModal(true);
                        }}
                        className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer"
                      >
                        <Factory size={16} className="text-slate-600" />
                        <span>Terbitkan SPK</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowActionDropdown(false);
                        setShowLogsModal(true);
                      }}
                      className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-3 cursor-pointer"
                    >
                      <Eye size={16} className="text-slate-600" />
                      <span>Lihat Logs</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-[2] bg-white flex flex-col items-center justify-center p-8 text-slate-400 text-xs font-semibold">
            Pilih salah satu transaksi dari daftar sebelah kiri
          </div>
        )}
      </div>

      {/* POPUP MODAL: Filter Cara Pembayaran SS 3 */}
      {showPaymentFilterModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            {/* Header Blue Bar SS 3 */}
            <div className="bg-[#0088FF] px-5 py-3.5 text-white flex items-center justify-between shadow-sm shrink-0">
              <h3 className="font-extrabold text-sm tracking-wide">Cara Pembayaran</h3>
              <button
                type="button"
                onClick={() => setShowPaymentFilterModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* List of Payment Filter Options SS 3 */}
            <div className="p-3 space-y-1 max-h-[70vh] overflow-y-auto text-xs font-bold text-slate-800">
              {paymentOptions.map((opt) => {
                const isSelected = paymentFilter === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setPaymentFilter(opt.id);
                      setShowPaymentFilterModal(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-600 font-extrabold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={16} className="text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL UI: Refund/Void Transaksi */}
      {showVoidModal && selectedSale && (
        <VoidOrderModal
          isOpen={showVoidModal}
          onClose={() => setShowVoidModal(false)}
          onConfirmVoid={handleConfirmVoid}
        />
      )}

      {showVoidOtpModal && selectedSale && (
        <VoidOrderOtpModal
          isOpen={showVoidOtpModal}
          onClose={() => setShowVoidOtpModal(false)}
          tipe={selectedSale.tipe === 'pos' ? 'pos' : 'order'}
          target={selectedSale}
          onVoided={() => {
            notifySuccess(
              'Berhasil',
              selectedSale.tipe === 'pos'
                ? `Transaksi ${selectedSale.nomor} berhasil di-void.`
                : `Pesanan ${selectedSale.nomor} berhasil dibatalkan.`
            );
            fetchSales();
          }}
        />
      )}

      {/* POPUP MODAL UI: Retur Pesanan (khusus Order berstatus Selesai — void
          biasa sengaja ditolak backend untuk order selesai, harus lewat sini) */}
      {showReturModal && selectedSale && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            <div className="bg-amber-600 px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <XCircle size={20} />
                </div>
                <h3 className="font-extrabold text-base tracking-wide">Retur Pesanan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReturModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleConfirmRetur} className="p-6 space-y-5 bg-white text-xs font-semibold text-slate-700">
              <p className="text-[11px] text-slate-500 font-semibold -mt-1">
                Pesanan {selectedSale.nomor} sudah berstatus Selesai — pembatalan langsung tidak diizinkan,
                pengajuan pengembalian ini akan tercatat dengan status "Tunda" untuk ditindaklanjuti.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">Tanggal Pengembalian</label>
                <input
                  type="date"
                  value={returTanggal}
                  onChange={(e) => setReturTanggal(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500 bg-slate-50 focus:bg-white transition-all"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">Nominal Refund (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={returNominal}
                  onChange={(e) => setReturNominal(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500 bg-slate-50 focus:bg-white transition-all"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">Catatan</label>
                <textarea
                  value={returCatatan}
                  onChange={(e) => setReturCatatan(e.target.value)}
                  rows={3}
                  placeholder="Alasan pengembalian..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 bg-slate-50 focus:bg-white transition-all resize-none"
                  required
                />
              </div>
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={returLangsungKonfirmasi}
                  onChange={(e) => setReturLangsungKonfirmasi(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-slate-600">
                  Barang sudah diterima kembali sekarang — langsung konfirmasi
                  (stok otomatis ditambahkan kembali). Kalau belum yakin barangnya
                  sudah kembali secara fisik, biarkan tidak dicentang (status Tunda,
                  stok baru bertambah setelah dikonfirmasi belakangan).
                </span>
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processingRetur}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {processingRetur ? 'Memproses...' : returLangsungKonfirmasi ? 'Ajukan & Konfirmasi Retur' : 'Ajukan Retur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL UI: Kirim Resi via Email */}
      {showEmailModal && selectedSale && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            <div className="bg-[#0088FF] px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Mail size={20} />
                </div>
                <h3 className="font-extrabold text-base tracking-wide">Kirim Resi via Email</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEmailResiSubmit} className="p-6 space-y-5 bg-white text-xs font-semibold text-slate-700">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">
                  Alamat Email Tujuan
                </label>
                <input
                  type="email"
                  placeholder="contoh: pelanggan@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-all"
                  required
                  autoFocus
                />
                <span className="text-[11px] text-slate-400 font-semibold block mt-1.5">
                  Resi transaksi {selectedSale.nomor} akan dikirimkan ke email ini.
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="px-6 py-2.5 rounded-xl bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>{sendingEmail ? 'Mengirim...' : 'Kirim Resi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL UI: Kirim Resi via WhatsApp */}
      {showWaModal && selectedSale && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            <div className="bg-emerald-600 px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Smartphone size={20} />
                </div>
                <h3 className="font-extrabold text-base tracking-wide">Kirim Resi via WhatsApp</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWaModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleKirimResiWaSubmit} className="p-6 space-y-5 bg-white text-xs font-semibold text-slate-700">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">
                  Nomor WhatsApp Tujuan
                </label>
                <input
                  type="text"
                  placeholder="081234567890"
                  value={waInput}
                  onChange={(e) => setWaInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-all"
                  required
                  autoFocus
                />
                <span className="text-[11px] text-slate-400 font-semibold block mt-1.5">
                  Resi transaksi {selectedSale.nomor} akan dikirim melalui WhatsApp bisnis.
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWaModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sendingWa}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>{sendingWa ? 'Mengirim...' : 'Kirim Resi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL UI: Log Aktivitas Transaksi */}
      {showLogsModal && selectedSale && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            <div className="bg-slate-800 px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-wide">Log Aktivitas Transaksi</h3>
                  <p className="text-xs text-slate-300 font-mono">{selectedSale.nomor}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 bg-slate-50 max-h-[60vh] overflow-y-auto text-xs">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Waktu Transaksi</span>
                  <span className="font-bold text-slate-900">{selectedSale.date_str}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Kasir</span>
                  <span className="font-bold text-slate-900">{selectedSale.kasir_name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Pelanggan</span>
                  <span className="font-bold text-slate-900">{selectedSale.pelanggan_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Metode Pembayaran</span>
                  <span className="font-bold text-slate-900">{selectedSale.metode_bayar}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Status Transaksi</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    selectedSale.status === 'VOID' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedSale.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 font-bold">Total Nilai</span>
                  <span className="font-black text-slate-900 text-sm">Rp {Math.round(selectedSale.total).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-extrabold text-slate-700 block text-xs">Riwayat Aktivitas:</span>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                    <div>
                      <p className="font-bold text-slate-800">Transaksi Berhasil Dibuat</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Dibuat oleh {selectedSale.kasir_name} pada {selectedSale.date_str}</p>
                    </div>
                  </div>
                  {selectedSale.status === 'VOID' && (
                    <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0"></div>
                      <div>
                        <p className="font-bold text-rose-800">Transaksi Di-Void / Refund</p>
                        <p className="text-[11px] text-rose-600 mt-0.5">Status transaksi diubah menjadi VOID</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showSpkModal && selectedSale && (
        <SpkPublishModal
          judul={`Terbitkan SPK — ${selectedSale.nomor}`}
          keterangan="Pilih divisi/tahap tujuan produksi untuk transaksi ini."
          onClose={() => setShowSpkModal(false)}
          onTerbitkan={async (payload) => {
            const res = await apiClient.post(`/pos/sales/${selectedSale.id}/terbitkan-spk/`, payload);
            notifySuccess('Berhasil', res.data?.message || 'SPK berhasil diterbitkan.');
            setShowSpkModal(false);
          }}
        />
      )}

      {/* Tersembunyi kecuali saat print (lihat ReceiptPrint.jsx), dipicu
          tombol "Cetak Resi" melalui PrintService. */}
      <ReceiptPrint receipt={selectedSale} settings={businessSettings} />

    </div>
  );
}
