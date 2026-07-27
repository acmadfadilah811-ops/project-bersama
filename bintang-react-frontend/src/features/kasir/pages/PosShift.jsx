import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Calendar, Clock, AlertCircle, CheckCircle, ArrowRight, User, Search, RefreshCw } from 'lucide-react';
import { useKasir } from '../context/KasirContext';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../api/apiClient';
import NumericInput from '../../../components/NumericInput';

export default function PosShift() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { shiftAktif, setShiftAktif, checkActiveShift } = useKasir();

  // Create Shift Form States
  const [kasirQuery, setKasirQuery] = useState('');
  const [selectedKasir, setSelectedKasir] = useState(user || null);
  const [showKasirDropdown, setShowKasirDropdown] = useState(false);
  const [cashiers, setCashiers] = useState([]);
  
  const [selectedShiftTiming, setSelectedShiftTiming] = useState('Shift Pagi');
  const [shiftTimings, setShiftTimings] = useState([]);

  // Auto select logged-in user as Kasir
  useEffect(() => {
    if (user && !selectedKasir) {
      setSelectedKasir(user);
    }
  }, [user]);

  const [kasAwal, setKasAwal] = useState(0);
  const [loadingOpen, setLoadingOpen] = useState(false);

  // Close Shift States
  const [kasAkhir, setKasAkhir] = useState(0);
  const [tutupCatatan, setTutupCatatan] = useState('');
  const [loadingClose, setLoadingClose] = useState(false);

  // Shift Sales Summary
  const [salesSummary, setSalesSummary] = useState({
    totalSalesCount: 0,
    totalSalesAmount: 0,
    cashAmount: 0,
    nonCashAmount: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(false);

  const kasirDropdownRef = useRef(null);

  // Fetch cashiers for searchable selection
  const fetchCashiers = async (search = '') => {
    try {
      const res = await apiClient.get('/users/', { params: { search } });
      setCashiers(res.data || []);
    } catch (err) {
      console.warn('Cannot fetch full user list (non-admin), using current logged in user.');
      if (user) {
        setCashiers([user]);
      }
    }
  };

  // Fetch shift timings
  const fetchShiftTimings = async () => {
    try {
      const res = await apiClient.get('/shift-timing/');
      const data = res.data || [];
      setShiftTimings(data);
      if (data.length > 0) {
        setSelectedShiftTiming(data[0].judul || data[0].nama || String(data[0].id));
      } else {
        setSelectedShiftTiming('Shift Pagi');
      }
    } catch (err) {
      console.error('Error fetching shift timings:', err);
      setSelectedShiftTiming('Shift Pagi');
    }
  };

  // Fetch sales summary when active shift changes
  const fetchShiftSalesSummary = async () => {
    if (!shiftAktif) return;
    setLoadingSummary(true);
    try {
      const res = await apiClient.get('/pos/sales/', {
        params: { shift: shiftAktif.id },
      });
      const data = res.data || [];
      
      let totalAmount = 0;
      let cash = 0;
      let nonCash = 0;

      data.forEach(sale => {
        if (sale.status === 'paid') {
          const total = parseFloat(sale.total || 0);
          totalAmount += total;
          if (sale.metode_bayar?.toLowerCase() === 'cash') {
            cash += total;
          } else {
            nonCash += total;
          }
        }
      });

      setSalesSummary({
        totalSalesCount: data.filter(s => s.status === 'paid').length,
        totalSalesAmount: totalAmount,
        cashAmount: cash,
        nonCashAmount: nonCash,
      });
    } catch (err) {
      console.error('Error fetching shift sales summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchCashiers();
    fetchShiftTimings();
  }, []);

  useEffect(() => {
    fetchShiftSalesSummary();
  }, [shiftAktif]);

  // Click outside close cashier dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (kasirDropdownRef.current && !kasirDropdownRef.current.contains(e.target)) {
        setShowKasirDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Cashiers list based on text input
  const filteredCashiers = cashiers.filter(c =>
    c.username.toLowerCase().includes(kasirQuery.toLowerCase()) ||
    (c.first_name || '').toLowerCase().includes(kasirQuery.toLowerCase())
  );

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (!selectedKasir) {
      alert('Nama kasir wajib dipilih.');
      return;
    }
    if (!selectedShiftTiming) {
      alert('Periode shift wajib dipilih.');
      return;
    }

    setLoadingOpen(true);
    try {
      // Simpan NAMA shift (bukan id) agar terbaca di laporan & ringkasan.
      const timing = shiftTimings.find((t) => String(t.id) === String(selectedShiftTiming) || t.judul === selectedShiftTiming);
      const payload = {
        kasir: selectedKasir.id,
        shift: timing?.judul || timing?.nama || selectedShiftTiming || 'Shift Pagi',
        kas_awal: parseFloat(kasAwal || 0),
        waktu_buka: new Date().toISOString(),
      };
      const res = await apiClient.post('/saldo-kas-harian/', payload);
      setShiftAktif(res.data);
      alert('Shift berhasil dibuka. Kas awal telah tercatat pada periode ini.');
    } catch (err) {
      console.error('Error opening shift:', err);
      alert('Gagal membuka shift: ' + (err.response?.data?.error || err.response?.data?.detail || err.message));
    } finally {
      setLoadingOpen(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!shiftAktif) return;
    if (!window.confirm('Tutup shift ini? Seluruh transaksi pada shift akan dikunci dan tidak dapat diubah kembali.')) {
      return;
    }

    setLoadingClose(true);
    try {
      // Endpoint `close` menutup shift SEKALIGUS membuat Ringkasan Shift (V2)
      // dengan `expected` yang dihitung di server (kas awal + tunai + kas masuk
      // - kas keluar), lalu mengembalikan rinciannya untuk ditampilkan.
      const res = await apiClient.post(`/saldo-kas-harian/${shiftAktif.id}/close/`, {
        kas_akhir: parseFloat(kasAkhir || 0),
        catatan: tutupCatatan,
      });
      const d = res.data?.rincian || {};
      const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
      setShiftAktif(null);
      setKasirQuery('');
      setSelectedKasir(null);
      setKasAwal('0');
      setKasAkhir('0');
      setTutupCatatan('');
      alert(
        'Shift berhasil ditutup. Rekapitulasi kas:\n\n' +
        `Kas awal        : ${rp(d.kas_awal)}\n` +
        `Penjualan tunai : ${rp(d.penjualan_tunai)}\n` +
        `Kas masuk       : ${rp(d.kas_masuk)}\n` +
        `Kas keluar      : ${rp(d.kas_keluar)}\n` +
        `Seharusnya      : ${rp(d.expected)}\n` +
        `Kas aktual      : ${rp(d.aktual)}\n` +
        `Selisih         : ${rp(d.selisih)}`
      );
      checkActiveShift();
    } catch (err) {
      console.error('Error closing shift:', err);
      alert('Gagal menutup shift: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingClose(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto w-full max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h4 className="font-extrabold text-slate-800 text-lg">Manajemen Shift & Saldo Kas Harian</h4>
        <p className="text-xs text-slate-500 font-semibold">Kelola pembukaan kasir awal harian, pelacakan setoran tunai, dan penutupan shift kasir.</p>
      </div>

      {!shiftAktif ? (
        /* ================= KAS AWAL / BUKA SHIFT ================= */
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-2xl">
              <Wallet size={20} />
            </div>
            <div>
              <h5 className="font-extrabold text-slate-800 text-sm">Buka Shift Kasir Baru</h5>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tambah Kas Awal Harian</p>
            </div>
          </div>

          <form onSubmit={handleOpenShift} className="space-y-4 text-xs font-semibold text-slate-700">
            
            {/* Kasir Selection (Filterable dropdown) */}
            <div className="relative" ref={kasirDropdownRef}>
              <label className="block text-slate-650 font-extrabold text-slate-650 mb-1">Kasir *</label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <User size={14} className="text-slate-400 mr-2 shrink-0" />
                {selectedKasir ? (
                  <div className="flex-1 flex items-center justify-between text-slate-800 font-bold">
                    <span>{selectedKasir.username} ({selectedKasir.first_name || 'Karyawan'})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKasir(null);
                        setKasirQuery('');
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Ketik nama kasir untuk mencari..."
                    value={kasirQuery}
                    onChange={(e) => {
                      setKasirQuery(e.target.value);
                      setShowKasirDropdown(true);
                    }}
                    onFocus={() => setShowKasirDropdown(true)}
                    className="flex-1 bg-transparent text-xs font-semibold focus:outline-none text-slate-700"
                  />
                )}
                <Search size={14} className="text-slate-400 ml-2 shrink-0" />
              </div>

              {/* Suggestions Dropdown */}
              {showKasirDropdown && filteredCashiers.length > 0 && (
                <div className="absolute inset-x-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                  {filteredCashiers.map((cashier) => (
                    <button
                      key={cashier.id}
                      type="button"
                      onClick={() => {
                        setSelectedKasir(cashier);
                        setShowKasirDropdown(false);
                      }}
                      className="w-full px-4 py-2.5 hover:bg-slate-50 text-left text-xs font-semibold text-slate-700 flex justify-between cursor-pointer border-b border-slate-100"
                    >
                      <span>{cashier.username}</span>
                      <span className="text-slate-400 capitalize">{cashier.role || 'Staff'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Shift Timing Selection */}
            <div>
              <label className="block text-slate-650 font-extrabold text-slate-650 mb-1">Shift *</label>
              <select
                value={selectedShiftTiming}
                onChange={(e) => setSelectedShiftTiming(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {shiftTimings.length === 0 ? (
                  <>
                    <option value="Shift Pagi">Shift Pagi (08:00 - 16:00)</option>
                    <option value="Shift Sore">Shift Sore (16:00 - 23:00)</option>
                  </>
                ) : (
                  shiftTimings.map((st) => {
                    const labelName = st.judul || st.nama || `Shift #${st.id}`;
                    const timeRange = st.jam_mulai ? `(${st.jam_mulai} - ${st.jam_berakhir || st.jam_selesai || ''})` : '';
                    return (
                      <option key={st.id} value={labelName}>
                        {labelName} {timeRange}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            {/* Kas Awal Input */}
            <div>
              <label className="block text-slate-650 font-extrabold text-slate-650 mb-1">Kas Awal (Rp.) *</label>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <span className="font-extrabold text-slate-500 mr-2">Rp.</span>
                <NumericInput
                  value={kasAwal}
                  onChange={(val) => setKasAwal(val)}
                  className="w-full bg-transparent border-none focus:outline-none font-black text-slate-900 text-right"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/kasir/terminal')}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl text-center cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loadingOpen || !selectedKasir || !selectedShiftTiming}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loadingOpen ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <span>Simpan</span>
                )}
              </button>
            </div>

          </form>
        </div>
      ) : (
        /* ================= TAMPILAN SHIFT AKTIF & TUTUP SHIFT ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sisi Kiri: Detail Shift & Penjualan */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-2xl">
                <CheckCircle size={20} className="animate-pulse" />
              </div>
              <div>
                <h5 className="font-extrabold text-slate-800 text-sm">Shift Sedang Aktif</h5>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Toko Beroperasi</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-50 pb-3">
                <div>
                  <span className="text-[10px] text-slate-400 block leading-none mb-1">Kasir</span>
                  <span className="text-slate-800 font-bold">{shiftAktif.kasir_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block leading-none mb-1">Shift</span>
                  <span className="text-slate-800 font-bold">{shiftAktif.shift_nama || 'Shift 1'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-50 pb-3">
                <div>
                  <span className="text-[10px] text-slate-400 block leading-none mb-1">Waktu Buka</span>
                  <span className="text-slate-800 font-bold">
                    {new Date(shiftAktif.waktu_buka).toLocaleString('id-ID')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block leading-none mb-1">Kas Awal</span>
                  <span className="text-slate-800 font-extrabold">{formatCurrency(shiftAktif.kas_awal)}</span>
                </div>
              </div>

              {/* Sales Summary values */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-3">
                <h6 className="font-extrabold text-slate-800 text-xs">Ringkasan Penjualan Shift Ini</h6>
                
                {loadingSummary ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw size={16} className="animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Jumlah Transaksi Lunas</span>
                      <span className="font-bold text-slate-700">{salesSummary.totalSalesCount} Nota</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Penjualan Lunas</span>
                      <span className="font-extrabold text-slate-800">{formatCurrency(salesSummary.totalSalesAmount)}</span>
                    </div>
                    <div className="h-px bg-slate-200/60 my-1" />
                    <div className="flex justify-between">
                      <span className="text-slate-500">Penerimaan Tunai (Cash)</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(salesSummary.cashAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Penerimaan Non-Tunai</span>
                      <span className="font-bold text-slate-700">{formatCurrency(salesSummary.nonCashAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Form Tutup Shift */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="bg-rose-100 text-rose-600 p-2.5 rounded-2xl">
                <AlertCircle size={20} />
              </div>
              <div>
                <h5 className="font-extrabold text-slate-800 text-sm">Tutup Shift Kasir</h5>
                <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Rekonsiliasi Kas Setoran</p>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4 text-xs font-semibold text-slate-700">
              
              {/* Expected Cash in drawer */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 text-slate-700 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold">Estimasi Uang Tunai di Drawer:</span>
                  <span className="font-extrabold text-slate-800">
                    {formatCurrency(parseFloat(shiftAktif.kas_awal) + salesSummary.cashAmount)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Dihitung dari: Kas Awal + Total Penjualan Tunai.</p>
              </div>

              {/* Kas Akhir Riil */}
              <div>
                <label className="block text-slate-650 font-extrabold mb-1">Kas Akhir Riil (Uang Tunai Fisik) *</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <span className="font-extrabold text-slate-500 mr-2">Rp.</span>
                  <NumericInput
                  value={kasAkhir}
                  onChange={(val) => setKasAkhir(val)}
                  className="w-full bg-transparent border-none focus:outline-none font-black text-slate-900 text-right"
                  placeholder="0"
                />
                </div>
              </div>

              {/* Catatan Penutup */}
              <div>
                <label className="block text-slate-650 font-extrabold mb-1">Catatan Penutup / Selisih Kas</label>
                <textarea
                  rows="3"
                  value={tutupCatatan}
                  onChange={(e) => setTutupCatatan(e.target.value)}
                  placeholder="Keterangan selisih kas atau catatan serah terima shift"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loadingClose}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-rose-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {loadingClose ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <span>Tutup Shift & Simpan Rekonsiliasi</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

        </div>
      )}
    </div>
  );
}
