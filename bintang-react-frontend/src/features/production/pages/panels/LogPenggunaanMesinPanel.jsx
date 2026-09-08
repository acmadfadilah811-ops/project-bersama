import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { downloadFile } from '../../../../utils/downloadFile';

function formatDetailPenggunaan(entry) {
  const basis = entry.mesin_basis_pencatatan;
  if (basis === 'meter') {
    const meter = entry.panjang_bahan_meter != null ? Number(entry.panjang_bahan_meter).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '0';
    return `${meter} m${entry.jenis_bahan ? ` — ${entry.jenis_bahan}` : ''}`;
  }
  if (basis === 'lainnya') {
    return entry.catatan_konfirmasi || '-';
  }
  const parts = [];
  if (entry.lembar_color) parts.push(`${entry.lembar_color} color`);
  if (entry.lembar_mono) parts.push(`${entry.lembar_mono} mono`);
  return parts.length > 0 ? parts.join(' / ') : '0';
}

const PAGE_SIZE = 20;

/**
 * Log Penggunaan Mesin -- sebelumnya jadi 1 bagian di dalam tab "Penggunaan
 * Mesin" (MesinPanel.jsx), dipisah jadi tab tersendiri (fitur 2026-09-09)
 * biar tampilannya lebih lega, tidak berdesakan dengan kartu master mesin.
 *
 * mode='owner'  : Owner/Manager -- lihat log SEMUA staff, filter staff bebas,
 *                 ringkasan per staff, tombol Export Excel.
 * mode='staff'  : Staff -- log MILIK SENDIRI saja (operator dikunci ke user
 *                 login), tanpa ringkasan/export (endpoint itu Owner/Manager
 *                 saja) -- staff tetap butuh riwayat penggunaan mesinnya
 *                 sendiri untuk pertanggungjawaban (instruksi user 2026-09-09).
 */
