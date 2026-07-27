import { useState, useEffect } from 'react';
import { Settings, Plus, Pencil, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import LoyaltyPointSettingModal from '../components/LoyaltyPointSettingModal';
import LoyaltyPointRedemptionModal from '../components/LoyaltyPointRedemptionModal';
import apiClient from '../../../api/apiClient';

export default function LoyaltyPoint() {
  const { setSubtitle } = useTransaksiCrumb();

  // Settings state
  const [setting, setSetting] = useState({
    is_active: true,
    cara_mendapatkan: 'product',
    min_total_pemesanan: 0,
    point_diperoleh: 0,
    berlaku_kelipatan: false,
    default_poin_baru: 0,
    masa_aktif_nilai: 0,
    masa_aktif_satuan: 'pilih',
    berlaku_tipe_pelanggan: 'Semua',
    dapat_poin_saat_tebus: false,
  });

  // Redemptions state
  const [redemptions, setRedemptions] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPage, setGoToPage] = useState(1);

  // Modals state
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false);
  const [isRedemptionModalOpen, setIsRedemptionModalOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState(null);

  useEffect(() => {
    setSubtitle('Pengaturan Loyalty Point');
    fetchSettings();
    fetchRedemptions();
  }, [setSubtitle]);

  const fetchSettings = async () => {
    try {
      const res = await apiClient.get('/loyalty-point-settings/');
      // Endpoint bisa mengembalikan objek tunggal atau list — ambil yang pertama.
      const data = Array.isArray(res.data) ? res.data[0] : (res.data?.results?.[0] ?? res.data);
      if (data) setSetting(data);
    } catch (err) {
      console.error('Gagal mengambil pengaturan loyalty point:', err);
    }
  };

  const fetchRedemptions = async () => {
    try {
      const res = await apiClient.get('/loyalty-point-redemptions/');
      const data = res.data;
      setRedemptions(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Gagal mengambil daftar penukaran point:', err);
    }
  };

  // Save Settings
  const handleSaveSetting = async (updatedData) => {
    try {
      const res = setting.id
        ? await apiClient.put(`/loyalty-point-settings/${setting.id}/`, updatedData)
        : await apiClient.post('/loyalty-point-settings/', updatedData);
      setSetting(res.data);
      setIsSettingModalOpen(false);
    } catch (err) {
      console.error('Gagal menyimpan pengaturan:', err);
    }
  };

  // Save Redemption Item (Create / Edit)
  const handleSaveRedemption = async (formData) => {
    try {
      if (selectedRedemption) {
        await apiClient.put(`/loyalty-point-redemptions/${selectedRedemption.id}/`, formData);
      } else {
        await apiClient.post('/loyalty-point-redemptions/', formData);
      }
      await fetchRedemptions();
      setIsRedemptionModalOpen(false);
      setSelectedRedemption(null);
    } catch (err) {
      console.error('Gagal menyimpan penukaran point:', err);
    }
  };

  // Delete Redemption Item
  const handleDeleteRedemption = async (id) => {
    try {
      await apiClient.delete(`/loyalty-point-redemptions/${id}/`);
      await fetchRedemptions();
      setIsRedemptionModalOpen(false);
      setSelectedRedemption(null);
    } catch (err) {
      console.error('Gagal menghapus penukaran point:', err);
    }
  };

  // Default sample data if backend empty
  const displayRedemptions = redemptions.length > 0 ? redemptions : [
    { id: 'demo-1', besar_point: 0, tipe_diskon: '%', jumlah_diskon: 0, maksimal_jumlah_diskon: 0 }
  ];

  const totalPages = Math.max(1, Math.ceil(displayRedemptions.length / rowsPerPage));
  const paginatedRedemptions = displayRedemptions.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div className="flex-1 bg-slate-50/60 p-6 md:p-8 space-y-6 min-h-full">
      {/* SECTION 1: CARD LOYALTY POINT */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Loyalty Point</h2>
        <div className="flex items-center gap-3">
          {/* Status Mode Badge */}
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>
              {setting.cara_mendapatkan === 'product' ? 'Pembelian Product' : 'Total Pesanan'}
            </span>
          </div>

          {/* Settings Icon Button */}
          <button
            type="button"
            onClick={() => setIsSettingModalOpen(true)}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Pengaturan Loyalty Point"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* SECTION 2: CARD PENUKARAN POINT */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-base font-bold text-slate-800">Penukaran Point</h2>
          <button
            type="button"
            onClick={() => {
              setSelectedRedemption(null);
              setIsRedemptionModalOpen(true);
            }}
            className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={16} />
            <span>Tambah</span>
          </button>
        </div>

        {/* Rows Selector Dropdown (5 Baris, 10 Baris, 20 Baris) */}
        <div className="flex items-center">
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
          >
            <option value={5}>5 Baris</option>
            <option value={10}>10 Baris</option>
            <option value={20}>20 Baris</option>
          </select>
        </div>

        {/* List Penukaran Point */}
        <div className="space-y-3">
          {paginatedRedemptions.map((item) => {
            const diskonText =
              item.tipe_diskon === '%'
                ? `Diskon ${item.jumlah_diskon}%`
                : `Diskon Rp ${Number(item.jumlah_diskon || 0).toLocaleString('id-ID')}`;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-200/70 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  {/* Tag Icon Badge */}
                  <div className="w-10 h-10 rounded-xl bg-rose-100/70 flex items-center justify-center text-rose-500 shrink-0">
                    <Tag size={18} className="fill-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">{diskonText}</h3>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                      {item.besar_point} point
                    </p>
                  </div>
                </div>

                {/* Edit Pencil Icon */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRedemption(item);
                    setIsRedemptionModalOpen(true);
                  }}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Penukaran Point"
                >
                  <Pencil size={15} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-blue-600 px-2 py-0.5 bg-blue-50 rounded">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>Go to</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={goToPage}
              onChange={(e) => setGoToPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const p = Math.max(1, Math.min(totalPages, Number(goToPage) || 1));
                  setCurrentPage(p);
                }
              }}
              className="w-10 text-center text-xs font-semibold text-slate-700 border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* MODALS */}
      <LoyaltyPointSettingModal
        isOpen={isSettingModalOpen}
        onClose={() => setIsSettingModalOpen(false)}
        settingData={setting}
        onSave={handleSaveSetting}
      />

      <LoyaltyPointRedemptionModal
        isOpen={isRedemptionModalOpen}
        onClose={() => {
          setIsRedemptionModalOpen(false);
          setSelectedRedemption(null);
        }}
        redemptionItem={selectedRedemption}
        onSave={handleSaveRedemption}
        onDelete={handleDeleteRedemption}
      />
    </div>
  );
}
