import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { notifyApiError } from '../../../utils/notify';

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

/**
 * Rincian insentif satu SPK. `editable` (Owner/Manager/Admin): tambah dari master
 * Jenis Insentif atau ketik manual, ubah nominal, hapus -- tersimpan langsung ke
 * server. Tanpa `editable` (staff): hanya daftar baca-saja. SPK selesai terkunci
 * (server yang menegakkan, tombol ikut disembunyikan).
 */
export default function InsentifRincian({ job, editable = false, onChanged }) {
  const [rincian, setRincian] = useState(job?.rincian_insentif || []);
  const [master, setMaster] = useState([]);
  const [pilih, setPilih] = useState('');
  const [namaBebas, setNamaBebas] = useState('');
  const [nominalBaru, setNominalBaru] = useState('');
  const [busy, setBusy] = useState(false);

  const terkunci = job?.status_pekerjaan === 'selesai';
  const bisaUbah = editable && !terkunci;

  useEffect(() => { setRincian(job?.rincian_insentif || []); }, [job?.id, job?.rincian_insentif]);

  useEffect(() => {
    if (!bisaUbah) return;
    fetchAllPages('/jenis-insentif/')
      .then((data) => setMaster(data.filter((j) => j.aktif)))
      .catch(() => setMaster([]));
  }, [bisaUbah]);

  const terapkan = (data) => {
    setRincian(data.rincian_insentif);
    onChanged?.();
  };

  const jalankan = async (fn) => {
    setBusy(true);
    try {
      terapkan((await fn()).data);
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan insentif.');
    } finally {
      setBusy(false);
    }
  };

  const tambah = () => {
    const payload = pilih ? { jenis_id: parseInt(pilih, 10) } : { nama: namaBebas.trim() };
    if (nominalBaru !== '') payload.nominal = parseInt(nominalBaru, 10);
    jalankan(() => apiClient.post(`/jobs/${job.id}/insentif/`, payload)).then(() => {
      setPilih('');
      setNamaBebas('');
      setNominalBaru('');
    });
  };

  const total = rincian.reduce((a, r) => a + (r.nominal || 0), 0);
  const sudahAda = new Set(rincian.map((r) => r.jenis).filter(Boolean));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">Insentif</span>
        <span className="text-xs font-bold text-slate-800 tabular-nums">{rupiah(total)}</span>
      </div>

      {rincian.length === 0 ? (
        <p className="text-[11px] text-slate-400">Belum ada insentif untuk SPK ini.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {rincian.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-xs">
              <span className="flex-1 text-slate-700">
                {r.nama}
                {r.otomatis && <span className="ml-1.5 text-[10px] text-slate-400">otomatis</span>}
              </span>
              {bisaUbah ? (
                <>
                  <input
                    type="number"
                    min="0"
                    defaultValue={r.nominal}
                    disabled={busy}
                    aria-label={`Nominal ${r.nama}`}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== '' && parseInt(v, 10) !== r.nominal) {
                        jalankan(() => apiClient.patch(`/insentif-pekerjaan/${r.id}/`, { nominal: parseInt(v, 10) }));
                      }
                    }}
                    className="w-24 text-right border border-slate-200 rounded px-2 py-1 outline-none focus:border-slate-500 tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => jalankan(() => apiClient.delete(`/insentif-pekerjaan/${r.id}/`))}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400"
                    aria-label={`Hapus ${r.nama}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              ) : (
                <span className="tabular-nums font-semibold text-slate-700">{rupiah(r.nominal)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && terkunci && (
        <p className="text-[10px] text-slate-400 italic">SPK sudah selesai — insentif terkunci.</p>
      )}

      {bisaUbah && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={pilih}
            onChange={(e) => setPilih(e.target.value)}
            className="flex-1 min-w-[8rem] text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-500"
          >
            <option value="">Ketik nama sendiri…</option>
            {master.filter((j) => !sudahAda.has(j.id)).map((j) => (
              <option key={j.id} value={j.id}>{j.nama} ({rupiah(j.nominal_default)})</option>
            ))}
          </select>
          {!pilih && (
            <input
              value={namaBebas}
              onChange={(e) => setNamaBebas(e.target.value)}
              placeholder="Nama insentif"
              className="flex-1 min-w-[8rem] text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-500"
            />
          )}
          <input
            type="number"
            min="0"
            value={nominalBaru}
            onChange={(e) => setNominalBaru(e.target.value)}
            placeholder={pilih ? 'Nominal standar' : 'Nominal'}
            className="w-28 text-xs text-right border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-500"
          />
          <button
            type="button"
            disabled={busy || (!pilih && !namaBebas.trim()) || (!pilih && nominalBaru === '')}
            onClick={tambah}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-800 text-white rounded-lg px-3 py-1.5 hover:bg-slate-700 disabled:opacity-40"
          >
            <Plus size={13} /> Tambah
          </button>
        </div>
      )}
    </div>
  );
}
