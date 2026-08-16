import { useState, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export default function AccountingSecondarySidebar({ activeSubMenu, onSelectMenu }) {
  const { user } = useAuth();
  const isKasir = user?.role?.toLowerCase() === 'kasir';
  const [openDropdowns, setOpenDropdowns] = useState({
    jurnal: false,
    kasBank: false,
    transaksiPos: false,
    piutang: false,
    hutang: false,
    laporan: false,
    tutupBuku: false,
  });

  const [activeFlyoutId, setActiveFlyoutId] = useState(null);
  const timeoutRef = useRef(null);

  const handleMouseEnter = (id) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveFlyoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setActiveFlyoutId(null);
    }, 300);
  };

  const toggleDropdown = (key) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const navItems = [
    { id: 'settings', label: 'Pengaturan Akuntansi', isGroup: false },
    { id: 'coa', label: 'Daftar Akun', isGroup: false },
    {
      id: 'jurnal',
      label: 'Jurnal & Buku Besar',
      isGroup: true,
      subItems: [
        { id: 'jurnal-umum', label: 'Jurnal Umum' },
        { id: 'buku-besar', label: 'Buku Besar' },
      ],
    },
    {
      id: 'kasBank',
      label: 'Kas & Bank',
      isGroup: true,
      subItems: [
        { id: 'kas-bank-list', label: 'List Kas & Bank' },
        { id: 'cara-pembayaran', label: 'Cara Pembayaran' },
        { id: 'bank-statement', label: 'Bank Statement' },
        { id: 'rekonsiliasi-bank', label: 'Rekonsiliasi Bank' },
        { id: 'konfirmasi-settlement', label: 'Konfirmasi Settlement' },
        { id: 'harga-ojek-online', label: 'Harga Ojek Online' },
        { id: 'transfer-modal', label: 'Transfer Modal' },
      ],
    },
    {
      id: 'transaksiPos',
      label: 'Transaksi (POS)',
      isGroup: true,
      subItems: [
        {
          id: 'pos-penjualan',
          label: 'Penjualan',
          hasFlyout: true,
          flyoutItems: [
            { id: 'pos-penjualan-toko', label: 'Penjualan di Toko' },
            { id: 'pos-penjualan-marketplace', label: 'Penjualan Marketplace' },
          ],
        },
        { id: 'pos-pembelian', label: 'Pembelian' },
        {
          id: 'pos-pengembalian',
          label: 'Pengembalian',
          hasFlyout: true,
          flyoutItems: [
            { id: 'pos-return-pembelian', label: 'Return Pembelian' },
            { id: 'pos-return-penjualan', label: 'Return Penjualan' },
          ],
        },
        {
          id: 'pos-stok',
          label: 'Transaksi Stok',
          hasFlyout: true,
          flyoutItems: [
            { id: 'pos-stok-masuk', label: 'Stok Masuk' },
            { id: 'pos-stok-keluar', label: 'Stok Keluar' },
            { id: 'pos-stok-produksi', label: 'Produksi Stok' },
            { id: 'pos-stok-opname', label: 'Opname Stok' },
          ],
        },
        { id: 'pos-pendapatan', label: 'Pendapatan' },
        {
          id: 'pos-pengeluaran',
          label: 'Pengeluaran',
          hasFlyout: true,
          flyoutItems: [
            { id: 'pos-data-pengeluaran', label: 'Data Pengeluaran' },
            { id: 'pos-komisi-penjualan', label: 'Komisi Penjualan' },
            { id: 'pos-biaya-mdr', label: 'Biaya MDR' },
          ],
        },
      ],
    },
    {
      id: 'piutang',
      label: 'Piutang',
      isGroup: true,
      subItems: [
        { id: 'piutang-semua', label: 'Semua Piutang' },
        { id: 'piutang-jatuh-tempo', label: 'Pelanggan Jatuh Tempo' },
        { id: 'piutang-uang-muka', label: 'Uang Muka Pembelian' },
      ],
    },
    {
      id: 'hutang',
      label: 'Hutang',
      isGroup: true,
      subItems: [
        { id: 'hutang-semua', label: 'Semua Hutang' },
        // Disembunyikan dari kasir (instruksi user 2026-08-13) — kasir
        // tidak diizinkan ubah akun_hutang/jatuh_tempo supplier (backend
        // sudah menolak juga, lihat SupplierViewSet), jadi menu ini cuma
        // membingungkan kalau tetap tampil.
        ...(isKasir ? [] : [{ id: 'hutang-supplier', label: 'Pengaturan Supplier' }]),
        { id: 'hutang-simpanan-pelanggan', label: 'Simpanan Pelanggan' }
      ],
    },
    { id: 'aset', label: 'Aset', isGroup: false },
    { id: 'biaya', label: 'Biaya', isGroup: false },
    { id: 'invoice', label: 'Invoice', isGroup: false },
    { id: 'log-jurnal', label: 'Log Jurnal', isGroup: false },
    {
      id: 'laporan',
      label: 'Laporan Akuntansi',
      isGroup: true,
      subItems: [
        {
          id: 'laporan-laba-rugi',
          label: 'Laba Rugi',
          hasFlyout: true,
          flyoutItems: [
            { id: 'laporan-laba-rugi-satu-periode', label: 'Laba Rugi Satu Periode' },
            { id: 'laporan-laba-rugi-multi-periode', label: 'Laba Rugi Multi Periode' },
          ],
        },
        { id: 'laporan-neraca', label: 'Neraca' },
        { id: 'laporan-perubahan-modal', label: 'Perubahan Modal' },
        { id: 'laporan-arus-kas', label: 'Arus Kas' },
      ],
    },
    {
      id: 'tutupBuku',
      label: 'Tutup Buku',
      isGroup: true,
      subItems: [
        { id: 'tutup-buku-toko-ini', label: 'Toko ini' },
        { id: 'tutup-buku-toko-pusat-cabang', label: 'Toko pusat & cabang' },
      ],
    },
    { id: 'hak-akses', label: 'Penyesuaian Hak Akses', isGroup: false },
  ];

  return (
    <aside className="w-56 shrink-0 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm min-h-[580px] flex flex-col md:sticky md:top-6 self-start z-30">
      <nav className="space-y-0.5 text-xs font-medium">
        {navItems.map((item) => {
          if (!item.isGroup) {
            const isActive = activeSubMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMenu(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                  isActive
                    ? 'bg-[#E6F4FF] text-[#0088E8] font-bold shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          }

          const isOpen = openDropdowns[item.id];
          const hasActiveSub = item.subItems.some((s) => (
            s.id === activeSubMenu || s.flyoutItems?.some((fly) => fly.id === activeSubMenu)
          ));

          return (
            <div key={item.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleDropdown(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                  hasActiveSub
                    ? 'bg-sky-50 text-[#0088E8] font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{item.label}</span>
                {isOpen ? (
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="pl-3.5 pr-1 space-y-0.5 py-0.5">
                  {item.subItems.map((sub) => {
                    const isSubActive = activeSubMenu === sub.id;
                    const showFlyout = activeFlyoutId === sub.id;

                    if (sub.hasFlyout) {
                      return (
                        <div
                          key={sub.id}
                          className="relative"
                          onMouseEnter={() => handleMouseEnter(sub.id)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFlyoutId(activeFlyoutId === sub.id ? null : sub.id);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-all cursor-pointer flex items-center justify-between text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          >
                            <span>{sub.label}</span>
                            <span className="text-[8px] text-slate-400 font-extrabold shrink-0 ml-1 font-mono">
                              &gt;&gt;
                            </span>
                          </button>

                          {showFlyout && (
                            <div 
                              onMouseEnter={() => handleMouseEnter(sub.id)}
                              onMouseLeave={handleMouseLeave}
                              className="absolute left-full top-0 ml-1 z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 w-48 text-left font-bold animate-fade-in space-y-0.5"
                            >
                              {sub.flyoutItems.map((fly) => {
                                const isFlyActive = activeSubMenu === fly.id;
                                return (
                                  <button
                                    key={fly.id}
                                    type="button"
                                    onClick={() => {
                                      onSelectMenu(fly.id);
                                      setActiveFlyoutId(null);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors cursor-pointer hover:bg-slate-50 ${
                                      isFlyActive
                                        ? 'text-[#0088E8] bg-[#E6F4FF] font-bold'
                                        : 'text-slate-600 hover:text-slate-800'
                                    }`}
                                  >
                                    {fly.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onSelectMenu(sub.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-all cursor-pointer ${
                          isSubActive
                            ? 'bg-[#E6F4FF] text-[#0088E8] font-bold'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
