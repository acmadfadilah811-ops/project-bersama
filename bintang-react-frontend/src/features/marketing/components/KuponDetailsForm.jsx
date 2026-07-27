import { Calendar, RefreshCw } from 'lucide-react';
import { Toggle } from './Common';
import { formatRibuan, unformatRibuan } from '../format';

const randomKode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 12; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

/** Sub-komponen untuk kolom Kiri (Detail Kupon) pada Kupon Form */
export default function KuponDetailsForm({
  kode,
  setKode,
  judul,
  setJudul,
  maksDiskon,
  setMaksDiskon,
  minTotal,
  setMinTotal,
  tanggalAktif,
  setTanggalAktif,
  tg,
  setT,
  tanggalKadaluarsa,
  setTanggalKadaluarsa,
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Kode</label>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            maxLength={12}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <button
            type="button"
            onClick={() => setKode(randomKode())}
            title="Buat kode baru"
            className="shrink-0 p-2.5 rounded-xl border border-slate-200 text-slate-450 hover:bg-slate-100 hover:text-blue-500 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Judul</label>
        <input
          type="text"
          placeholder="Masukkan Judul"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Maksimal Jumlah Diskon</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            value={formatRibuan(maksDiskon)}
            onChange={(e) => setMaksDiskon(unformatRibuan(e.target.value))}
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Min. Total Harga Pesanan</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            value={formatRibuan(minTotal)}
            onChange={(e) => setMinTotal(unformatRibuan(e.target.value))}
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tanggal Aktif</label>
        <div className="relative">
          <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
          <input
            type="date"
            value={tanggalAktif}
            onChange={(e) => setTanggalAktif(e.target.value)}
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tanggal Berakhir</label>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-650">Tanpa Kadaluarsa</span>
          <Toggle on={tg.noExpiry} onChange={setT('noExpiry')} />
        </div>
        {!tg.noExpiry && (
          <input
            type="date"
            value={tanggalKadaluarsa}
            onChange={(e) => setTanggalKadaluarsa(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all animate-in fade-in duration-200"
          />
        )}
      </div>
    </div>
  );
}
