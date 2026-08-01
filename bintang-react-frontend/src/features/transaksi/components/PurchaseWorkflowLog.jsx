import { History, User, Clock, CheckCircle2, Tag, Package, CreditCard, XCircle, Info } from 'lucide-react';

const fmtDateTime = (d) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
};

const getActionBadge = (tindakan) => {
  const t = (tindakan || '').toUpperCase();
  if (t.includes('STOCK')) return { bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: Package, label: 'Stok Masuk' };
  if (t.includes('PAYMENT')) return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CreditCard, label: 'Pembayaran' };
  if (t.includes('ITEM')) return { bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: Tag, label: 'Item Pesanan' };
  if (t.includes('COMPLETE')) return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2, label: 'Selesai' };
  if (t.includes('CANCEL')) return { bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle, label: 'Batal' };
  if (t.includes('STATUS')) return { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Info, label: 'Status' };
  return { bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: History, label: 'Aktivitas' };
};

export default function PurchaseWorkflowLog({ doc, logs = [] }) {
  const createdBy = doc?.dibuat_oleh_nama || doc?.dibuat_oleh_email || 'Sistem';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
          <History size={16} className="text-blue-600" />
          <span>Log Aktivitas</span>
          <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded-full font-semibold">
            {logs.length + 1} Catatan
          </span>
        </div>
        <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
          <User size={13} className="text-slate-400" />
          <span>Pembuat: <strong>{createdBy}</strong></span>
        </div>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
        {logs.map((log) => {
          const badge = getActionBadge(log.tindakan);
          const IconComp = badge.icon;
          return (
            <div key={log.id} className="relative group">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-2xs group-hover:border-blue-400 transition-colors">
                <IconComp size={11} className="text-slate-500" />
              </div>

              <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-3 space-y-1.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badge.bg}`}>
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock size={11} />
                    {fmtDateTime(log.waktu)}
                  </span>
                </div>

                <p className="font-medium text-slate-800 text-xs leading-relaxed">
                  {log.keterangan}
                </p>

                <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <span>Oleh:</span>
                  <span className="text-slate-600 font-bold">{log.user_nama || 'Sistem'}</span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="relative">
          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
            <CheckCircle2 size={11} className="text-blue-600" />
          </div>
          <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded border bg-blue-50 text-blue-700 border-blue-200">
                Dokumen Dibuat
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {fmtDateTime(doc?.created_at || doc?.tanggal)}
              </span>
            </div>
            <p className="font-medium text-slate-700 text-xs">
              Dokumen Pembelian <strong className="font-mono">{doc?.nomor}</strong> dibuat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
