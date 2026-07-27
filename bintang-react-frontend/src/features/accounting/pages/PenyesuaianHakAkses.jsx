import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MoreVertical,
  RotateCcw,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';

// INITIAL PERMISSION STRUCTURE
const INITIAL_MODULES = [
  {
    id: 'pengaturan-akuntansi',
    title: 'Pengaturan Akuntansi',
    checked: true,
    columns: [
      [
        { id: 'view_pengaturan_akuntansi', label: 'Menampilkan Halaman Pengaturan Akuntansi', checked: true },
      ],
    ],
  },
  {
    id: 'daftar-akun',
    title: 'Daftar Akun',
    checked: true,
    columns: [
      [
        { id: 'view_daftar_akun', label: 'Menampilkan Daftar Akun', checked: true },
        { id: 'add_daftar_akun', label: 'Tambah Akun', checked: true },
        { id: 'delete_daftar_akun', label: 'Hapus Akun', checked: true },
        { id: 'view_detail_daftar_akun', label: 'Menampilkan Detail Akun', checked: true },
        { id: 'edit_daftar_akun', label: 'Edit Akun', checked: true },
        { id: 'export_excel_detail_akun', label: 'Mengekspor Excel Detail Transaksi Akun', checked: true },
        { id: 'export_pdf_detail_akun', label: 'Mengekspor PDF Detail Transaksi Akun', checked: true },
        { id: 'view_detail_transaksi_akun', label: 'Menampilkan Detail Transaksi Akun', checked: true },
      ],
      [],
      [
        { id: 'saldo_awal_akun', label: 'Saldo awal', checked: true },
      ],
    ],
  },
  {
    id: 'jurnal-buku-besar',
    title: 'Jurnal x Buku Besar',
    checked: true,
    columns: [
      [
        { id: 'jurnal_umum', label: 'Jurnal Umum', checked: true },
        { id: 'delete_jurnal_umum', label: 'Hapus Transaksi di Jurnal Umum', checked: true },
        { id: 'edit_jurnal_umum', label: 'Edit Jurnal di Jurnal Umum', checked: true },
        { id: 'export_jurnal_umum', label: 'Ekspor Data Jurnal di Jurnal Umum', checked: true },
        { id: 'import_jurnal_umum', label: 'Impor Data Jurnal di Jurnal Umum', checked: true },
      ],
      [
        { id: 'view_buku_besar', label: 'Menampilkan Daftar Buku Besar', checked: true },
        { id: 'export_buku_besar', label: 'Ekspor Daftar Buku Besar', checked: true },
        { id: 'export_excel_buku_besar', label: 'Ekspor Excel Daftar Buku Besar', checked: true },
        { id: 'export_pdf_buku_besar', label: 'Ekspor PDF Daftar Buku Besar', checked: true },
      ],
    ],
  },
  {
    id: 'kas-bank',
    title: 'Kas dan Bank',
    checked: true,
    columns: [
      [
        { id: 'list_kas_bank', label: 'List Kas & Bank', checked: true },
        { id: 'transfer_kas', label: 'Transfer Kas', checked: true },
        { id: 'view_rekonsiliasi', label: 'Menampilkan Daftar Rekonsiliasi Bank', checked: true },
        { id: 'view_detail_rekonsiliasi', label: 'Menampilkan Detail Rekonsiliasi Bank', checked: true },
        { id: 'view_transfer_modal', label: 'Menampilkan Daftar Transfer Modal', checked: true },
        { id: 'add_transfer_modal', label: 'Tambah Transfer Modal', checked: true },
        { id: 'delete_transfer_modal', label: 'Hapus Transfer Modal', checked: true },
      ],
      [
        { id: 'view_cara_pembayaran', label: 'Menampilkan Daftar Cara Pembayaran', checked: true },
        { id: 'atur_akun_kas', label: 'Atur Akun', checked: true },
        { id: 'view_konfirmasi_settlement', label: 'Menampilkan Daftar Konfirmasi Transaksi (Konfirmasi Settlement)', checked: true },
        { id: 'do_konfirmasi_settlement', label: 'Melakukan Konfirmasi Transaksi (Konfirmasi Settlement)', checked: true },
      ],
      [
        { id: 'view_mutasi_bank', label: 'Menampilkan Daftar Mutasi (Bank Statement)', checked: true },
        { id: 'delete_mutasi_bank', label: 'Hapus Mutasi (Bank Statement)', checked: true },
        { id: 'import_mutasi_bank', label: 'Impor Data Mutasi (Bank Statement)', checked: true },
        { id: 'view_harga_ojol', label: 'Menampilkan Daftar Harga Ojek Online', checked: true },
        { id: 'confirm_harga_ojol', label: 'Konfirmasi Harga Ojek Online', checked: true },
        { id: 'setting_harga_ojol', label: 'Pengaturan Harga Ojek Online', checked: true },
      ],
    ],
  },
  {
    id: 'transaksi-pos',
    title: 'Transaksi (POS)',
    checked: true,
    columns: [
      [
        { id: 'pos_penjualan', label: 'Penjualan', checked: true },
        { id: 'cancel_pos_penjualan', label: 'Membatalkan Transaksi Penjualan', checked: true },
        { id: 'default_account_pos', label: 'Mengatur Akun Default', checked: true },
        { id: 'post_pos_penjualan', label: 'Posting Transaksi Penjualan', checked: true },
        { id: 'schedule_post_pos', label: 'Mengatur Penjadwalan Posting', checked: true },
        { id: 'stok_masuk', label: 'Stok Masuk', checked: true },
        { id: 'cancel_stok', label: 'Membatalkan Stok Masuk dan Stok Keluar', checked: true },
        { id: 'post_stok_masuk', label: 'Posting Stok Masuk', checked: true },
        { id: 'setting_stok_masuk', label: 'Pengaturan Stok Masuk', checked: true },
      ],
      [
        { id: 'pos_pembelian', label: 'Pembelian', checked: true },
        { id: 'cancel_pos_pembelian', label: 'Membatalkan Transaksi Pembelian', checked: true },
        { id: 'post_pos_pembelian', label: 'Posting Transaksi Pembelian', checked: true },
        { id: 'stok_keluar', label: 'Stok Keluar', checked: true },
        { id: 'post_stok_keluar', label: 'Posting Stok Keluar', checked: true },
        { id: 'setting_stok_keluar', label: 'Pengaturan Stok Keluar', checked: true },
      ],
      [
        { id: 'pos_retur_penjualan', label: 'Retur Penjualan', checked: true },
        { id: 'cancel_pos_retur', label: 'Membatalkan Transaksi Retur Penjualan', checked: true },
        { id: 'post_pos_retur', label: 'Posting Transaksi Retur Penjualan', checked: true },
        { id: 'pos_pendapatan', label: 'Pendapatan', checked: true },
        { id: 'cancel_pendapatan', label: 'Membatalkan Pendapatan', checked: true },
        { id: 'post_pendapatan_pengeluaran', label: 'Posting Pendapatan dan Pengeluaran', checked: true },
        { id: 'setting_type_pendapatan', label: 'Pengaturan Tipe Transaksi Pendapatan dan Pengeluaran', checked: true },
        { id: 'pos_pengeluaran', label: 'Pengeluaran', checked: true },
      ],
    ],
  },
  {
    id: 'piutang',
    title: 'Piutang',
    checked: true,
    columns: [
      [
        { id: 'semua_piutang', label: 'Semua Piutang', checked: true },
        { id: 'terima_piutang', label: 'Terima Piutang', checked: true },
        { id: 'detail_piutang', label: 'Menampilkan Detail Piutang', checked: true },
        { id: 'excel_piutang', label: 'Ekspor Excel Data Piutang', checked: true },
        { id: 'pdf_piutang', label: 'Ekspor PDF Data Piutang', checked: true },
      ],
      [
        { id: 'piutang_jatuh_tempo', label: 'Pelanggan Jatuh Tempo', checked: true },
        { id: 'edit_piutang_jatuh_tempo', label: 'Edit Pelanggan Jatuh Tempo', checked: true },
      ],
    ],
  },
  {
    id: 'hutang',
    title: 'Hutang',
    checked: true,
    columns: [
      [
        { id: 'semua_hutang', label: 'Semua Hutang', checked: true },
        { id: 'terima_hutang', label: 'Terima Hutang', checked: true },
        { id: 'detail_hutang', label: 'Menampilkan Detail Hutang', checked: true },
        { id: 'excel_hutang', label: 'Ekspor Excel Data Hutang', checked: true },
        { id: 'pdf_hutang', label: 'Ekspor PDF Data Hutang', checked: true },
      ],
      [
        { id: 'supplier_jatuh_tempo', label: 'Supplier Jatuh Tempo', checked: true },
        { id: 'edit_supplier_jatuh_tempo', label: 'Edit Supplier Jatuh Tempo', checked: true },
      ],
      [
        { id: 'deposit_pelanggan', label: 'Deposit Pelanggan (Simpanan Pelanggan)', checked: true },
        { id: 'export_deposit_pelanggan', label: 'Ekspor Data Deposit Pelanggan (Simpanan Pelanggan)', checked: true },
      ],
    ],
  },
  {
    id: 'asset',
    title: 'Asset',
    checked: true,
    columns: [
      [
        { id: 'asset_list', label: 'Asset', checked: true },
        { id: 'penyusutan_asset', label: 'Penyusutan Asset', checked: true },
        { id: 'edit_asset', label: 'Edit Asset', checked: true },
      ],
      [
        { id: 'add_asset', label: 'Tambah Asset', checked: true },
        { id: 'detail_penyusutan_asset', label: 'Menampilkan Detail Penyusutan Asset', checked: true },
        { id: 'export_asset', label: 'Ekspor Data Asset', checked: true },
      ],
      [
        { id: 'delete_asset', label: 'Delete Asset', checked: true },
        { id: 'detail_asset', label: 'Menampilkan Detail Asset', checked: true },
      ],
    ],
  },
  {
    id: 'biaya',
    title: 'Biaya',
    checked: true,
    columns: [
      [
        { id: 'view_biaya', label: 'Menampilkan Daftar Biaya', checked: true },
      ],
    ],
  },
  {
    id: 'invoice',
    title: 'Invoice',
    checked: true,
    columns: [
      [
        { id: 'view_invoice', label: 'Menampilkan Daftar Invoice', checked: true },
      ],
      [
        { id: 'detail_invoice', label: 'Menampilkan Detail Invoice', checked: true },
      ],
      [
        { id: 'pdf_invoice', label: 'Ekspor PDF Detail Invoice', checked: true },
      ],
    ],
  },
  {
    id: 'log-jurnal',
    title: 'Log Jurnal',
    checked: true,
    columns: [
      [
        { id: 'view_log_jurnal', label: 'Menampilkan Daftar Log Jurnal', checked: true },
      ],
      [
        { id: 'detail_deskripsi_log', label: 'Menampilkan Detail Deskripsi Log Jurnal', checked: true },
      ],
      [
        { id: 'detail_log_jurnal', label: 'Menampilkan Detail Log Jurnal', checked: true },
      ],
    ],
  },
  {
    id: 'laporan-akuntansi',
    title: 'Laporan Akuntansi',
    checked: true,
    columns: [
      [
        { id: 'laba_rugi', label: 'Laporan Laba Rugi', checked: true },
        { id: 'excel_laba_rugi', label: 'Ekspor Excel Laporan Laba Rugi', checked: true },
        { id: 'pdf_laba_rugi', label: 'Ekspor PDF Laporan Laba Rugi', checked: true },
        { id: 'detail_pasangan_jurnal', label: 'Menampilkan Detail Pasangan Jurnal di Laporan Laba Rugi dan Neraca, dan Laporan Arus Kas', checked: true },
        { id: 'apply_payment_detail', label: 'Menerapkan Pembayaran di Detail Laporan Laba Rugi dan Neraca', checked: true },
        { id: 'view_detail_laba_rugi', label: 'Menampilkan Detail Laporan Laba Rugi dan Neraca', checked: true },
        { id: 'excel_detail_laba_rugi', label: 'Ekspor Excel Detail Laporan Laba Rugi', checked: true },
        { id: 'pdf_detail_laba_rugi', label: 'Ekspor PDF Detail Laporan Laba Rugi', checked: true },
        { id: 'laporan_arus_kas', label: 'Laporan Arus Kas', checked: true },
        { id: 'detail_arus_kas', label: 'Menampilkan Detail Laporan Arus Kas', checked: true },
        { id: 'pdf_arus_kas', label: 'Ekspor PDF Laporan Arus Kas', checked: true },
      ],
      [
        { id: 'neraca', label: 'Neraca', checked: true },
      ],
      [
        { id: 'perubahan_modal', label: 'Laporan Perubahan Modal', checked: true },
        { id: 'pdf_perubahan_modal', label: 'Ekspor PDF Laporan Perubahan Modal', checked: true },
      ],
    ],
  },
  {
    id: 'tutup-buku',
    title: 'Tutup Buku',
    checked: true,
    columns: [
      [
        { id: 'view_tutup_buku', label: 'Menampilkan Daftar Tutup Buku', checked: true },
        { id: 'detail_tutup_buku', label: 'Menampilkan Detail Tutup Buku', checked: true },
      ],
      [
        { id: 'do_tutup_buku', label: 'Melakukan Tutup Buku', checked: true },
      ],
      [
        { id: 'delete_tutup_buku', label: 'Menghapus Tutup Buku', checked: true },
      ],
    ],
  },
  {
    id: 'jurnal',
    title: 'Jurnal',
    checked: true,
    columns: [
      [
        { id: 'add_jurnal_tunggal', label: 'Tambah Jurnal (Form Jurnal Tunggal)', checked: true },
        { id: 'delete_jurnal', label: 'Hapus Jurnal', checked: true },
      ],
      [
        { id: 'add_multi_jurnal', label: 'Tambah Jurnal (Form Multi Jurnal)', checked: true },
        { id: 'import_data_jurnal', label: 'Impor Data Journal', checked: true },
      ],
      [
        { id: 'pasangan_jurnal', label: 'Pasangan Jurnal', checked: true },
      ],
    ],
  },
];

