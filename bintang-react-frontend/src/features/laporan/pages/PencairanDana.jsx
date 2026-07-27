import { useEffect, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { Dropdown, DateRangePicker } from '../../transaksi/components/TransactionScaffold';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import { useAuth } from '../../../context/AuthContext';
import TambahAkunBankModal from '../components/TambahAkunBankModal';

const tabs = [
  { id: 'pencairan', label: 'Pencairan Dana' },
  { id: 'online', label: 'Penjualan Online' },
];

/** Empty-state settlement (dipakai kedua tab). */
function SettlementEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-12">
      <h3 className="mt-4 text-slate-700 font-bold text-lg">Daftar settlement akan muncul di sini</h3>
      <p className="mt-1.5 text-sm text-sky-600/70 max-w-md leading-relaxed">
        Settlement akan berhasil jika akun bank Anda tersedia dan valid. Settlement yang belum
        dibayarkan akan ditambah pada periode yang akan datang
      </p>
    </div>
  );
}

export default function PencairanDana() {
  const { setSubtitle } = useTransaksiCrumb();
  const { user, businessSettings } = useAuth();
  const [activeTab, setActiveTab] = useState('pencairan');
  const [status, setStatus] = useState('Semua');
  const [tglOrder, setTglOrder] = useState('Tanggal order');
  const [pembayaran, setPembayaran] = useState('Semua Pembayaran');
  const [showBank, setShowBank] = useState(false);
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return { preset: 'today', start: d, end: d };
  });

  const storeName = businessSettings?.nama_bisnis || user?.username || 'Toko Anda';

  useEffect(() => {
    setSubtitle(activeTab === 'online' ? 'Settlement Online Order' : 'Settlement List');
  }, [activeTab, setSubtitle]);

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-4 text-sm font-semibold whitespace-nowrap text-center transition-colors cursor-pointer ${
                isActive
                  ? 'text-blue-600 bg-blue-50/70'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/40'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'pencairan' ? (
        <>
          {/* Toolbar: filter (kiri) — tanggal (kanan) */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0">
            <Dropdown
              options={['Semua', 'Dibayar', 'Belum Bayar']}
              value={status}
              onChange={setStatus}
              minW="min-w-[130px]"
            />
            <DateRangePicker value={dateFilter} onChange={setDateFilter} />
          </div>
          <SettlementEmpty />
        </>
      ) : (
        <>
          {/* Kartu akun bank */}
          <div className="mx-6 mt-4 flex items-center justify-between gap-4 border border-slate-200 rounded-xl px-5 py-4 shrink-0">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{storeName}</p>
              <p className="text-sm font-bold text-slate-700">Tambah Akun Bank</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Sediakan untuk menerima dana settlement
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBank(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg px-5 py-2 cursor-pointer transition-colors shrink-0"
            >
              Tambah
            </button>
          </div>

          {/* Toolbar: filter (kiri) — tanggal + menu (kanan) */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <Dropdown
                options={['Tanggal order', 'Tanggal Dicairkan']}
                value={tglOrder}
                onChange={setTglOrder}
                minW="min-w-[150px]"
              />
              <Dropdown
                options={['Semua Pembayaran', 'Cash', 'Semua']}
                value={pembayaran}
                onChange={setPembayaran}
                minW="min-w-[180px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <DateRangePicker value={dateFilter} onChange={setDateFilter} />
              <button
                type="button"
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
              >
                <MoreVertical size={18} />
              </button>
            </div>
          </div>
          <SettlementEmpty />
        </>
      )}

      {showBank && <TambahAkunBankModal onClose={() => setShowBank(false)} />}
    </div>
  );
}
