import { useCallback, useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import useAutoRefresh from '../../../utils/useAutoRefresh';

/** Kirim ini setelah karyawan menyelesaikan tugas (SPK selesai, penjualan tercatat) supaya KPI langsung dihitung ulang. */
export const KPI_SEGARKAN = 'kpi:segarkan';
export const segarkanKpi = () => window.dispatchEvent(new Event(KPI_SEGARKAN));

const angka = (n) => Number(n || 0).toLocaleString('id-ID');

function Bilah({ persen, tebal = false }) {
  return (
    <div className={`${tebal ? 'h-2' : 'h-1.5'} w-full rounded-full bg-slate-100`}>
      <div
        className={`${tebal ? 'h-2' : 'h-1.5'} rounded-full bg-slate-700 transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, Number(persen) || 0))}%` }}
      />
    </div>
  );
}

/**
 * KPI/OKR milik karyawan yang login (2026-11-02). Target diisi manager di HR; capaian otomatis
 * dihitung dari data ERP/CRM. Menyegarkan diri tiap 30 detik, saat tab kembali aktif, dan seketika
 * setelah tugas selesai (event `kpi:segarkan`).
 */
export default function KpiSayaCard() {
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async (segar = false) => {
    try {
      const res = await apiClient.get('/kpi-saya/', segar ? { params: { segar: 1 } } : undefined);
      setData(res.data);
    } catch {
      // Angka terakhir tetap ditampilkan; pembaruan latar belakang tidak boleh mengganggu layar.
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => {
    const saatTugasSelesai = () => { void muat(true); };
    window.addEventListener(KPI_SEGARKAN, saatTugasSelesai);
    return () => window.removeEventListener(KPI_SEGARKAN, saatTugasSelesai);
  }, [muat]);
  useAutoRefresh(() => muat(), { intervalMs: 30000 });

  const objektif = data?.objektif || [];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="KPI saya">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">KPI Saya</h2>
        </div>
        {data?.ringkasan?.rata_rata_progres != null && (
          <span className="text-xs font-semibold text-slate-600">Rata-rata {data.ringkasan.rata_rata_progres}%</span>
        )}
      </div>

      {memuat && <p className="text-xs text-slate-400">Memuat KPI...</p>}
      {!memuat && data?.pesan && <p className="text-xs text-slate-500">{data.pesan}</p>}
      {!memuat && !data?.pesan && objektif.length === 0 && (
        <p className="text-xs text-slate-500">Belum ada target KPI untuk Anda. Manager mengisinya di HR (menu KPI/OKR).</p>
      )}

      <div className="space-y-4">
        {objektif.map((o) => (
          <div key={`${o.judul}-${o.mulai}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">{o.judul}</p>
              <span className="text-sm font-bold text-slate-800">{o.progres}%</span>
            </div>
            {o.mulai && o.selesai && <p className="mb-1.5 text-[11px] text-slate-400">{o.mulai} s/d {o.selesai}</p>}
            <Bilah persen={o.progres} tebal />
            <div className="mt-3 space-y-2.5">
              {o.key_results.map((kr) => (
                <div key={kr.judul}>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                    <span>
                      {kr.judul}
                      {kr.otomatis && <span className="ml-1 text-slate-400">(otomatis)</span>}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {angka(kr.capaian)} / {angka(kr.target)}{kr.satuan && kr.satuan !== '#' ? ` ${kr.satuan}` : ''}
                    </span>
                  </div>
                  <div className="mt-1"><Bilah persen={kr.progres} /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {objektif.length > 0 && <p className="mt-3 text-[11px] text-slate-400">Diperbarui otomatis. Target diatur manager di HR.</p>}
    </section>
  );
}
