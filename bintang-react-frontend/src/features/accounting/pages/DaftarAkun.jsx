import { useState, useEffect, useRef } from 'react';
import { Settings, Plus, ChevronLeft, ChevronRight, Filter, ChevronDown, ChevronUp, X, MoreHorizontal, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import FilterAkunModal from '../components/FilterAkunModal';
import SesuaikanSaldoAwalModal from '../components/SesuaikanSaldoAwalModal';
import TambahAkunModal from '../components/TambahAkunModal';
import UbahAkunModal from '../components/UbahAkunModal';
import HapusAkunModal from '../components/HapusAkunModal';
import RincianMutasiAkun from './RincianMutasiAkun';

export default function DaftarAkun() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingAccountId, setViewingAccountId] = useState(null);
  
  // Date/Period Navigation
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Ambil start date dari settings akuntansi untuk menyesuaikan bulan default secara dinamis
  useEffect(() => {
    apiClient
      .get('/accounting/settings/')
      .then((res) => {
        if (res.data?.accounting_start_date) {
          const parts = res.data.accounting_start_date.split('-');
          if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed
            setCurrentDate(new Date(year, month, 1));
          }
        }
      })
      .catch(() => {});
  }, []);
  
  // Alert banner states
  const [showAlert, setShowAlert] = useState(() => {
    return localStorage.getItem('hide_purchase_alert') !== 'true';
  });
  const [expandAlert, setExpandAlert] = useState(true);

  // Modal open states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSaldoAwalOpen, setIsSaldoAwalOpen] = useState(false);
  const [isTambahOpen, setIsTambahOpen] = useState(false);
  const [isUbahOpen, setIsUbahOpen] = useState(false);
  const [isHapusOpen, setIsHapusOpen] = useState(false);

  // Selected states for edit/delete
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Filter params state
  const [filters, setFilters] = useState({
    search: '',
    saldo: '',
    excludeZero: false,
  });

  // Aksi dropdown state
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  // Pagination state
  const [displayCount, setDisplayCount] = useState(15);

  const getPeriodString = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getMonthYearLabel = (dateObj) => {
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const fetchAccounts = () => {
    setLoading(true);
    const period = getPeriodString(currentDate);
    const params = {
      period,
      search: filters.search,
      exclude_zero: filters.excludeZero ? 'true' : 'false',
    };
    if (filters.saldo !== '' && filters.saldo !== null) {
      params.saldo = filters.saldo;
    }

    apiClient
      .get('/accounting/accounts/', { params })
      .then((res) => {
        setAccounts(res.data || []);
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat daftar akun'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();
  }, [currentDate, filters]);

  // Click outside listener for action dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDismissAlert = () => {
    localStorage.setItem('hide_purchase_alert', 'true');
    setShowAlert(false);
  };

  // Format currency: 1000000 -> 1.000.000,00
  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleApplyFilter = (newFilters) => {
    setFilters(newFilters);
    setDisplayCount(15); // Reset display pagination
  };

  if (viewingAccountId) {
    return (
      <RincianMutasiAkun
        accountId={viewingAccountId}
        onBack={() => setViewingAccountId(null)}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Top Header Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Tombol Filter */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-350 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs transition-colors"
          >
            <Filter size={13} />
            <span>Filter</span>
          </button>

          {/* Month/Year Selector */}
          <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs relative">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer border-r border-slate-200"
            >
              <ChevronLeft size={14} />
            </button>
            <div
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="px-4 py-1.5 text-xs font-bold text-slate-700 min-w-32 text-center select-none cursor-pointer hover:bg-slate-50 flex items-center justify-center gap-1"
            >
              <span>{getMonthYearLabel(currentDate)}</span>
              <ChevronDown size={12} className="text-slate-450 shrink-0" />
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer border-l border-slate-200"
            >
              <ChevronRight size={14} />
            </button>

            {/* Month Picker Dropdown */}
            {showMonthPicker && (
              <div className="absolute top-full left-0 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 grid grid-cols-3 gap-1">
                {/* Year Selection Controls */}
                <div className="col-span-3 flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span className="text-xs font-bold text-slate-700">{currentDate.getFullYear()}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>

                {/* 12 Months selection buttons */}
                {Array.from({ length: 12 }, (_, i) => {
                  const mName = new Date(2026, i, 1).toLocaleDateString('id-ID', { month: 'short' });
                  const isSelected = currentDate.getMonth() === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentDate(new Date(currentDate.getFullYear(), i, 1));
                        setShowMonthPicker(false);
                      }}
                      className={`py-1.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#0088E8] text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {mName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Gear icon button */}
          <button
            type="button"
            onClick={() => setIsSaldoAwalOpen(true)}
            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors shadow-2xs"
            title="Sesuaikan Saldo Awal"
          >
            <Settings size={14} />
          </button>
          
          {/* Tambah Akun button */}
          <button
            type="button"
            onClick={() => setIsTambahOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs cursor-pointer shadow-2xs transition-colors"
          >
            <Plus size={14} />
            <span>Tambah Akun</span>
          </button>
        </div>
      </div>

      {/* Info Alert Banner */}
      {showAlert && (
        <div className="bg-[#FFF9E6] border border-[#FFE7A3] rounded-xl p-4 text-xs relative text-[#8F6B00]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded-full bg-[#E2B100] text-white text-center font-extrabold text-[10px] leading-4">i</span>
                Sudah terdapat fitur purchase order dan purchase invoice.
              </span>
              <button
                type="button"
                onClick={() => setExpandAlert(!expandAlert)}
                className="text-sky-600 hover:text-sky-700 font-bold underline flex items-center gap-0.5 cursor-pointer ml-1"
              >
                <span>{expandAlert ? 'Sembunyikan' : 'Tampilkan'}</span>
                {expandAlert ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            
            {/* Jangan tampilkan lagi */}
            <button
              type="button"
              onClick={handleDismissAlert}
              className="text-[#8F6B00] hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer transition-colors text-[10px] absolute right-4 top-4"
            >
              <span>Jangan tampilkan lagi</span>
              <X size={12} />
            </button>
          </div>

          {expandAlert && (
            <div className="space-y-2 mt-2 pt-2 border-t border-[#FFECA8]/50 pl-5 list-disc leading-relaxed text-slate-700 font-medium max-w-5xl">
              <p>
                <strong>Purchase Order:</strong> Ketika ada pembayaran di module Pembelian tetapi barang belum di terima (belum isi tanggal penerimaan), default akan menambah akun <strong>11700 beban di bayar dimuka</strong> anda bisa memilih akun lain sebagai akun debit di Transaksi POS - Pembelian - setting.
              </p>
              <p>
                <strong>Purchase Invoice:</strong> akan terjadi Ketika di module pembelian di isi tanggal penerimaan dan belum ada pembayaran sebelumnya, maka semua pembayaran setelah itu akan di mengurangi hutang.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={32} className="animate-spin mb-3 text-[#0088E8]" />
            <p className="text-xs font-semibold">Memuat Daftar Akun...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs font-semibold">
            Tidak ada akun yang ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Nomor Akun</th>
                  <th className="px-5 py-3">Nama Akun</th>
                  <th className="px-5 py-3">Klasifikasi</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                  <th className="px-5 py-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {accounts.slice(0, displayCount).map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-3 text-slate-500 font-semibold">{acc.code}</td>
                    <td className="px-5 py-3 text-slate-800 font-bold">{acc.name}</td>
                    <td className="px-5 py-3 text-slate-500">{acc.klasifikasi || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        onClick={() => setViewingAccountId(acc.id)}
                        className="text-[#0088E8] hover:underline cursor-pointer font-bold"
                      >
                        {formatIDR(acc.saldo)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center relative">
                      <button
                        type="button"
                        onClick={() => setActiveDropdownId(activeDropdownId === acc.id ? null : acc.id)}
                        className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {/* Action Dropdown Menu */}
                      {activeDropdownId === acc.id && (
                        <div
                          ref={dropdownRef}
                          className="absolute right-8 top-1/2 -translate-y-1/2 z-20 w-24 bg-white rounded-lg border border-slate-200 shadow-lg py-1 text-left text-[11px] font-bold"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccount(acc);
                              setIsUbahOpen(true);
                              setActiveDropdownId(null);
                            }}
                            className="w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccount(acc);
                              setIsHapusOpen(true);
                              setActiveDropdownId(null);
                            }}
                            className="w-full px-3 py-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Button */}
        {accounts.length > displayCount && (
          <div className="p-4 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              onClick={() => setDisplayCount((prev) => prev + 15)}
              className="px-5 py-2 rounded-lg border border-slate-350 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs transition-colors"
            >
              Muat lainnya
            </button>
          </div>
        )}
      </div>

      {/* Modals and Popups */}
      <FilterAkunModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onFilter={handleApplyFilter}
        initialFilters={filters}
      />
      <SesuaikanSaldoAwalModal
        isOpen={isSaldoAwalOpen}
        onClose={() => setIsSaldoAwalOpen(false)}
        onSaved={fetchAccounts}
      />
      <TambahAkunModal
        isOpen={isTambahOpen}
        onClose={() => setIsTambahOpen(false)}
        onCreated={fetchAccounts}
      />
      <UbahAkunModal
        isOpen={isUbahOpen}
        onClose={() => {
          setIsUbahOpen(false);
          setSelectedAccount(null);
        }}
        account={selectedAccount}
        onUpdated={fetchAccounts}
      />
      <HapusAkunModal
        isOpen={isHapusOpen}
        onClose={() => {
          setIsHapusOpen(false);
          setSelectedAccount(null);
        }}
        account={selectedAccount}
        onDeleted={fetchAccounts}
      />
    </div>
  );
}