export default function LogPenggunaanMesinPanel({ mode = 'owner', currentUser, staffList }) {
  const isOwnerMode = mode === 'owner';
  const [mesinList, setMesinList] = useState([]);
  const [rows, setRows] = useState([]);
  const [ringkasan, setRingkasan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMesin, setFilterMesin] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterMulai, setFilterMulai] = useState('');
  const [filterAkhir, setFilterAkhir] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [exporting, setExporting] = useState(false);

  const mesinById = Object.fromEntries((mesinList || []).map((m) => [String(m.id), m]));

  useEffect(() => {
    apiClient.get('/mesin/').then((res) => {
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setMesinList(data);
    }).catch(() => {});
  }, []);

  const buildParams = (extra = {}) => {
    const params = { ...extra };
    if (filterMesin) params.mesin = filterMesin;
    const operatorFilter = isOwnerMode ? filterStaff : currentUser?.id;
    if (operatorFilter) params.operator = operatorFilter;
    if (filterMulai) params.tanggal_mulai = filterMulai;
    if (filterAkhir) params.tanggal_akhir = filterAkhir;
    return params;
  };

  const fetchLog = async () => {
    setLoading(true);
    try {
      const requests = [apiClient.get('/penggunaan-mesin/', { params: buildParams({ page, page_size: PAGE_SIZE }) })];
      if (isOwnerMode) {
        requests.push(apiClient.get('/penggunaan-mesin/ringkasan-staff/', { params: buildParams() }));
      }
      const [logRes, ringkasanRes] = await Promise.all(requests);
      const logData = logRes.data;
      const list = Array.isArray(logData) ? logData : (logData?.results || []);
      // Lampirkan basis_pencatatan mesin ke tiap baris (dibutuhkan
      // formatDetailPenggunaan) -- serializer log tidak menyertakan field
      // mesin lain selain nama, jadi di-join di sini dari mesinList.
      const enriched = list.map((row) => ({
        ...row,
        mesin_basis_pencatatan: mesinById[String(row.mesin)]?.basis_pencatatan,
      }));
      setRows(enriched);
      if (!Array.isArray(logData)) {
        setTotalItems(logData.count ?? list.length);
        setTotalPages(Math.max(1, Math.ceil((logData.count ?? list.length) / PAGE_SIZE)));
      } else {
        setTotalItems(list.length);
        setTotalPages(1);
      }
      setRingkasan(ringkasanRes && Array.isArray(ringkasanRes.data) ? ringkasanRes.data : []);
    } catch (error) {
      console.error('Gagal memuat log penggunaan mesin:', error);
      setRows([]);
      setRingkasan([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMesin, filterStaff, filterMulai, filterAkhir, page, mesinList.length, currentUser?.id]);

  useEffect(() => { setPage(1); }, [filterMesin, filterStaff, filterMulai, filterAkhir]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const query = new URLSearchParams(buildParams()).toString();
      await downloadFile(`/penggunaan-mesin/export/?${query}`, `log-penggunaan-mesin.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">
              {isOwnerMode ? 'Log Penggunaan Mesin' : 'Riwayat Penggunaan Mesin Saya'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isOwnerMode
                ? 'Riwayat pencatatan pemakaian mesin dari semua staff -- filter per mesin/staff untuk pertanggungjawaban.'
                : 'Riwayat pencatatan pemakaian mesin yang sudah kamu input sendiri.'}
            </p>
          </div>
          {isOwnerMode && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Export Excel
            </button>
          )}
        </div>

        <div className={`grid grid-cols-2 ${isOwnerMode ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-2 mt-3`}>
          <select
            value={filterMesin}
            onChange={(e) => setFilterMesin(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Mesin</option>
            {(mesinList || []).map((m) => (
              <option key={m.id} value={m.id}>{m.nama}</option>
            ))}
          </select>
          {isOwnerMode && (
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Staff</option>
              {(staffList || []).map((s) => (
                <option key={s.id} value={s.id}>{s.username}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={filterMulai}
            onChange={(e) => setFilterMulai(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="date"
            value={filterAkhir}
            onChange={(e) => setFilterAkhir(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {isOwnerMode && ringkasan.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ringkasan.map((r) => (
            <div key={r.operator_id} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-extrabold text-slate-800 truncate">{r.operator_nama}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{r.jumlah_entri} entri</p>
              <div className="flex gap-3 mt-1.5 text-[10px] font-bold text-slate-600">
                {r.total_klik > 0 && <span>{r.total_klik.toLocaleString()} klik</span>}
                {r.total_meter > 0 && <span>{r.total_meter.toLocaleString('id-ID')} m</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center text-slate-400 text-xs py-10">Memuat log...</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-slate-400 text-xs italic py-10">Belum ada catatan penggunaan untuk filter ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Tanggal</th>
                  <th className="px-3 py-2.5">Mesin</th>
                  {isOwnerMode && <th className="px-3 py-2.5">Staff</th>}
                  <th className="px-3 py-2.5">Job</th>
                  <th className="px-3 py-2.5">Detail Pemakaian</th>
                  <th className="px-3 py-2.5">Kondisi</th>
                  <th className="px-3 py-2.5">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                      {new Date(row.waktu).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{row.mesin_nama}</td>
                    {isOwnerMode && <td className="px-3 py-2.5 text-slate-700">{row.operator_nama || '-'}</td>}
                    <td className="px-3 py-2.5 text-slate-500">{row.job_nomor_sumber || '-'}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{formatDetailPenggunaan(row)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.kondisi_hasil === 'kendala' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {row.kondisi_hasil === 'kendala' ? 'Ada Kendala' : 'OK'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 max-w-[200px] truncate" title={row.catatan_konfirmasi}>
                      {row.catatan_konfirmasi || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 text-[11px] font-bold text-slate-500">
            <span>Total {totalItems} entri</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 border border-slate-200 rounded disabled:opacity-30 cursor-pointer"
              >
                &lt;
              </button>
              <span>{page}/{totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 border border-slate-200 rounded disabled:opacity-30 cursor-pointer"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
