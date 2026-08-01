import React, { useState, useEffect } from 'react';
import { Cloud, Search, Filter, MoreVertical, Banknote, Clock, User, DollarSign, Printer, Mail, Smartphone, Factory, XCircle, Eye, X, Check, FileText, Send } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { useAuth } from '../../../context/AuthContext';
import PosHeaderBar from '../components/PosHeaderBar';
import SpkPublishModal from '../components/SpkPublishModal';
import ReceiptPrint from '../components/ReceiptPrint';
import VoidOrderModal from '../components/VoidOrderModal';

export default function PosHistory({ onToggleSidebar }) {
  const { businessSettings } = useAuth();
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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showWaModal, setShowWaModal] = useState(false);
  const [waInput, setWaInput] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/pos/sales/');
      const apiData = res.data?.results || res.data || [];
      const formatted = apiData.map((item) => ({
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
        total: Number(item.total || 0),
        items_summary: item.items ? item.items.map((i) => `${i.qty}x ${i.nama_snapshot || i.nama}`).join(', ') : '',
        items: item.items || [],
        // Field mentah untuk ReceiptPrint (Cetak Resi) — sama seperti yang
        // dikembalikan POSSaleSerializer, tidak diringkas ulang di sini.
        subtotal: item.subtotal,
        diskon: item.diskon,
        pajak: item.pajak,
        dibayar: item.dibayar,
        kembalian: item.kembalian,
        catatan: item.catatan,
      }));
      setSales(formatted);
      setSelectedSale((prev) => formatted.find((s) => s.id === prev?.id) || formatted[0] || null);
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
  }, []);

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
      await apiClient.post(`/pos/sales/${selectedSale.id}/void/`, { alasan });
      notifySuccess('Berhasil', `Transaksi ${selectedSale.nomor} berhasil di-void / refund.`);
      fetchSales();
    } catch (err) {
      notifyApiError(err, 'Gagal memproses Refund/Void.');
    } finally {
      setVoiding(false);
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

        {/* Right Section: Date Display & Header Vertical Dots */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-semibold text-xs">Fri, 31 Jul 2026</span>
          <button type="button" className="hover:bg-white/10 p-1 rounded cursor-pointer">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Main Split Content: Left List & Right Detail SS 1 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: Daftar Semua Riwayat Transaksi (~60% width) */}
        <div className="flex-[3] bg-white border-r border-slate-300 flex flex-col min-h-0 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat riwayat transaksi...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada transaksi ditemukan</div>
          ) : (
            filteredSales.map((sale) => {
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
                      <div className="font-extrabold text-slate-900 text-xs tracking-tight">
                        {sale.nomor}
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

        {/* RIGHT COLUMN: Detail Per Transaksi (~40% width) SS 1 */}
        {selectedSale ? (
          <div className="flex-[2] bg-[#EAEAEA] flex flex-col min-h-0 overflow-hidden relative">
            
            {/* Metadata Info Header List SS 1 */}
            <div className="p-4 space-y-2 text-xs font-semibold text-slate-700 bg-[#EAEAEA] shrink-0 border-b border-slate-300">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <Clock size={16} className="text-slate-600 shrink-0" />
                <span>{selectedSale.nomor}</span>
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
                      <span className="w-1/2 font-bold truncate">{it.nama || it.nama_snapshot}</span>
                      <span className="w-1/4 text-center text-slate-600 font-bold">
                        {it.qty} x {Number(it.harga || 0).toLocaleString('id-ID')}
                      </span>
                      <span className="w-1/4 text-right font-bold text-slate-900">
                        {Number(it.jumlah || it.harga_total || (it.harga * it.qty)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-800">
                    <span className="w-1/2 font-bold">benner</span>
                    <span className="w-1/4 text-center text-slate-600 font-bold">1 x 50.000</span>
                    <span className="w-1/4 text-right font-bold text-slate-900">50.000</span>
                  </div>
                )}
              </div>

              {/* Item Count Summary Row SS 1 */}
              <div className="px-4 py-2.5 bg-[#EAEAEA] text-xs font-semibold text-slate-700 shrink-0 border-t border-slate-300">
                Jumlah Item: {selectedSale.items ? selectedSale.items.reduce((acc, i) => acc + (i.qty || 1), 0) : 1}
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
                      onClick={() => {
                        setShowActionDropdown(false);
                        // ReceiptPrint dirender di luar dropdown (hidden, hanya
                        // muncul saat print:block) — window.print() memicu
                        // dialog cetak browser sungguhan, sama seperti Split
                        // Bill sudah pakai pola ini.
                        window.print();
                      }}
                      className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer disabled:opacity-50"
                    >
                      <Printer size={16} className="text-slate-600" />
                      <span>Cetak Resi</span>
                    </button>

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
                      disabled={voiding || selectedSale?.status === 'VOID'}
                      onClick={() => {
                        setShowActionDropdown(false);
                        setShowVoidModal(true);
                      }}
                      className="w-full px-4 py-2.5 hover:bg-rose-50 text-rose-600 text-left flex items-center gap-3 border-b border-slate-100 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle size={16} className="text-rose-500" />
                      <span>{selectedSale?.status === 'VOID' ? 'Telah Di-Void' : 'Refund/Void'}</span>
                    </button>

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

      {/* Tersembunyi kecuali saat print (lihat ReceiptPrint.jsx) — dipicu
          tombol "Cetak Resi" lewat window.print(). */}
      <ReceiptPrint receipt={selectedSale} settings={businessSettings} />

    </div>
  );
}
