import { useState, useEffect } from 'react';
import PosHeader from '../components/pos/PosHeader';
import PosTable from '../components/pos/PosTable';
import apiClient from '../../../api/apiClient';
import { Loader2 } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function PosTransactions({ activeSubMenu }) {
  const today = new Date().toISOString().split('T')[0];
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  const getSubMenuTitle = () => {
    switch (activeSubMenu) {
      case 'pos-penjualan-toko':
        return 'Penjualan di Toko (POS)';
      case 'pos-penjualan-marketplace':
        return 'Penjualan Marketplace';
      default:
        return 'Transaksi POS & Penjualan Toko';
    }
  };

  const fetchPosSales = async () => {
    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        search: searchKeyword,
      };
      const res = await apiClient.get('/pos/sales/', { params });
      const data = res.data.results || res.data || [];
      const formatted = data.map((item) => ({
        id: item.id,
        date: item.waktu_transaksi ? item.waktu_transaksi.split('T')[0] : item.tanggal,
        refNo: item.nomor,
        description: `Penjualan Kasir POS (${item.metode_pembayaran_detail?.nama || 'Kas/Non-Tunai'})`,
        amount: Number(item.total || 0),
        status: item.settlement_status === 'settled' ? 'Tersinkronisasi' : (item.status === 'void' ? 'Void/Batal' : 'Terposting'),
      }));
      setSales(formatted);
    } catch (err) {
      console.error('Gagal memuat transaksi POS:', err);
      notify({
        type: 'error',
        title: 'Gagal Memuat Data',
        message: 'Gagal mengambil data transaksi POS dari server.',
      });
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosSales();
  }, [dateFrom, dateTo, searchKeyword]);

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <PosHeader
        title={getSubMenuTitle()}
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
      />

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0088E8]" />
          <span className="text-slate-500 font-bold">Memuat transaksi POS riil...</span>
        </div>
      ) : (
        <PosTable
          data={sales}
          formatIDR={formatIDR}
        />
      )}
    </div>
  );
}
