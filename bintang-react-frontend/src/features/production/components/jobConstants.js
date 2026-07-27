// ─── Konstanta kolom kanban & badge status ────────────────
import { Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';

export const STAFF_COLUMNS = [
  {
    id: 'antrean',
    label: 'Antrean',
    icon: Clock,
    color: 'bg-slate-100 border-slate-300',
    headerColor: 'bg-slate-200 text-slate-700',
    dot: 'bg-slate-400',
  },
  {
    id: 'dikerjakan',
    label: 'Dikerjakan',
    icon: Loader2,
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  {
    id: 'selesai',
    label: 'Selesai',
    icon: CheckCircle,
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },
  {
    id: 'gagal',
    label: 'Gagal',
    icon: XCircle,
    color: 'bg-red-50 border-red-200',
    headerColor: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
];

export const STATUS_BADGE = {
  antrean: { label: 'Antrean', cls: 'bg-slate-100 text-slate-600' },
  dikerjakan: { label: 'Dikerjakan', cls: 'bg-blue-100 text-blue-700' },
  selesai: { label: 'Selesai', cls: 'bg-green-100 text-green-700' },
  gagal: { label: 'Gagal', cls: 'bg-red-100 text-red-700' },
};

// ─── Helper: pisahkan catatan divisi saat ini & warisan ───
export function parsePreviousNotes(catatanStaff) {
  if (!Array.isArray(catatanStaff)) return { current: [], previous: [] };
  const sepIdx = catatanStaff.findIndex(
    (r) => typeof r.keterangan === 'string' && r.keterangan.startsWith('--- Dari Divisi:')
  );
  if (sepIdx === -1) return { current: catatanStaff, previous: [] };
  return {
    current: catatanStaff.slice(0, sepIdx),
    previous: catatanStaff.slice(sepIdx),
  };
}
