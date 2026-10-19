import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';

// Permohonan akses karyawan hari ini (HP tertinggal, terlambat, dll) di menu Absensi.
// Disetujui/ditolak oleh Owner, Manager, atau Admin; alasan karyawan tampil apa adanya.
export default function PermohonanAksesPanel({ onChanged }) {
  const [daftar, setDaftar] = useState([]);
  const [proses, setProses] = useState(null);

  const muat = useCallback(async () => {
    try {
      const res = await apiClient.get('/hr/unlock-requests/');
      setDaftar(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDaftar([]); // peran tanpa hak persetujuan tidak melihat panel
    }
  }, []);

  useEffect(() => {
    muat();
    const t = setInterval(muat, 60000);
    return () => clearInterval(t);
  }, [muat]);

  const putuskan = async (id, aksi) => {
    setProses(id);
    try {
      await apiClient.post(`/hr/unlock-requests/${id}/${aksi}/`);
      notifySuccess(aksi === 'approve' ? 'Disetujui' : 'Ditolak', 'Permohonan akses diproses.');
      await muat();
      if (onChanged) onChanged();
    } catch (err) {
      notifyApiError(err, 'Gagal memproses permohonan.');
    } finally {
      setProses(null);
    }
  };

  if (!daftar.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-3 space-y-2">
      <h2 className="text-xs font-bold text-slate-800">Permohonan Akses ({daftar.length})</h2>
      {daftar.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 text-[11px]">
            <p className="font-bold text-slate-800">
              {r.staff_nama || r.staff}
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{r.jenis_label || 'Izin terlambat'}</span>
            </p>
            <p className="italic text-slate-600">&ldquo;{r.alasan}&rdquo;</p>
            <p className="text-[10px] text-slate-400">{new Date(r.waktu_request).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button" disabled={proses === r.id} onClick={() => putuskan(r.id, 'approve')}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <CheckCircle2 size={13} /> Setuju
            </button>
            <button
              type="button" disabled={proses === r.id} onClick={() => putuskan(r.id, 'reject')}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle size={13} /> Tolak
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
