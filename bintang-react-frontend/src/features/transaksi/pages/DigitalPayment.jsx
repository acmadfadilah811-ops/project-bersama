import { useEffect } from 'react';
import {
  Wallet,
  FileText,
  CalendarClock,
  Percent,
  Banknote,
  Store,
  ChevronRight,
} from 'lucide-react';
import { useTransaksiCrumb } from '../components/TransaksiContext';

const benefits = [
  { icon: Wallet, text: 'Didaftarkan ke masing-masing Ewallet' },
  { icon: FileText, text: 'Dokumen yang dibutuhkan hanya Foto KTP' },
  { icon: CalendarClock, text: 'Rentang waktu aktivasi maksimal H+2' },
  { icon: Percent, text: 'Biaya MDR (Merchant Discount Rate) hanya 0,7%' },
  { icon: Banknote, text: 'Pencairan dana pada setiap hari' },
  { icon: Store, text: 'Dapat digunakan di Point of Sale' },
];

const providers = ['OVO', 'GoPay', 'DANA', 'ShopeePay'];

export default function DigitalPayment() {
  const { setSubtitle } = useTransaksiCrumb();

  useEffect(() => {
    setSubtitle('');
  }, [setSubtitle]);

  return (
    <div className="flex flex-col flex-1 bg-white overflow-y-auto">
      <div className="max-w-xl w-full mx-auto px-4 py-8 space-y-10">
        {/* ── Kartu promo QRIS ── */}
        <div className="relative bg-gradient-to-b from-sky-50 to-white rounded-2xl border border-slate-200 shadow-sm pt-12 pb-6 px-6">
          {/* Badge QRIS */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl bg-blue-600 shadow-lg flex items-center justify-center">
            <span className="text-white font-black text-xs tracking-tight">QRIS</span>
          </div>

          <h2 className="text-center text-lg font-bold text-slate-800 leading-snug max-w-sm mx-auto">
            Yuk daftar Qris by Netzme sekarang dan nikmati kemudahannya!
          </h2>

          <ul className="mt-6 space-y-3">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.text} className="flex items-center gap-3 text-sm text-slate-600">
                  <Icon size={16} className="text-slate-400 shrink-0" />
                  <span>{b.text}</span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 cursor-pointer transition-colors"
          >
            Ajukan Qris
          </button>
        </div>

        {/* ── Bagian Digital Payment ── */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-800">Digital Payment</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 cursor-pointer transition-colors"
            >
              Aktifkan <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-6">
            <div className="flex items-center gap-3 flex-wrap">
              {providers.map((p) => (
                <div
                  key={p}
                  className="w-14 h-14 rounded-xl bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold text-center px-1"
                >
                  {p}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500 leading-relaxed">
              Terima pembayaran berbagai digital payment dari pelanggan Anda. Daftar sekarang juga
              dan dapatkan kesempatan mendapatkan program cashback dari digital payment tertentu
              untuk tingkatkan daya tarik toko Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
