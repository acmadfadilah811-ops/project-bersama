import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TransaksiTopbar from '../../transaksi/components/TransaksiTopbar';
import { TransaksiProvider } from '../../transaksi/components/TransaksiContext';
import AccountingSecondarySidebar from '../components/AccountingSecondarySidebar';
import AccountingSettings from './AccountingSettings';
import DaftarAkun from './DaftarAkun';
import JurnalUmum from './JurnalUmum';
import BukuBesar from './BukuBesar';
import useAccountingSettings from '../hooks/useAccountingSettings';
import ListKasBank from './ListKasBank';
import CaraPembayaran from './CaraPembayaran';
import BankStatement from './BankStatement';
import RekonsiliasiBank from './RekonsiliasiBank';
import KonfirmasiSettlement from './KonfirmasiSettlement';
import TransferModal from './TransferModal';
import PosTransactions from './PosTransactions';
import PenjualanDiToko from './PenjualanDiToko';
import PenjualanMarketplace from './PenjualanMarketplace';
import Pembelian from './Pembelian';
import ReturPenjualan from './ReturPenjualan';
import ReturPembelian from './ReturPembelian';
import StokMasuk from './StokMasuk';
import StokKeluar from './StokKeluar';
import ProduksiStok from './ProduksiStok';
import OpnameStok from './OpnameStok';
import Pendapatan from './Pendapatan';
import Pengeluaran from './Pengeluaran';
import KomisiPenjualan from './KomisiPenjualan';
import BiayaMdr from './BiayaMdr';
import DaftarPiutang from './DaftarPiutang';
import PelangganJatuhTempo from './PelangganJatuhTempo';
import UangMukaPembelian from './UangMukaPembelian';
import SemuaHutang from './SemuaHutang';
import PengaturanSupplier from './PengaturanSupplier';
import SimpananPelanggan from './SimpananPelanggan';
import HutangJurnalTunggal from './HutangJurnalTunggal';
import HutangMultiJurnal from './HutangMultiJurnal';
import JurnalTunggal from './JurnalTunggal';
import MultiJurnal from './MultiJurnal';
import DaftarAset from './DaftarAset';
import DaftarBiaya from './DaftarBiaya';
import Invoice from './Invoice';
import LogJurnal from './LogJurnal';
import LabaRugiSatuPeriode from './LabaRugiSatuPeriode';
import LabaRugiMultiPeriode from './LabaRugiMultiPeriode';
import Neraca from './Neraca';
import PerubahanModal from './PerubahanModal';
import ArusKas from './ArusKas';
import TutupBukuTokoIni from './TutupBukuTokoIni';
import TutupBukuTokoPusatCabang from './TutupBukuTokoPusatCabang';
import PenyesuaianHakAkses from './PenyesuaianHakAkses';

