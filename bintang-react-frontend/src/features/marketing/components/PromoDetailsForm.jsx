import { Calendar, Clock } from 'lucide-react';
import { Toggle } from './Common';

const PROMO_DAYS = [
  ['min', 'Minggu'],
  ['sen', 'Senin'],
  ['sel', 'Selasa'],
  ['rab', 'Rabu'],
  ['kam', 'Kamis'],
  ['jum', 'Jumat'],
  ['sab', 'Sabtu'],
];

/** Sub-komponen untuk Detail Umum & Jadwal Promosi POS */
export default function PromoDetailsForm({
  judul,
  setJudul,
  tanggalAktif,
  setTanggalAktif,
  noExpiry,
  setNoExpiry,
  tanggalKadaluarsa,
  setTanggalKadaluarsa,
  jam24,
  setJam24,
  jamMulai,
  setJamMulai,
  jamBerakhir,
  setJamBerakhir,
  days,
  toggleDay,
  toggleAllDays,
}) {
  return (
    <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/20 space-y-4">
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Informasi & Jadwal</h3>
      
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Judul Promosi</label>
        <input
          type="text"
          placeholder="Masukkan Judul"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tanggal Mulai</label>
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
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-650">Tanpa Kadaluarsa</span>
            <Toggle on={noExpiry} onChange={setNoExpiry} />
          </div>
          {!noExpiry && (
            <div className="relative animate-in fade-in duration-200">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
              <input
                type="date"
                value={tanggalKadaluarsa}
                onChange={(e) => setTanggalKadaluarsa(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200/60 pt-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Jam Aktif</label>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-650">Berlaku 24 Jam</span>
            <Toggle on={jam24} onChange={setJam24} />
          </div>
          {!jam24 && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
                <input
                  type="time"
                  value={jamMulai}
                  onChange={(e) => setJamMulai(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
                <input
                  type="time"
                  value={jamBerakhir}
                  onChange={(e) => setJamBerakhir(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Hari Aktif</label>
          <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 shadow-sm">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={days.all}
                onChange={toggleAllDays}
                className="w-3.5 h-3.5 text-blue-600 border-slate-350 rounded focus:ring-blue-500 focus:ring-1"
              />
              Pilih Semua
            </label>
            {PROMO_DAYS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={days[k]}
                  onChange={() => toggleDay(k)}
                  className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-1"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
