import { useEffect, useState } from 'react';
import { Clock, Info } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

const potong = (jam) => (jam ? jam.slice(0, 5) : '-');

/**
 * Shift kerja (2026-10-19): data diambil dari pengaturan Shift di HR dan hanya bisa dilihat
 * di ERP. Mengubah shift dilakukan di HR.
 */
export default function ShiftHrBacaSaja() {
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let aktif = true;
    apiClient.get('/shift-timing/')
      .then((res) => { if (aktif) setDaftar(Array.isArray(res.data) ? res.data : res.data?.results || []); })
      .catch(() => { if (aktif) setGalat('Gagal memuat daftar shift.'); })
      .finally(() => { if (aktif) setMemuat(false); });
    return () => { aktif = false; };
  }, []);

  const dariCadangan = daftar.some((s) => s.sumber === 'lokal');

  return (
    <div className="max-w-3xl w-full mx-auto space-y-5">
      <div>
        <h3 className="font-extrabold text-slate-800 text-sm">Shift Kerja</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Data diambil dari pengaturan Shift di HR dan tidak bisa diubah di sini.
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[11px] text-slate-600">
        <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          Untuk menambah atau mengubah shift, buka HR → Pengaturan → Shift. Perubahan di HR otomatis tampil di
          sini (diperbarui tiap beberapa menit).
        </p>
      </div>

      {dariCadangan && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          HR tidak dapat dihubungi, yang tampil adalah data lama tersimpan di ERP.
        </p>
      )}
      {galat && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{galat}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {memuat ? (
          <p className="py-12 text-center text-xs font-semibold text-slate-400">Memuat daftar shift…</p>
        ) : daftar.length === 0 ? (
          <p className="py-12 text-center text-xs font-semibold text-slate-400">Belum ada shift di HR.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Jam kerja</th>
                <th className="px-4 py-3">Hari</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daftar.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-4 py-3 font-bold text-slate-800">{s.judul}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.jam_mulai ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <Clock size={12} className="text-slate-400" /> {potong(s.jam_mulai)} – {potong(s.jam_berakhir)}
                      </span>
                    ) : (s.hari || []).length ? (
                      <div className="space-y-0.5">
                        {s.hari.map((h) => (
                          <p key={h.hari}>
                            <span className="inline-block w-14 text-slate-400">{h.hari}</span>
                            {potong(h.mulai)} – {potong(h.selesai)}
                          </p>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {(s.hari || []).length ? `${s.hari.length} hari` : 'Belum dijadwalkan'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
