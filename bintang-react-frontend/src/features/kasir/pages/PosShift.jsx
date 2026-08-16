import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, X, Flag, HelpCircle, Check, Trash2 } from 'lucide-react';
import PosHeaderBar from '../components/PosHeaderBar';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useKasir } from '../context/KasirContext';
import { notifyApiError, notifySuccess } from '../../../utils/notify';

// Nama tunai dicocokkan sama seperti server (SaldoKasHarianViewSet.close()):
// tipe pembayaran POSPaymentMethod='Tunai' + nama bawaan 'cash'/'tunai'. Di
// sini dipakai perkiraan by-name karena master metode bayar tidak difetch di
// layar ini — cukup untuk ringkasan tampilan, bukan sumber kebenaran keuangan
// (server yang menghitung ulang expected/selisih saat shift ditutup).
const isMetodeTunai = (metode) => {
  const m = (metode || '').toLowerCase();
  return m.includes('cash') || m.includes('tunai');
};

export default function PosShift({ onToggleSidebar }) {
  const { user } = useAuth();
  const { shiftAktif, loadingShift, checkActiveShift } = useKasir();

  // Mode View: 'startShift' (SS Mulai Shift) | 'activeShift' (SS 1) | 'closeShiftNumpad' (SS 3)
  const [viewMode, setViewMode] = useState('startShift');

  // Start Shift Cash Amount State
  const [startCashStr, setStartCashStr] = useState('0');
  const [startingShift, setStartingShift] = useState(false);

  // Modals: 'kasForm' (SS 2) | 'confirmClose' (SS 4)
  const [kasModalType, setKasModalType] = useState(null); // 'in' | 'out' | null
  const [showConfirmCloseModal, setShowConfirmCloseModal] = useState(false);
  const [showPlusDropdown, setShowPlusDropdown] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [closingShift, setClosingShift] = useState(false);

  // Rekap kas harian nyata (GET /pos/sales/rekap-harian/) untuk kasir ini.
  const [penjualanTunai, setPenjualanTunai] = useState(0);
  const [pengembalianTunai] = useState(0);
  const [pembatalanTunai] = useState(0);

  // List of Cash Movements (SS 1 Right Panel) — dari rekap_harian.pendapatan_lain
  // + .pengeluaran (CashTransaction arah='pendapatan'/'pengeluaran' hari ini).
  const [cashMovements, setCashMovements] = useState([]);

  // Tipe Transaksi (master, wajib diisi backend) untuk modal Kas Masuk/Keluar.
  const [transTypeOptions, setTransTypeOptions] = useState([]);

  // Form State for Kas Masuk / Kas Keluar Modal (SS 2)
  const [formTransTypeName, setFormTransTypeName] = useState('');
  const [formAmountStr, setFormAmountStr] = useState('0');
  const [formCatatan, setFormCatatan] = useState('');
  const [formAttachments, setFormAttachments] = useState([]);
  const [savingKasMovement, setSavingKasMovement] = useState(false);
  const attachmentInputRef = useRef(null);

  // Close Shift Typed Cash Amount (SS 3)
  const [typedCloseCashStr, setTypedCloseCashStr] = useState('0');
  // Keterangan penutupan shift (opsional) — dikirim sebagai `catatan` ke
  // /saldo-kas-harian/{id}/close/, tampil di Ringkasan Shift V2.
  const [closeKeterangan, setCloseKeterangan] = useState('');

  const kasirName = user?.nama_lengkap || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || '-';
  const awalDiLaci = Number(shiftAktif?.kas_awal || 0);
  const shiftStartTime = shiftAktif?.waktu_buka
    ? new Date(shiftAktif.waktu_buka).toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';

  // Ikuti status shift NYATA dari KasirContext (bukan asumsi 'startShift' selalu).
  useEffect(() => {
    if (loadingShift) return;
    setViewMode(shiftAktif ? 'activeShift' : 'startShift');
  }, [shiftAktif, loadingShift]);

  const fetchRekapHarian = async () => {
    if (!shiftAktif?.id) {
      setPenjualanTunai(0);
      setCashMovements([]);
      return;
    }
    try {
      const res = await apiClient.get('/pos/sales/rekap-harian/', {
        params: { kasir: user?.id, shift: shiftAktif.id },
      });
      const tunai = (res.data?.penjualan_per_metode || [])
        .filter((p) => isMetodeTunai(p.metode))
        .reduce((sum, p) => sum + Number(p.jumlah || 0), 0);
      setPenjualanTunai(tunai);

      const masuk = (res.data?.pendapatan_lain || []).map((t) => ({
        id: t.id, type: 'in', timeStr: new Date(t.waktu).toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        catatan: t.catatan || t.tipe, amount: Number(t.jumlah || 0),
      }));
      const keluar = (res.data?.pengeluaran || []).map((t) => ({
        id: t.id, type: 'out', timeStr: new Date(t.waktu).toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        catatan: t.catatan || t.tipe, amount: Number(t.jumlah || 0),
      }));
      setCashMovements([...masuk, ...keluar].sort((a, b) => b.id - a.id));
    } catch {
      setCashMovements([]);
    }
  };

  useEffect(() => {
    if (viewMode === 'activeShift' && user?.id) {
      fetchRekapHarian();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, user?.id, shiftAktif?.id]);

  // Daftar Tipe Transaksi nyata (master) untuk dropdown modal Kas Masuk/Keluar.
  useEffect(() => {
    if (!kasModalType) return;
    (async () => {
      try {
        const res = await apiClient.get('/cash-transaction-types/', {
          params: { tipe: kasModalType === 'in' ? 'pendapatan' : 'pengeluaran' },
        });
        const list = res.data?.results || res.data || [];
        setTransTypeOptions(list);
        setFormTransTypeName('');
      } catch (err) {
        setTransTypeOptions([]);
        notifyApiError(err, 'Gagal memuat daftar tipe transaksi. Hanya Owner/Manager yang bisa mencatat Kas Masuk/Keluar.');
      }
    })();
  }, [kasModalType]);

  // Calculated values
  const totalKasMasukOutNet = cashMovements.reduce(
    (acc, m) => acc + (m.type === 'in' ? m.amount : -m.amount),
    0
  );
  const totalTunai = awalDiLaci + penjualanTunai - pengembalianTunai - pembatalanTunai + totalKasMasukOutNet;
  const totalDiharapkan = totalTunai;

  // Format currency with dot separator e.g. 11.000
  const formatNumberDot = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('de-DE'); // 'de-DE' uses dot for thousands
  };

  // Label shift otomatis dari jam saat ini (tidak ada picker shift di UI ini).
  const shiftLabelByTime = () => {
    const h = new Date().getHours();
    if (h >= 4 && h < 12) return 'Shift Pagi';
    if (h >= 12 && h < 17) return 'Shift Siang';
    return 'Shift Malam';
  };

  // Handle Start Shift (Screenshot Mulai Shift) -> POST /saldo-kas-harian/
  const handleStartShift = async (e) => {
    e?.preventDefault();
    if (startingShift) return;
    const cashNum = parseFloat(startCashStr.replace(/\./g, '')) || 0;
    setStartingShift(true);
    try {
      await apiClient.post('/saldo-kas-harian/', {
        shift: shiftLabelByTime(),
        kas_awal: cashNum,
      });
      await checkActiveShift();
    } catch (err) {
      notifyApiError(err, 'Gagal membuka shift.');
    } finally {
      setStartingShift(false);
    }
  };

  // Handle Save Kas Masuk / Kas Keluar (SS 2) -> POST /cash-transactions/
  // (Hanya Owner/Manager — IsStrictOwnerOrManager di backend; kasir akan
  // mendapat error 403 yang jujur ditampilkan, bukan sukses palsu.)
  const handleSaveKasMovement = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmountStr.replace(/\./g, '')) || 0;
    if (amountNum <= 0) {
      alert('Masukkan jumlah nominal yang valid.');
      return;
    }
    const tipeNama = formTransTypeName.trim();
    if (!tipeNama) {
      alert('Masukkan tipe transaksi terlebih dahulu.');
      return;
    }
    setSavingKasMovement(true);
    try {
      // Gunakan tipe master yang sudah ada bila namanya cocok. Bila kasir
      // mengetik jenis baru, buat master sesuai arah transaksi terlebih dahulu
      // lalu gunakan ID hasilnya untuk transaksi kas. Backend tetap memegang
      // kebijakan apakah kasir diizinkan menambah tipe baru.
      const arah = kasModalType === 'in' ? 'pendapatan' : 'pengeluaran';
      let tipeId = transTypeOptions.find(
        (tipe) => tipe.nama.trim().toLocaleLowerCase() === tipeNama.toLocaleLowerCase(),
      )?.id;
      if (!tipeId) {
        const typeResponse = await apiClient.post('/cash-transaction-types/', {
          nama: tipeNama,
          tipe: arah,
        });
        tipeId = typeResponse.data.id;
        setTransTypeOptions((current) => [...current, typeResponse.data]);
      }
      const transactionPayload = new FormData();
      transactionPayload.append('tipe_transaksi', tipeId);
      transactionPayload.append('jumlah', amountNum);
      transactionPayload.append('waktu', new Date().toISOString());
      transactionPayload.append('catatan', formCatatan);
      formAttachments.forEach((file) => transactionPayload.append('lampiran', file));
      await apiClient.post('/cash-transactions/', transactionPayload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchRekapHarian();
      setKasModalType(null);
      setFormTransTypeName('');
      setFormAmountStr('0');
      setFormCatatan('');
      setFormAttachments([]);
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan Kas Masuk/Keluar.');
    } finally {
      setSavingKasMovement(false);
    }
  };

  // Delete cash movement entry
  const handleDeleteKasEntry = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteKasEntry = async () => {
    const id = deleteTargetId;
    setDeleteTargetId(null);
    try {
      await apiClient.delete(`/cash-transactions/${id}/`);
      await fetchRekapHarian();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus pencatatan kas.');
    }
  };

  // Numpad key handlers for Close Shift (SS 3)
  const handleNumpadClick = (val) => {
    if (val === 'C') {
      setTypedCloseCashStr('0');
    } else if (val === '00') {
      if (typedCloseCashStr === '0' || !typedCloseCashStr) return;
      const unformatted = typedCloseCashStr.replace(/\./g, '') + '00';
      setTypedCloseCashStr(formatNumberDot(unformatted));
    } else {
      const raw = typedCloseCashStr === '0' ? val : typedCloseCashStr.replace(/\./g, '') + val;
      setTypedCloseCashStr(formatNumberDot(raw));
    }
  };

  // Final Close Shift Confirm (SS 4) -> POST /saldo-kas-harian/{id}/close/.
  // Ringkasan adalah laporan Point of Sale, bukan route Kasir.
  const handleFinalCloseShift = async () => {
    if (closingShift || !shiftAktif?.id) return;
    setClosingShift(true);
    const kasAkhir = parseFloat(typedCloseCashStr.replace(/\./g, '')) || 0;
    try {
      await apiClient.post(`/saldo-kas-harian/${shiftAktif.id}/close/`, {
        kas_akhir: kasAkhir,
        catatan: closeKeterangan.trim(),
      });
      setShowConfirmCloseModal(false);
      await checkActiveShift();
      setStartCashStr('0');
      setTypedCloseCashStr('0');
      setCloseKeterangan('');
      setPenjualanTunai(0);
      setCashMovements([]);
      setViewMode('startShift');
      notifySuccess(
        'Shift berhasil ditutup',
        'Ringkasan Shift V2 telah tersimpan dan dapat dilihat di Point of Sale.',
      );
    } catch (err) {
      notifyApiError(err, 'Gagal menutup shift.');
    } finally {
      setClosingShift(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#EAEAEA] overflow-hidden select-none">
      
      {/* Top Header Bar SS 1 with Setrip 3 */}
      <PosHeaderBar
        accountName={kasirName}
        onToggleSidebar={onToggleSidebar}
      />

      {/* Sub-Header Blue Bar */}
      <div className="bg-[#0088FF] px-6 py-2.5 text-white flex items-center justify-between shadow-sm shrink-0 font-bold text-xs">
        {viewMode === 'closeShiftNumpad' ? (
          <div className="flex items-center gap-2">
            <Flag size={16} />
            <span>Akhiri Shift</span>
          </div>
        ) : (
          <span>Shift Saat Ini</span>
        )}
      </div>

      {/* ==================== VIEW 0: START SHIFT / MULAI SHIFT (SCREENSHOT) ==================== */}
      {viewMode === 'startShift' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8FAFC]">
          <form onSubmit={handleStartShift} className="flex flex-col items-center max-w-sm w-full space-y-6">
            
            {/* Cash Register Illustration Graphic SS */}
            <div className="relative w-36 h-32 flex items-center justify-center">
              <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Screen / Display */}
                <rect x="25" y="10" width="30" height="20" rx="3" fill="#818CF8" />
                <rect x="29" y="14" width="22" height="12" rx="2" fill="#C7D2FE" />
                <text x="32" y="23" fontSize="8" fontWeight="bold" fill="#312E81">1.11</text>
                
                {/* Register Base */}
                <rect x="45" y="22" width="45" height="42" rx="4" fill="#9CA3AF" />
                <rect x="50" y="27" width="35" height="32" rx="2" fill="#E5E7EB" />
                
                {/* Keypad Buttons */}
                <circle cx="56" cy="34" r="3" fill="#F59E0B" />
                <circle cx="67" cy="34" r="3" fill="#F59E0B" />
                <circle cx="78" cy="34" r="3" fill="#F59E0B" />
                <circle cx="56" cy="43" r="3" fill="#F59E0B" />
                <circle cx="67" cy="43" r="3" fill="#F59E0B" />
                <circle cx="78" cy="43" r="3" fill="#F59E0B" />
                <circle cx="56" cy="52" r="3" fill="#F59E0B" />
                <circle cx="67" cy="52" r="3" fill="#F59E0B" />
                <circle cx="78" cy="52" r="3" fill="#F59E0B" />
                
                {/* Paper Receipt */}
                <rect x="25" y="32" width="18" height="28" fill="#F9FAFB" rx="1" />
                <line x1="28" y1="36" x2="38" y2="36" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="28" y1="41" x2="36" y2="41" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="28" y1="46" x2="39" y2="46" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />

                {/* Cash Drawer Bottom */}
                <rect x="15" y="62" width="90" height="14" rx="3" fill="#6B7280" />
                <rect x="52" y="66" width="16" height="4" rx="1" fill="#374151" />
              </svg>
            </div>

            {/* Input Field Kas Awal di Laci SS */}
            <div className="w-full text-center space-y-1">
              <label className="text-[11px] font-bold text-slate-400 block">Kas Awal di Laci</label>
              <input
                type="text"
                value={startCashStr}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setStartCashStr(raw ? Number(raw).toLocaleString('de-DE') : '0');
                }}
                className="w-full text-center border-b border-slate-400 pb-1 font-black text-2xl text-slate-900 focus:outline-none focus:border-blue-500 bg-transparent"
              />
            </div>

            {/* Green Button Mulai Shift SS */}
            <button
              type="submit"
              disabled={startingShift}
              className="w-full bg-[#4CAF50] hover:bg-emerald-600 text-white font-extrabold text-sm py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-60"
            >
              <Check size={18} strokeWidth={3} />
              <span>{startingShift ? 'Membuka Shift...' : 'Mulai Shift'}</span>
            </button>

          </form>
        </div>
      ) : viewMode === 'activeShift' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* Main 2-Column Split Layout SS 1 */}
          <div className="flex-1 flex min-h-0 overflow-hidden bg-white">
            
            {/* LEFT COLUMN: Rekapan Shift Saat Ini SS 1 */}
            <div className="flex-1 p-6 space-y-4 border-r border-slate-200 overflow-y-auto text-xs font-semibold text-slate-800">
              
              {/* Kasir Row */}
              <div className="flex justify-between items-center pb-2 border-b border-blue-400">
                <span className="text-slate-500">Kasir</span>
                <span className="font-extrabold text-slate-900">{kasirName}</span>
              </div>

              {/* Mulai Shift Row */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mulai Shift</span>
                <span className="font-extrabold text-slate-900">{shiftStartTime}</span>
              </div>

              {/* Tunai Breakdown Section */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Tunai</span>
                  <span className="font-extrabold text-slate-900">{formatNumberDot(totalTunai)}</span>
                </div>

                <div className="pl-6 border-l-2 border-slate-200 space-y-2.5 text-slate-600">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span>Awal di Laci</span>
                    <span className="font-bold text-slate-800">{formatNumberDot(awalDiLaci)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-emerald-100">
                    <span className="text-emerald-700">+ Penjualan Tunai</span>
                    <span className="font-bold text-emerald-700">+{formatNumberDot(penjualanTunai)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-rose-100">
                    <span className="text-rose-700">− Pengembalian Tunai</span>
                    <span className="font-bold text-rose-700">−{formatNumberDot(pengembalianTunai)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-rose-100">
                    <span className="text-rose-700">− Pembatalan Tunai</span>
                    <span className="font-bold text-rose-700">−{formatNumberDot(pembatalanTunai)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span>Kas Masuk-Keluar</span>
                    <span className="font-bold text-slate-800">{formatNumberDot(totalKasMasukOutNet)}</span>
                  </div>
                </div>
              </div>

              {/* Total Diharapkan Row */}
              <div className="flex justify-between items-center pt-4 text-xs font-black text-slate-900 border-t border-slate-200">
                <span>Total Diharapkan</span>
                <span className="text-sm font-black">{formatNumberDot(totalDiharapkan)}</span>
              </div>

            </div>

            {/* RIGHT COLUMN: Kas Masuk-Keluar SS 1 */}
            <div className="flex-1 bg-[#EAEAEA] p-4 flex flex-col min-h-0 relative">
              
              {/* Right Column Header SS 1 */}
              <div className="flex justify-between items-center pb-3 font-extrabold text-xs text-slate-900 shrink-0">
                <span>Kas Masuk-Keluar</span>
                <span>{formatNumberDot(totalKasMasukOutNet)}</span>
              </div>

              {/* List of Cash Movement Entries SS 1 */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {cashMovements.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-between text-xs"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Green + or Red - Box Icon SS 1 */}
                      <div
                        className={`w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0 font-bold ${
                          entry.type === 'in' ? 'bg-[#4CAF50]' : 'bg-[#EF5350]'
                        }`}
                      >
                        {entry.type === 'in' ? <Plus size={18} /> : <Minus size={18} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 text-[11px]">
                          {entry.timeStr}
                        </div>
                        <div className="text-[11px] text-slate-600 font-semibold truncate mt-0.5">
                          {entry.catatan}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-black text-xs ${entry.type === 'in' ? 'text-slate-900' : 'text-[#EF5350]'}`}>
                        {formatNumberDot(entry.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteKasEntry(entry.id)}
                        className="text-rose-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                        title="Hapus Pencatatan Kas"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Floating Blue Circle (+) Button SS 1 */}
              <div className="absolute bottom-6 right-6 z-20">
                <button
                  type="button"
                  onClick={() => setShowPlusDropdown(!showPlusDropdown)}
                  className="w-12 h-12 rounded-full bg-[#0088FF] hover:bg-blue-600 text-white flex items-center justify-center shadow-xl cursor-pointer transition-all active:scale-95"
                  title="Catat Kas Masuk / Keluar"
                >
                  <Plus size={24} />
                </button>

                {/* Dropdown Options Kas Masuk & Kas Keluar SS 1 */}
                {showPlusDropdown && (
                  <div className="absolute bottom-full right-0 mb-3 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs font-bold text-slate-800 animate-fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusDropdown(false);
                        setFormAttachments([]);
                        if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                        setKasModalType('in');
                      }}
                      className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-2 text-emerald-600 cursor-pointer border-b border-slate-100"
                    >
                      <Plus size={16} />
                      <span>Kas Masuk</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusDropdown(false);
                        setFormAttachments([]);
                        if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                        setKasModalType('out');
                      }}
                      className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-2 text-rose-600 cursor-pointer"
                    >
                      <Minus size={16} />
                      <span>Kas Keluar</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Bottom Green Full-Width Button 🏁 Akhiri Shift SS 1 */}
          <button
            type="button"
            onClick={() => {
              setTypedCloseCashStr(formatNumberDot(totalDiharapkan));
              setViewMode('closeShiftNumpad');
            }}
            className="w-full bg-[#4CAF50] hover:bg-emerald-600 text-white py-3.5 px-4 font-black text-base flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all shrink-0"
          >
            <Flag size={18} />
            <span>Akhiri Shift</span>
          </button>

        </div>
      ) : (
        /* ==================== VIEW 2: AKHIRI SHIFT NUMPAD (SS 3) ==================== */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
          
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Column: Kas Diharapkan SS 3 */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 border-r border-slate-200">
              <h3 className="font-extrabold text-slate-900 text-2xl mb-4">Kas Diharapkan</h3>
              <div className="font-black text-5xl text-slate-900 tracking-tight">
                {formatNumberDot(totalDiharapkan)}
              </div>
            </div>

            {/* Right Column: Typed Cash Input & Numpad SS 3 */}
            <div className="flex-1 flex flex-col min-h-0 p-8 justify-between">
              
              {/* Display Input Nominal Kas di Laci SS 3 */}
              <div className="text-right pb-2 border-b-2 border-blue-500 font-black text-5xl text-slate-900 tracking-tight mb-4">
                {typedCloseCashStr || '0'}
              </div>

              {/* Touch Numpad Grid 3x4 SS 3 */}
              <div className="flex-1 grid grid-cols-3 gap-4 items-center justify-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '00'].map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => handleNumpadClick(btn)}
                    className={`h-full min-h-[50px] max-h-[75px] rounded-xl font-bold text-3xl flex items-center justify-center transition-all shadow-sm border border-slate-200 cursor-pointer active:scale-95 ${
                      btn === 'C'
                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                        : 'bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {btn}
                  </button>
                ))}
              </div>

              {/* Bottom Green Button Konfirmasi SS 3 */}
              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => setShowConfirmCloseModal(true)}
                  className="w-full py-3.5 rounded-lg bg-[#4CAF50] hover:bg-emerald-600 text-white font-extrabold text-lg shadow-lg transition-all cursor-pointer text-center"
                >
                  Konfirmasi
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ==================== MODAL 1: FORM KAS MASUK / KAS KELUAR (SS 2) ==================== */}
      {kasModalType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            {/* Header Blue Bar SS 2 */}
            <div className="bg-[#0088FF] px-5 py-3.5 text-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center">
                  {kasModalType === 'in' ? <Plus size={16} /> : <Minus size={16} />}
                </div>
                <h3 className="font-extrabold text-sm tracking-wide">
                  {kasModalType === 'in' ? 'Kas Masuk' : 'Kas Keluar'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setKasModalType(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body SS 2 */}
            <form onSubmit={handleSaveKasMovement} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="text-[10px] font-bold text-blue-500 block mb-0.5">Tipe Transaksi</label>
                <input
                  type="text"
                  list={`cash-transaction-types-${kasModalType}`}
                  value={formTransTypeName}
                  onChange={(e) => setFormTransTypeName(e.target.value)}
                  placeholder="Pilih atau ketik tipe transaksi"
                  className="w-full border-b border-blue-500 pb-1 text-xs font-bold text-slate-800 focus:outline-none bg-transparent placeholder:text-slate-400"
                />
                <datalist id={`cash-transaction-types-${kasModalType}`}>
                  {transTypeOptions.map((t) => (
                    <option key={t.id} value={t.nama} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Jumlah</label>
                <input
                  type="text"
                  value={formAmountStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setFormAmountStr(raw ? Number(raw).toLocaleString('de-DE') : '0');
                  }}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Catatan"
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>

              {/* File Lampiran */}
              <div className="pt-2">
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg text-slate-600 font-bold">
                  <div className="min-w-0">
                    <span className="block">File lampiran</span>
                    {formAttachments.length > 0 && (
                      <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                        {formAttachments.map((file) => file.name).join(', ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="text-blue-500 hover:text-blue-700 p-0.5 cursor-pointer"
                    title="Pilih file lampiran"
                  >
                    <Plus size={18} />
                  </button>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
                    onChange={(e) => setFormAttachments(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Button Simpan SS 2 */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={savingKasMovement}
                  className="w-full py-2.5 rounded-lg bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  {savingKasMovement ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: KONFIRMASI AKHIRI SHIFT (SS 4) ==================== */}
      {showConfirmCloseModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
            {/* Header Blue Bar SS 4 */}
            <div className="bg-[#0088FF] px-5 py-3.5 text-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} />
                <h3 className="font-extrabold text-sm tracking-wide">Akhiri Shift</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmCloseModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body SS 4 */}
            <div className="p-6 text-center space-y-6">
              <p className="text-xs font-bold text-slate-700">
                Konfirmasi jumlah kas di laci : <span className="font-black text-slate-900">{typedCloseCashStr || formatNumberDot(totalDiharapkan)}</span> ?
              </p>

              <div className="text-left">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Keterangan (opsional)</label>
                <textarea
                  value={closeKeterangan}
                  onChange={(e) => setCloseKeterangan(e.target.value)}
                  placeholder="Mis. alasan selisih kas, catatan serah terima, dll."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Action Buttons SS 4 */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleFinalCloseShift}
                  disabled={closingShift}
                  className="px-8 py-2 rounded bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  {closingShift ? 'Menutup...' : 'Ya'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmCloseModal(false)}
                  className="px-8 py-2 rounded bg-[#555555] hover:bg-slate-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: DELETE CONFIRMATION ==================== */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetId}
        title="Hapus Item"
        message="Apakah anda yakin ingin menghapus item ini?"
        onConfirm={confirmDeleteKasEntry}
        onCancel={() => setDeleteTargetId(null)}
      />

    </div>
  );
}
