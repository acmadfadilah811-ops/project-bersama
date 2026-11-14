import { useCallback, useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import useAutoRefresh from '../../../utils/useAutoRefresh';

/** Kirim ini setelah karyawan menyelesaikan tugas (SPK selesai, penjualan tercatat) supaya KPI langsung dihitung ulang. */
export const KPI_SEGARKAN = 'kpi:segarkan';
export const segarkanKpi = () => window.dispatchEvent(new Event(KPI_SEGARKAN));

const angka = (n) => Number(n || 0).toLocaleString('id-ID');
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
// Warna grade mengikuti file KPI owner: >=95 Excellent, >=75 Good, >=60 Semangat Lagi, <60 Warning.
const WARNA_GRADE = {
  Excellent: 'bg-emerald-50 text-emerald-700',
  Good: 'bg-sky-50 text-sky-700',
  'Semangat Lagi': 'bg-amber-50 text-amber-700',
  Warning: 'bg-rose-50 text-rose-700',
};

function nilaiIndikator(v, satuan) {
  if (v === null || v === undefined) return '-';
  if (satuan === 'rupiah') return `Rp ${angka(v)}`;
  if (satuan === 'persen') return `${angka(v)}%`;
  if (satuan === 'm2') return `${angka(v)} m2`;
  return angka(v);
}

/** KPI bulanan per jabatan (2026-11-14): skor, grade, peringkat, rincian indikator, tren 6 bulan. */
function KpiBulanan({ kpi }) {
  const maksTren = Math.max(100, ...kpi.tren.map((t) => Number(t.total || 0)));
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Skor bulan ini - {kpi.jabatan}</p>
          <p className="text-3xl font-bold tabular-nums text-slate-900">{Number(kpi.total || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="flex items-center gap-2">
          {kpi.grade && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${WARNA_GRADE[kpi.grade] || 'bg-slate-100 text-slate-700'}`}>{kpi.grade}</span>}
          {kpi.peringkat && <span className="text-xs font-semibold text-slate-600">Peringkat {kpi.peringkat} dari {kpi.jumlah_peringkat}</span>}
        </div>
      </div>
      {kpi.belum_diisi > 0 && <p className="mt-1 text-[11px] text-amber-700">{kpi.belum_diisi} indikator belum ada realisasi (diisi pemeriksa).</p>}

      <div className="mt-3 space-y-2.5">
        {kpi.items.map((i) => (
          <div key={i.indikator_id}>
            <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
              <span className="min-w-0 truncate">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: i.warna }} />
                {i.indikator}
                {i.otomatis && <span className="ml-1 text-slate-400">(otomatis)</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {nilaiIndikator(i.realisasi, i.satuan)} / {nilaiIndikator(i.target, i.satuan)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1"><Bilah persen={i.capaian_persen} /></div>
              <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-500">
                {Number(i.skor || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}/{angka(i.bobot)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {kpi.tren?.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Tren 6 bulan</p>
          <div className="flex h-16 items-end gap-2">
            {kpi.tren.map((t) => (
              <div key={`${t.tahun}-${t.bulan}`} className="flex flex-1 flex-col items-center gap-1" title={`${BULAN[t.bulan - 1]} ${t.tahun}: ${t.total ?? '-'}`}>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-slate-700"
                    style={{ height: `${t.total ? Math.max(4, (Number(t.total) / maksTren) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{BULAN[t.bulan - 1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const kpi = data?.kpi_bulanan?.ada_template ? data.kpi_bulanan : null;
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
      {!memuat && !data?.pesan && objektif.length === 0 && !kpi && (
        <p className="text-xs text-slate-500">Belum ada target KPI untuk Anda. HR mengaturnya di menu KPI Karyawan (template per jabatan).</p>
      )}

      {kpi && <KpiBulanan kpi={kpi} />}

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
      {(objektif.length > 0 || kpi) && <p className="mt-3 text-[11px] text-slate-400">Diperbarui otomatis. Target diatur HR per jabatan.</p>}
    </section>
  );
}
