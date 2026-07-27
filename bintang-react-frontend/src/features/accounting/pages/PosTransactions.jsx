import { useState } from 'react';
import PosHeader from '../components/pos/PosHeader';
import PosTable from '../components/pos/PosTable';

export default function PosTransactions({ activeSubMenu }) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');

  // Map subMenu to human readable title
  const getSubMenuTitle = () => {
    switch (activeSubMenu) {
      case 'pos-penjualan-toko':
        return 'Penjualan di Toko';
      case 'pos-penjualan-marketplace':
        return 'Penjualan Marketplace';
      case 'pos-pembelian':
        return 'Pembelian';
      case 'pos-return-pembelian':
        return 'Return Pembelian';
      case 'pos-return-penjualan':
        return 'Return Penjualan';
      case 'pos-stok-masuk':
        return 'Stok Masuk';
      case 'pos-stok-keluar':
        return 'Stok Keluar';
      case 'pos-stok-produksi':
        return 'Produksi Stok';
      case 'pos-stok-opname':
        return 'Opname Stok';
      case 'pos-pendapatan':
        return 'Pendapatan';
      case 'pos-data-pengeluaran':
        return 'Data Pengeluaran';
      case 'pos-komisi-penjualan':
        return 'Komisi Penjualan';
      case 'pos-biaya-mdr':
        return 'Biaya MDR';
      default:
        return 'Transaksi POS';
    }
  };

  // Mock POS data records
  const mockPosData = [
    { id: 1, date: '2026-07-26', refNo: 'POS-TX-260726001', description: 'Transaksi kasir pusat harian', amount: 890000, status: 'Tersinkronisasi' },
    { id: 2, date: '2026-07-26', refNo: 'POS-TX-260726002', description: 'Penjualan ojek online partner', amount: 450000, status: 'Tersinkronisasi' },
    { id: 3, date: '2026-07-26', refNo: 'POS-TX-260726003', description: 'Pembayaran order e-commerce Tokopedia', amount: 1200000, status: 'Tersinkronisasi' },
  ];

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filter mock data by keyword & date
  const filteredData = mockPosData.filter((row) => {
    const rowDate = new Date(row.date);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const matchesDate = rowDate >= from && rowDate <= to;
    
    const matchesKeyword = searchKeyword.trim() === '' ||
      row.refNo.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      row.description.toLowerCase().includes(searchKeyword.toLowerCase());

    return matchesDate && matchesKeyword;
  });

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

      <PosTable
        data={filteredData}
        formatIDR={formatIDR}
      />
    </div>
  );
}