export default function AccountingInternalApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeParam = searchParams.get('active') || 'setting';
  const accountingSettings = useAccountingSettings();
  const { settings, loading } = accountingSettings;

  const needsSetup = !loading && (!settings.initial_setup_completed_at || !settings.is_active);

  const mapParamToMenuId = (param) => {
    if (param === 'setting') return 'settings';
    if (param === 'asset') return 'aset';
    if (param === 'expense') return 'biaya';
    return param;
  };

  const mapMenuIdToParam = (id) => {
    if (id === 'settings') return 'setting';
    if (id === 'aset') return 'asset';
    if (id === 'biaya') return 'expense';
    return id;
  };

  const [activeSubMenu, setActiveSubMenu] = useState(mapParamToMenuId(activeParam));
  const [hideSidebar, setHideSidebar] = useState(false);

  useEffect(() => {
    const active = searchParams.get('active');
    const subMenu = searchParams.get('subMenu');
    if (active === 'receivable') {
      if (subMenu === 'jurnal-tunggal') {
        setActiveSubMenu('jurnal-tunggal');
      } else if (subMenu === 'multi-jurnal') {
        setActiveSubMenu('multi-jurnal');
      } else if (subMenu === 'receivableList' || subMenu === 'piutang-semua') {
        setActiveSubMenu('piutang-semua');
      } else if (subMenu === 'piutang-jatuh-tempo') {
        setActiveSubMenu('piutang-jatuh-tempo');
      } else if (subMenu === 'piutang-uang-muka') {
        setActiveSubMenu('piutang-uang-muka');
      } else {
        setActiveSubMenu('piutang-semua');
      }
    } else if (active === 'payable') {
      if (subMenu === 'jurnal-tunggal' || subMenu === 'hutang-jurnal-tunggal') {
        setActiveSubMenu('hutang-jurnal-tunggal');
      } else if (subMenu === 'multi-jurnal' || subMenu === 'hutang-multi-jurnal') {
        setActiveSubMenu('hutang-multi-jurnal');
      } else if (subMenu === 'payableList' || subMenu === 'hutang-semua') {
        setActiveSubMenu('hutang-semua');
      } else if (subMenu === 'hutang-supplier') {
        setActiveSubMenu('hutang-supplier');
      } else if (subMenu === 'hutang-simpanan-pelanggan') {
        setActiveSubMenu('hutang-simpanan-pelanggan');
      } else {
        setActiveSubMenu('hutang-semua');
      }
    } else if (active === 'asset' || active === 'aset') {
      if (subMenu === 'aset-tambah') {
        setActiveSubMenu('aset-tambah');
      } else {
        setActiveSubMenu('aset');
      }
    } else if (active === 'expense' || active === 'biaya') {
      setActiveSubMenu('biaya');
    } else if (active === 'laporan' || active === 'report') {
      if (subMenu) {
        setActiveSubMenu(subMenu);
      } else {
        setActiveSubMenu('laporan-laba-rugi-satu-periode');
      }
    } else if (active) {
      if (subMenu === 'aset-tambah') {
        setActiveSubMenu('aset-tambah');
      } else if (subMenu) {
        setActiveSubMenu(subMenu);
      } else {
        setActiveSubMenu(mapParamToMenuId(active));
      }
    }
  }, [searchParams]);

  const handleSelectMenu = (menuId) => {
    setActiveSubMenu(menuId);
    if (menuId.startsWith('piutang-')) {
      setSearchParams({ active: 'receivable', subMenu: menuId });
    } else if (menuId.startsWith('hutang-')) {
      setSearchParams({ active: 'payable', subMenu: menuId });
    } else if (menuId.startsWith('laporan-')) {
      setSearchParams({ active: 'laporan', subMenu: menuId });
    } else {
      setSearchParams({ active: mapMenuIdToParam(menuId) });
    }
  };

  return (
    <TransaksiProvider>
      <div className="min-h-screen bg-[#F4F7FE] font-sans flex flex-col">
        <TransaksiTopbar />

        {/* Main Workspace Body Below Top Bar */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col md:flex-row items-start gap-6 max-w-[1700px] w-full mx-auto">
          {/* Secondary Sub-Menu Sidebar Panel - Tampil hanya jika setup selesai dan aktif */}
          {!needsSetup && !hideSidebar && activeSubMenu !== 'jurnal-tunggal' && activeSubMenu !== 'multi-jurnal' && activeSubMenu !== 'hutang-jurnal-tunggal' && activeSubMenu !== 'hutang-multi-jurnal' && activeSubMenu !== 'aset-tambah' && (
            <AccountingSecondarySidebar
              activeSubMenu={activeSubMenu}
              onSelectMenu={handleSelectMenu}
            />
          )}

          {/* Main Workspace Area (Right Panel / Full Width) */}
          <main className="flex-1 w-full min-w-0">
            {activeSubMenu === 'settings' || needsSetup ? (
              <AccountingSettings accountingSettingsProps={accountingSettings} />
            ) : activeSubMenu === 'coa' ? (
              <DaftarAkun />
            ) : activeSubMenu === 'jurnal-umum' ? (
              <JurnalUmum onToggleSidebar={setHideSidebar} />
            ) : activeSubMenu === 'buku-besar' ? (
              <BukuBesar onToggleSidebar={setHideSidebar} />
            ) : activeSubMenu === 'kas-bank-list' ? (
              <ListKasBank onToggleSidebar={setHideSidebar} initialViewState="list" />
            ) : activeSubMenu === 'transfer-kas' ? (
              <ListKasBank onToggleSidebar={setHideSidebar} initialViewState="transfer" />
            ) : activeSubMenu === 'cara-pembayaran' ? (
              <CaraPembayaran />
            ) : activeSubMenu === 'bank-statement' ? (
              <BankStatement />
            ) : activeSubMenu === 'rekonsiliasi-bank' ? (
              <RekonsiliasiBank />
            ) : activeSubMenu === 'konfirmasi-settlement' ? (
              <KonfirmasiSettlement />
            ) : activeSubMenu === 'transfer-modal' ? (
              <TransferModal />
            ) : activeSubMenu === 'pos-penjualan-toko' ? (
              <PenjualanDiToko />
            ) : activeSubMenu === 'pos-penjualan-marketplace' ? (
              <PenjualanMarketplace />
            ) : activeSubMenu === 'pos-pembelian' ? (
              <Pembelian />
            ) : activeSubMenu === 'pos-return-penjualan' ? (
              <ReturPenjualan />
            ) : activeSubMenu === 'pos-return-pembelian' ? (
              <ReturPembelian />
            ) : activeSubMenu === 'pos-stok-masuk' ? (
              <StokMasuk />
            ) : activeSubMenu === 'pos-stok-keluar' ? (
              <StokKeluar />
            ) : activeSubMenu === 'pos-stok-produksi' ? (
              <ProduksiStok />
            ) : activeSubMenu === 'pos-stok-opname' ? (
              <OpnameStok />
            ) : activeSubMenu === 'pos-pendapatan' ? (
              <Pendapatan />
            ) : activeSubMenu === 'pos-data-pengeluaran' ? (
              <Pengeluaran />
            ) : activeSubMenu === 'pos-komisi-penjualan' ? (
              <KomisiPenjualan />
            ) : activeSubMenu === 'pos-biaya-mdr' ? (
              <BiayaMdr />
            ) : activeSubMenu === 'piutang-semua' ? (
              <DaftarPiutang initialFilter="Semua Piutang" />
            ) : activeSubMenu === 'piutang-jatuh-tempo' ? (
              <PelangganJatuhTempo />
            ) : activeSubMenu === 'piutang-uang-muka' ? (
              <UangMukaPembelian />
            ) : activeSubMenu === 'hutang-semua' ? (
              <SemuaHutang />
            ) : activeSubMenu === 'hutang-supplier' ? (
              <PengaturanSupplier />
            ) : activeSubMenu === 'hutang-simpanan-pelanggan' ? (
              <SimpananPelanggan />
            ) : activeSubMenu === 'hutang-jurnal-tunggal' ? (
              <HutangJurnalTunggal />
            ) : activeSubMenu === 'hutang-multi-jurnal' ? (
              <HutangMultiJurnal />
            ) : activeSubMenu === 'jurnal-tunggal' ? (
              <JurnalTunggal />
            ) : activeSubMenu === 'multi-jurnal' ? (
              <MultiJurnal />
            ) : activeSubMenu === 'aset' || activeSubMenu === 'asset' || activeSubMenu === 'aset-tambah' ? (
              <DaftarAset />
            ) : activeSubMenu === 'biaya' || activeSubMenu === 'expense' ? (
              <DaftarBiaya />
            ) : activeSubMenu === 'invoice' ? (
              <Invoice />
            ) : activeSubMenu === 'log-jurnal' || activeSubMenu === 'log' ? (
              <LogJurnal />
            ) : activeSubMenu === 'laporan-laba-rugi-satu-periode' || activeSubMenu === 'laporan-laba-rugi' ? (
              <LabaRugiSatuPeriode />
            ) : activeSubMenu === 'laporan-laba-rugi-multi-periode' ? (
              <LabaRugiMultiPeriode />
            ) : activeSubMenu === 'laporan-neraca' ? (
              <Neraca />
            ) : activeSubMenu === 'laporan-perubahan-modal' ? (
              <PerubahanModal />
            ) : activeSubMenu === 'laporan-arus-kas' ? (
              <ArusKas />
            ) : activeSubMenu === 'tutup-buku-toko-ini' || activeSubMenu === 'tutup-buku-bulanan' || activeSubMenu === 'tutupBuku' ? (
              <TutupBukuTokoIni />
            ) : activeSubMenu === 'tutup-buku-toko-pusat-cabang' || activeSubMenu === 'tutup-buku-tahunan' ? (
              <TutupBukuTokoPusatCabang />
            ) : activeSubMenu === 'hak-akses' || activeSubMenu === 'penyesuaian-hak-akses' || activeParam === 'permission' ? (
              <PenyesuaianHakAkses />
            ) : activeSubMenu.startsWith('pos-') ? (
              <PosTransactions activeSubMenu={activeSubMenu} />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
                <p className="text-base font-bold text-slate-700 mb-1">
                  Modul {activeSubMenu.replace('-', ' ').toUpperCase()}
                </p>
                <p className="text-xs">
                  Halaman ini sedang dalam siklus pengembangan bertahap.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </TransaksiProvider>
  );
}

