import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import {
  Coins,
  Receipt,
  User,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Plus,
  Trash2,
  Package,
  Layers,
  Sparkles,
  Info,
  CalendarDays,
  CreditCard,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export default function Payroll() {
  const { user } = useAuth();
  const isManager = ['owner', 'manager'].includes(user?.role);

  // Navigasi Tab
  const [activeTab, setActiveTab] = useState('payroll'); // 'payroll' | 'bom'

  // --- States Penggajian ---
  const [bulan, setBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [slips, setSlips] = useState([]);
  const [loadingSlips, setLoadingSlips] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [payingSlipId, setPayingSlipId] = useState(null);
  
  // Print / Print Preview Modal
  const [printSlip, setPrintSlip] = useState(null);

  // --- States Bill of Materials (BoM) ---
  const [boms, setBoms] = useState([]);
  const [loadingBoms, setLoadingBoms] = useState(false);
  const [productPrices, setProductPrices] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  
  // Dialog BoM Baru
  const [isAddBomOpen, setIsAddBomOpen] = useState(false);
  const [savingBom, setSavingBom] = useState(false);
  const [bomForm, setBomForm] = useState({
    product_id: '',
    nama: '',
    keterangan: '',
    items: [{ inventory_item_id: '', qty_required_per_unit: 1.0 }],
  });

  const [toast, setToast] = useState(null);
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // --- Fetch Data Functions ---
  const fetchSlips = async () => {
    try {
      setLoadingSlips(true);
      const res = await apiClient.get(`/hr/slip-gaji/?bulan=${bulan}&tahun=${tahun}`);
      setSlips(res.data);
    } catch (err) {
      console.error('Gagal memuat slip gaji:', err);
      showToast('error', 'Gagal memuat data slip gaji.');
    } finally {
      setLoadingSlips(false);
    }
  };

  const fetchBoms = async () => {
    try {
      setLoadingBoms(true);
      const res = await apiClient.get('/bom/');
      setBoms(res.data);
    } catch (err) {
      console.error('Gagal memuat data BoM:', err);
      showToast('error', 'Gagal memuat data Bill of Materials.');
    } finally {
      setLoadingBoms(false);
    }
  };

  const fetchProductPrices = async () => {
    try {
      const res = await apiClient.get('/product-prices/');
      setProductPrices(res.data);
    } catch (err) {
      console.error('Gagal memuat harga produk:', err);
      showToast('error', 'Gagal memuat harga produk.');
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await apiClient.get('/inventory/');
      setInventoryItems(res.data);
    } catch (err) {
      console.error('Gagal memuat inventori:', err);
      showToast('error', 'Gagal memuat data inventori.');
    }
  };

  useEffect(() => {
    if (activeTab === 'payroll') {
      fetchSlips();
    } else {
      fetchBoms();
      fetchProductPrices();
      fetchInventory();
    }
  }, [activeTab, bulan, tahun]);

  // --- Handlers Penggajian ---
  const handleGeneratePayroll = async () => {
    if (generatingPayroll) return;
    const confirmGen = window.confirm(
      `Apakah Anda yakin ingin menghitung dan membuat Slip Gaji untuk semua staf aktif di periode ${bulan}/${tahun}?\n\nJika slip untuk bulan tersebut sudah ada, nominal akan diperbarui dengan hitungan terbaru.`
    );
    if (!confirmGen) return;

    try {
      setGeneratingPayroll(true);
      await apiClient.post('/hr/slip-gaji/generate/', { bulan, tahun });
      showToast('success', 'Kalkulasi Slip Gaji berhasil diproses!');
      fetchSlips();
    } catch (err) {
      console.error('Gagal kalkulasi gaji:', err);
      showToast('error', err.response?.data?.detail || 'Gagal memproses kalkulasi gaji.');
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const handlePaySlip = async (id) => {
    const confirmPay = window.confirm(
      'Konfirmasi pembayaran slip gaji ini?\n\nStatus akan berubah menjadi LUNAS dan jurnal pengeluaran kas (double-entry) akan otomatis dicatat ke Buku Besar.'
    );
    if (!confirmPay) return;

    try {
      setPayingSlipId(id);
      await apiClient.post(`/hr/slip-gaji/${id}/pay/`);
      showToast('success', 'Slip gaji berhasil dibayar dan dibukukan!');
      fetchSlips();
    } catch (err) {
      console.error('Gagal membayar gaji:', err);
      showToast('error', err.response?.data?.detail || 'Gagal memproses pembayaran.');
    } finally {
      setPayingSlipId(null);
    }
  };

  // --- Handlers BoM ---
  const handleAddFormItem = () => {
    setBomForm((prev) => ({
      ...prev,
      items: [...prev.items, { inventory_item_id: '', qty_required_per_unit: 1.0 }],
    }));
  };

  const handleRemoveFormItem = (index) => {
    if (bomForm.items.length === 1) return;
    setBomForm((prev) => {
      const items = [...prev.items];
      items.splice(index, 1);
      return { ...prev, items };
    });
  };

  const handleFormItemChange = (index, field, value) => {
    setBomForm((prev) => {
      const items = [...prev.items];
      items[index][field] = value;
      return { ...prev, items };
    });
  };

  const handleSaveBom = async (e) => {
    e.preventDefault();
    if (!bomForm.product_id || !bomForm.nama) {
      showToast('error', 'Nama dan Produk BoM wajib diisi!');
      return;
    }
    if (bomForm.items.some((i) => !i.inventory_item_id || parseFloat(i.qty_required_per_unit) <= 0)) {
      showToast('error', 'Pilih bahan baku yang valid dan isi kuantitas di atas 0!');
      return;
    }

    try {
      setSavingBom(true);
      // 1. Post Header BoM
      const bomRes = await apiClient.post('/bom/', {
        product: parseInt(bomForm.product_id),
        nama: bomForm.nama,
        keterangan: bomForm.keterangan,
      });
      const bomId = bomRes.data.id;

      // 2. Post BoM items
      const itemPromises = bomForm.items.map((item) =>
        apiClient.post('/bom-items/', {
          bom: bomId,
          inventory_item: parseInt(item.inventory_item_id),
          qty_required_per_unit: parseFloat(item.qty_required_per_unit),
        })
      );
      await Promise.all(itemPromises);

      showToast('success', 'Bill of Materials berhasil dibuat!');
      setIsAddBomOpen(false);
      setBomForm({
        product_id: '',
        nama: '',
        keterangan: '',
        items: [{ inventory_item_id: '', qty_required_per_unit: 1.0 }],
      });
      fetchBoms();
    } catch (err) {
      console.error('Gagal menyimpan BoM:', err);
      showToast('error', 'Gagal membuat Bill of Materials. Produk ini mungkin sudah memiliki BoM.');
    } finally {
      setSavingBom(false);
    }
  };

  const handleDeleteBom = async (id, name) => {
    const confirmDel = window.confirm(
      `Apakah Anda yakin ingin menghapus Bill of Materials "${name}"?\n\nTindakan ini bersifat permanen.`
    );
    if (!confirmDel) return;

    try {
      await apiClient.delete(`/bom/${id}/`);
      showToast('success', 'BoM berhasil dihapus!');
      fetchBoms();
    } catch (err) {
      console.error('Gagal hapus BoM:', err);
      showToast('error', 'Gagal menghapus Bill of Materials.');
    }
  };

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka || 0);

  // --- Perhitungan Ringkasan Gaji ---
  const summary = slips.reduce(
    (acc, curr) => {
      acc.gaji_pokok += curr.gaji_pokok || 0;
      acc.insentif_desain += (curr.total_insentif || 0) + (curr.total_biaya_desain || 0);
      acc.potongan += curr.potongan_terlambat || 0;
      acc.gaji_bersih += curr.total_gaji_bersih || 0;
      if (curr.status === 'paid') acc.dibayar++;
      else acc.pending++;
      return acc;
    },
    { gaji_pokok: 0, insentif_desain: 0, potongan: 0, gaji_bersih: 0, dibayar: 0, pending: 0 }
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Coins className="text-indigo-600 w-7 h-7" /> Penggajian &amp; BoM (MRP)
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Hitung slip gaji otomatis berbasis kontrak &amp; absensi, serta kelola Bill of Materials (BoM) untuk konsumsi bahan baku.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'payroll'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Receipt size={14} /> Slip Gaji Staf
          </button>
          <button
            onClick={() => setActiveTab('bom')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'bom'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers size={14} /> Bill of Materials (BoM)
          </button>
        </div>
      </div>

      {/* --- CONTENT TAB: SLIP GAJI --- */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Controls & Filter */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Bulan</label>
                <select
                  value={bulan}
                  onChange={(e) => setBulan(parseInt(e.target.value))}
                  className="block w-36 text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-slate-900 outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tahun</label>
                <select
                  value={tahun}
                  onChange={(e) => setTahun(parseInt(e.target.value))}
                  className="block w-28 text-xs border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-slate-900 outline-none"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {isManager && (
              <div className="flex items-end">
                <button
                  onClick={handleGeneratePayroll}
                  disabled={generatingPayroll}
                  className="w-full md:w-auto inline-flex items-center justify-center rounded-lg text-xs font-extrabold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  {generatingPayroll ? 'Menghitung...' : 'Hitung Gaji Bulanan'}
                </button>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Total Gaji Pokok</p>
                <Coins size={14} className="text-slate-400" />
              </div>
              <div className="mt-2">
                <h3 className="text-xl font-black text-slate-900">{formatRupiah(summary.gaji_pokok)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Sesuai kontrak terdaftar</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Total Insentif &amp; Desain</p>
                <Sparkles size={14} className="text-indigo-500" />
              </div>
              <div className="mt-2">
                <h3 className="text-xl font-black text-slate-900">{formatRupiah(summary.insentif_desain)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Akumulasi prestasi &amp; pengerjaan SPK</p>
              </div>
            </div>

            <div className="bg-red-50/30 rounded-xl p-5 border border-red-150 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[11px] font-bold text-red-900 uppercase">Total Potongan Keterlambatan</p>
                <AlertCircle size={14} className="text-red-500" />
              </div>
              <div className="mt-2">
                <h3 className="text-xl font-black text-red-700">{formatRupiah(summary.potongan)}</h3>
                <p className="text-[10px] text-red-500 mt-0.5">Penalti keterlambatan check-in</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Total Gaji Bersih</p>
                <CheckCircle2 size={14} className="text-emerald-400" />
              </div>
              <div className="mt-2">
                <h3 className="text-xl font-black text-emerald-400">{formatRupiah(summary.gaji_bersih)}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {summary.pending} tertunda, {summary.dibayar} dibayar
                </p>
              </div>
            </div>
          </div>

          {/* Table List Slip Gaji */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Daftar Slip Gaji Periode {bulan}/{tahun}</h3>
                <p className="text-[10px] text-slate-500">Dihitung otomatis berdasarkan rekap absen &amp; job board</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200/60">
                  <tr>
                    <th className="px-6 py-3">Nama Karyawan</th>
                    <th className="px-6 py-3 text-right">Gaji Pokok</th>
                    <th className="px-6 py-3 text-right">Insentif Job</th>
                    <th className="px-6 py-3 text-right">Biaya Desain</th>
                    <th className="px-6 py-3 text-right">Potongan Terlambat</th>
                    <th className="px-6 py-3 text-right font-black">Gaji Bersih</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingSlips ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-400 font-semibold">
                        <div className="flex justify-center mb-1.5">
                          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        Memuat slip gaji...
                      </td>
                    </tr>
                  ) : slips.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">
                        Belum ada slip gaji yang dihitung untuk periode ini. Klik "Hitung Gaji Bulanan" di atas.
                      </td>
                    </tr>
                  ) : (
                    slips.map((slip) => (
                      <tr key={slip.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-150 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {slip.staff_nama?.slice(0, 2).toUpperCase()}
                          </div>
                          {slip.staff_nama}
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-slate-600">
                          {formatRupiah(slip.gaji_pokok)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-slate-600">
                          {formatRupiah(slip.total_insentif)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-slate-600">
                          {formatRupiah(slip.total_biaya_desain)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-red-600">
                          {slip.potongan_terlambat > 0 ? `-${formatRupiah(slip.potongan_terlambat)}` : '—'}
                        </td>
                        <td className="px-6 py-3.5 text-right font-black text-slate-900 bg-slate-50/40">
                          {formatRupiah(slip.total_gaji_bersih)}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {slip.status === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wide border border-emerald-200">
                              Lunas
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wide border border-slate-200">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center flex justify-center gap-2">
                          <button
                            onClick={() => setPrintSlip(slip)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors border border-slate-200 shadow-3xs cursor-pointer"
                            title="Cetak Slip Gaji"
                          >
                            <Printer size={13} />
                          </button>
                          
                          {isManager && slip.status === 'draft' && (
                            <button
                              onClick={() => handlePaySlip(slip.id)}
                              disabled={payingSlipId === slip.id}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {payingSlipId === slip.id ? 'Memproses...' : 'Bayar Gaji'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTENT TAB: BILL OF MATERIALS (BOM) --- */}
      {activeTab === 'bom' && (
        <div className="space-y-6">
          {/* Controls & Filter */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Configured Bill of Materials (BoM)</h3>
              <p className="text-[10px] text-slate-500 font-medium">Lacak resep/konsumsi bahan baku otomatis untuk setiap produk cetak.</p>
            </div>
            {isManager && (
              <button
                onClick={() => setIsAddBomOpen(true)}
                className="inline-flex items-center justify-center rounded-lg text-xs font-extrabold transition-all bg-slate-900 hover:bg-slate-800 text-white shadow-sm h-10 px-4"
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                Tambah BoM Baru
              </button>
            )}
          </div>

          {/* BoM Grid Cards */}
          {loadingBoms ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
              <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Memuat data Bill of Materials...
            </div>
          ) : boms.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 italic text-xs">
              Belum ada Bill of Materials yang dibuat. Buat BoM baru untuk mengaktifkan pemotongan stok otomatis.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boms.map((bom) => (
                <div key={bom.id} className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black bg-indigo-50 text-indigo-700 uppercase border border-indigo-150">
                          MRP Recipe
                        </span>
                        <h4 className="font-black text-slate-800 text-sm mt-1">{bom.nama}</h4>
                        <p className="text-[11px] text-slate-500 font-semibold italic">
                          Produk: {bom.product_nama} {bom.product_material ? `(${bom.product_material})` : ''}
                        </p>
                      </div>
                      
                      {isManager && (
                        <button
                          onClick={() => handleDeleteBom(bom.id, bom.nama)}
                          className="p-1.5 text-slate-350 hover:text-red-600 hover:bg-red-50 rounded transition-colors border border-transparent hover:border-red-200"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {bom.keterangan && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 italic">
                        {bom.keterangan}
                      </p>
                    )}

                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Bahan Baku Yang Dibutuhkan:</h5>
                      <div className="divide-y divide-slate-100 border border-slate-150 rounded-lg overflow-hidden bg-slate-50/30">
                        {bom.items && bom.items.map((item) => (
                          <div key={item.id} className="p-2.5 flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-700">{item.inventory_item_nama}</span>
                            <span className="font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                              {item.qty_required_per_unit} {item.inventory_item_satuan || 'unit'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                    <span>ID BoM: #{bom.id}</span>
                    <span className="font-bold text-slate-500 uppercase">Sistem Stok Otomatis</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- MODAL DAFTAR BOM BARU --- */}
      {isAddBomOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Buat Bill of Materials (BoM) Baru</h3>
                <p className="text-[10px] text-slate-500">Definisikan bahan baku yang terkonsumsi untuk satu unit produk pricelist</p>
              </div>
              <button
                onClick={() => setIsAddBomOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBom} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Nama Formula BoM</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Banner Outdoor Flexi 280g"
                  value={bomForm.nama}
                  onChange={(e) => setBomForm({ ...bomForm, nama: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Keterangan / Deskripsi Formula</label>
                <textarea
                  rows="2"
                  placeholder="Formula standar penggunaan bahan tinta dan kain spanduk..."
                  value={bomForm.keterangan}
                  onChange={(e) => setBomForm({ ...bomForm, keterangan: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Produk Pricelist Terkait</label>
                <select
                  required
                  value={bomForm.product_id}
                  onChange={(e) => setBomForm({ ...bomForm, product_id: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Pilih Produk Pricelist --</option>
                  {productPrices.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.nama_produk} {prod.material ? `(${prod.material})` : ''} - {prod.kategori}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-150 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-700 uppercase">Daftar Bahan Baku &amp; Kuantitas</label>
                  <button
                    type="button"
                    onClick={handleAddFormItem}
                    className="text-[10px] font-bold text-indigo-700 hover:text-white hover:bg-indigo-650 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md transition-colors"
                  >
                    + Tambah Bahan
                  </button>
                </div>

                <div className="space-y-2.5">
                  {bomForm.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <select
                          required
                          value={item.inventory_item_id}
                          onChange={(e) => handleFormItemChange(index, 'inventory_item_id', e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded bg-white"
                        >
                          <option value="">-- Pilih Bahan Inventori --</option>
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.nama} ({inv.satuan}) - Stok: {inv.stok}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          step="0.001"
                          required
                          min="0.001"
                          placeholder="Qty"
                          value={item.qty_required_per_unit}
                          onChange={(e) => handleFormItemChange(index, 'qty_required_per_unit', e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded bg-white text-center"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFormItem(index)}
                        disabled={bomForm.items.length === 1}
                        className="p-2 text-slate-400 hover:text-red-650 disabled:opacity-35"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 bg-white sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setIsAddBomOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBom}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {savingBom ? 'Menyimpan...' : 'Simpan BoM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PRINT SLIP GAJI MODAL PREVIEW --- */}
      {printSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-150 flex justify-between items-center no-print">
              <span className="font-extrabold text-xs text-slate-800">Print Preview Slip Gaji</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-755 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  <Printer size={12} /> Print
                </button>
                <button
                  onClick={() => setPrintSlip(null)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Slip Gaji Content (Tampilan Print Rapi) */}
            <div id="print-area" className="p-8 space-y-6 text-slate-800 bg-white">
              {/* Header Slip */}
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h2 className="text-base font-extrabold tracking-widest text-slate-900 uppercase">CV. BINTANG ADVERTISING</h2>
                <p className="text-[10px] text-slate-500 font-semibold">Jl. Raya Bintang No. 99, Yogyakarta • Telp: (0274) 123456</p>
                <p className="text-[12px] font-black text-indigo-705 text-indigo-800 uppercase tracking-widest mt-2.5">SLIP GAJI KARYAWAN</p>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5">Periode: {printSlip.bulan}/{printSlip.tahun}</p>
              </div>

              {/* Data Karyawan */}
              <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-slate-200 pb-4">
                <div className="space-y-1.5">
                  <p><span className="text-slate-450 text-slate-500">Nama Penerima:</span> <strong className="text-slate-900 font-bold ml-1">{printSlip.staff_nama}</strong></p>
                  <p><span className="text-slate-450 text-slate-500">Status Pembayaran:</span> <strong className="text-slate-900 font-bold ml-1 uppercase">{printSlip.status === 'paid' ? 'LUNAS' : 'DRAFT'}</strong></p>
                </div>
                <div className="space-y-1.5 text-right">
                  <p><span className="text-slate-450 text-slate-500">Tanggal Cetak:</span> <span className="font-medium ml-1">{new Date().toLocaleDateString('id-ID')}</span></p>
                  {printSlip.waktu_dibayar && (
                    <p><span className="text-slate-450 text-slate-500">Tanggal Bayar:</span> <span className="font-medium ml-1">{new Date(printSlip.waktu_dibayar).toLocaleDateString('id-ID')}</span></p>
                  )}
                </div>
              </div>

              {/* Rincian Pendapatan & Potongan */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1">Rincian Keuangan</h4>
                
                <div className="space-y-2.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">1. Gaji Pokok (Kontrak)</span>
                    <span className="font-bold text-slate-800">{formatRupiah(printSlip.gaji_pokok)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">2. Insentif Job (Penyelesaian SPK)</span>
                    <span className="font-bold text-slate-800">{formatRupiah(printSlip.total_insentif)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">3. Biaya Desain (Custom Job)</span>
                    <span className="font-bold text-slate-800">{formatRupiah(printSlip.total_biaya_desain)}</span>
                  </div>

                  <div className="flex justify-between text-red-600 border-t border-slate-100 pt-2">
                    <span className="font-semibold">4. Potongan Absensi Terlambat</span>
                    <span className="font-bold">-{formatRupiah(printSlip.potongan_terlambat)}</span>
                  </div>
                </div>
              </div>

              {/* Total Bersih */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center mt-6">
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">TOTAL GAJI BERSIH (TAKE HOME PAY)</span>
                <span className="text-base font-black text-slate-900">{formatRupiah(printSlip.total_gaji_bersih)}</span>
              </div>

              {/* Catatan Internal */}
              {printSlip.catatan && (
                <div className="text-[10px] italic text-slate-500 bg-slate-50/50 p-2.5 rounded border border-slate-150">
                  <strong>Catatan:</strong> {printSlip.catatan}
                </div>
              )}

              {/* Tanda Tangan */}
              <div className="grid grid-cols-2 gap-4 pt-12 text-[10px] text-center">
                <div className="space-y-12">
                  <p className="font-semibold text-slate-600">Penerima Karyawan,</p>
                  <p className="font-bold text-slate-800 border-t border-slate-200 pt-1.5 w-32 mx-auto uppercase">{printSlip.staff_nama}</p>
                </div>
                <div className="space-y-12">
                  <p className="font-semibold text-slate-600">Yogyakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>Dibayar Oleh,</p>
                  <p className="font-bold text-slate-800 border-t border-slate-200 pt-1.5 w-32 mx-auto uppercase">
                    {printSlip.dibayar_oleh_nama || 'Owner / Keuangan'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifikasi ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-[slideDown_0.3s_ease] ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
