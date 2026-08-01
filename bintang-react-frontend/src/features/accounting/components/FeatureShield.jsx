import { Lock, Construction } from 'lucide-react';

export default function FeatureShield({ title, description, targetTask }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 md:p-16 text-center flex flex-col items-start justify-center max-w-3xl mx-auto my-8">
      <div className="w-14 h-14 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-center mb-5 shadow-xs">
        <Construction className="w-7 h-7 text-amber-600" />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-600 mb-3">
        <Lock className="w-3.5 h-3.5 text-slate-500" />
        <span>FEATURE GATED (PRODUCTION SHIELD)</span>
      </div>

      <h2 className="text-xl font-extrabold text-slate-900 mb-2">
        {title || 'Modul Belum Tersedia'}
      </h2>

      <p className="text-sm text-slate-600 leading-relaxed mb-6">
        {description ||
          'Modul ini sedang dalam integrasi penuh ke mesin akuntansi backend. Angka contoh (mock) disembunyikan untuk memastikan tidak ada data tiruan yang tampil pada laporan produksi.'}
      </p>

      {targetTask && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-500 font-mono">
          Target Integrasi API: <span className="font-bold text-slate-700">{targetTask}</span>
        </div>
      )}
    </div>
  );
}
