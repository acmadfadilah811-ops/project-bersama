import { useEffect, useState } from 'react';
import { X, Loader2, Users } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

/**
 * SplitOperatorModal — operator yang sedang mengerjakan job (status
 * 'dikerjakan') membagi sisa qty ke operator lain satu divisi, saat qty-nya
 * kebanyakan untuk dikerjakan sendiri (instruksi user 2026-11-24). Server
 * (POST /api/jobs/{id}/bagi-operator/) membuat SPK baru untuk operator
 * tujuan dan menyusutkan qty job ini -- lihat services/split_job.py.
 *
 * Daftar operator tujuan diambil dari GET /api/jobs/{id}/rekan-divisi/ --
 * BUKAN dari staffList/`/api/users/` biasa, yang sengaja dikunci (403) untuk
 * role staff (lihat IsOwnerManagerAdminOrSupervisorReadOnly). Pemicu split
 * ini selalu staff (instruksi user: hanya operator sendiri yang boleh
 * membagi), jadi staffList dari parent selalu kosong untuknya -- endpoint
 * sempit ini baru benar-benar menampilkan rekan divisi sesuai data di ERP.
 */
export default function SplitOperatorModal({ job, saving, onSubmit, onClose }) {
  const [operatorId, setOperatorId] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const [rekanDivisi, setRekanDivisi] = useState([]);
  const [loadingRekan, setLoadingRekan] = useState(true);

  useEffect(() => {
    if (!job) return;
    let aktif = true;
    setLoadingRekan(true);
    apiClient
      .get(`/jobs/${job.id}/rekan-divisi/`)
      .then((res) => { if (aktif) setRekanDivisi(res.data || []); })
      .catch(() => { if (aktif) setError('Gagal memuat daftar operator satu divisi.'); })
      .finally(() => { if (aktif) setLoadingRekan(false); });
    return () => { aktif = false; };
  }, [job?.id]);

  if (!job) return null;

  const qtySaatIni = Number(job.qty_dikerjakan ?? job.order_item_detail?.qty ?? 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const qtyNum = parseFloat(String(qty).replace(',', '.'));
    if (!operatorId) {
      setError('Pilih operator tujuan.');
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setError('Qty yang dipindah harus lebih dari 0.');
      return;
    }
    if (qtyNum >= qtySaatIni) {
      setError(`Qty yang dipindah harus kurang dari qty SPK ini saat ini (${qtySaatIni}).`);
      return;
    }
    const res = await onSubmit(job.id, { operator_id: operatorId, qty: qtyNum });
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 flex justify-between items-center bg-indigo-700 text-white">
          <div className="flex items-center gap-3">
            <Users size={20} />
            <div>
              <h2 className="font-bold text-base">Bagi Sisa Pekerjaan</h2>
              <p className="text-xs mt-0.5 text-indigo-200">
                {job.nama_produk} — Tahap: {job.tahap_nama}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Qty SPK ini saat ini: <strong className="text-slate-700">{qtySaatIni}</strong>. Sisanya akan
            dipindahkan jadi SPK baru di Antrean operator tujuan; insentif otomatis (kalau ada) dihitung
            prorata sesuai porsi masing-masing.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Operator Tujuan *</label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              required
              disabled={loadingRekan}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{loadingRekan ? 'Memuat operator...' : '-- Pilih Operator --'}</option>
              {rekanDivisi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.username}
                </option>
              ))}
            </select>
            {!loadingRekan && rekanDivisi.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                Tidak ada operator lain di divisi yang sama untuk dipilih.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Qty yang Dipindah *</label>
            <input
              type="text"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
              placeholder={`Kurang dari ${qtySaatIni}`}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-semibold">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || loadingRekan || rekanDivisi.length === 0}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Pindahkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
