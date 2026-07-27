import { useState, useEffect } from 'react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import DiskonPenjualanTab from '../components/DiskonPenjualanTab';
import KuponDiskonTab from '../components/KuponDiskonTab';
import PromosiPosTab from '../components/PromosiPosTab';

const TABS = [
  { id: 'diskon', label: 'Diskon Penjualan' },
  { id: 'kupon', label: 'Kupon Diskon' },
  { id: 'promosi', label: 'Promosi (POS)' },
];

export default function VoucherDiskon() {
  const [tab, setTab] = useState('diskon');
  const { setSubtitle } = useTransaksiCrumb();

  useEffect(() => {
    setSubtitle('Voucher & Diskon');
  }, [setSubtitle]);

  return (
    <div className="flex flex-col flex-1 min-h-full bg-slate-50/50">
      <div className="grid grid-cols-3 border-b border-slate-100 bg-white shrink-0">
        {TABS.map((t) => {
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-4 text-sm font-bold text-center whitespace-nowrap transition-all duration-200 border-b-2 cursor-pointer ${
                isActive
                  ? 'text-blue-600 border-blue-600 font-extrabold'
                  : 'text-slate-400 border-transparent hover:text-slate-650 hover:border-slate-200'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 p-6">
        {tab === 'diskon' && <DiskonPenjualanTab />}
        {tab === 'kupon' && <KuponDiskonTab />}
        {tab === 'promosi' && <PromosiPosTab />}
      </div>
    </div>
  );
}