const ROLES = ['Supervisor', 'Manager', 'Kasir', 'Admin'];

export default function PenyesuaianHakAkses() {
  const [selectedRole, setSelectedRole] = useState('Supervisor');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const moreMenuRef = useRef(null);

  const [modules, setModules] = useState(INITIAL_MODULES);
  const [expandedModules, setExpandedModules] = useState(() => {
    const initialExp = {};
    INITIAL_MODULES.forEach((m) => {
      initialExp[m.id] = false;
    });
    return initialExp;
  });

  const [loading, setLoading] = useState(false);

  // Outside click listener for More Menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch permissions for selected role
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      await apiClient.get('/auth/user-profile/', { params: { role: selectedRole } }).catch(() => null);
    } catch (err) {
      console.error('Gagal memuat hak akses:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Toggle single module collapse/expand
  const toggleModuleExpand = (modId) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  // Toggle Expand / Minimize All (Fitur dari Titik 3)
  const handleToggleExpandAll = () => {
    const newExpandState = !isAllExpanded;
    setIsAllExpanded(newExpandState);

    const updated = {};
    modules.forEach((m) => {
      updated[m.id] = newExpandState;
    });
    setExpandedModules(updated);
    setIsMoreMenuOpen(false);
  };

  // Muat Ulang (Fitur dari Titik 3)
  const handleReload = () => {
    fetchPermissions();
    setIsMoreMenuOpen(false);
  };

  // Toggle main module checkbox (checks/unchecks all inner permissions)
  const toggleMainModuleCheckbox = (modId, checkedState) => {
    setModules((prevModules) =>
      prevModules.map((mod) => {
        if (mod.id !== modId) return mod;
        const newCols = mod.columns.map((col) =>
          col.map((item) => ({ ...item, checked: checkedState }))
        );
        return {
          ...mod,
          checked: checkedState,
          columns: newCols,
        };
      })
    );
  };

  // Toggle individual permission checkbox
  const toggleSinglePermission = (modId, permId) => {
    setModules((prevModules) =>
      prevModules.map((mod) => {
        if (mod.id !== modId) return mod;

        let hasAnyUnchecked = false;
        const newCols = mod.columns.map((col) =>
          col.map((item) => {
            if (item.id === permId) {
              const newCheck = !item.checked;
              if (!newCheck) hasAnyUnchecked = true;
              return { ...item, checked: newCheck };
            }
            if (!item.checked) hasAnyUnchecked = true;
            return item;
          })
        );

        return {
          ...mod,
          checked: !hasAnyUnchecked,
          columns: newCols,
        };
      })
    );
  };

  return (
    <div className="space-y-2 font-sans text-slate-800 pb-12">
      {/* HEADER CARD ATAS WITH ROLE DROPDOWN & THREE DOTS (⋮) MENU (TANPA TOMBOL BATAL & SIMPAN) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-4">
        {/* KIRI: ROLE SELECTOR DROPDOWN */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#0088E8] hover:bg-sky-600 text-white rounded-full font-bold text-xs shadow-2xs transition-all cursor-pointer"
          >
            <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center font-black text-[10px]">
              ▾
            </div>
            <span>{selectedRole}</span>
          </button>

          {isRoleDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-xl p-1 animate-fade-in space-y-0.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r);
                    setIsRoleDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                    selectedRole === r
                      ? 'bg-sky-50 text-[#0088E8] font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{r}</span>
                  {selectedRole === r && <Check size={14} className="text-[#0088E8]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* KANAN: TITIK TIGA (⋮) DROPDOWN MENU */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Opsi Lainnya"
          >
            <MoreVertical size={16} />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1 animate-fade-in space-y-0.5">
              {/* OPSI 1: MUAT ULANG */}
              <button
                type="button"
                onClick={handleReload}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw size={13} className="text-slate-500" />
                <span>Muat ulang</span>
              </button>

              {/* OPSI 2: EXPAND / MINIMIZE */}
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                {isAllExpanded ? (
                  <>
                    <Minimize2 size={13} className="text-slate-500" />
                    <span>Minimize</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={13} className="text-slate-500" />
                    <span>Expand</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BODY ACCORDIONS LIST (COMPACT SPACING & RATAP) */}
      <div className="space-y-1.5">
        {modules.map((mod) => {
          const isExpanded = expandedModules[mod.id] === true;

          return (
            <div
              key={mod.id}
              className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all"
            >
              {/* HEADER ACCORDION BARIS MODUL */}
              <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100 bg-white">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={mod.checked}
                    onChange={(e) => toggleMainModuleCheckbox(mod.id, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    {mod.title}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => toggleModuleExpand(mod.id)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer transition-transform"
                >
                  {isExpanded ? (
                    <ChevronDown size={15} />
                  ) : (
                    <ChevronRight size={15} />
                  )}
                </button>
              </div>

              {/* BODY ISI MODUL (EXPANDABLE COMPACT) */}
              {isExpanded && (
                <div className="p-3 bg-[#F8FAFC]/50 border-t border-slate-100 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                    {mod.columns.map((col, cIdx) => (
                      <div key={cIdx} className="space-y-2">
                        {col.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-2 cursor-pointer select-none hover:opacity-85"
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => toggleSinglePermission(mod.id, item.id)}
                              className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8] cursor-pointer shrink-0"
                            />
                            <span className="text-[11px] font-medium text-slate-700 leading-snug">
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
