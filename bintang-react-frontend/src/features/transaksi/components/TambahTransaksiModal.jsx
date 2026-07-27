import { useEffect, useRef, useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16); // untuk <input type="datetime-local">
};

/**
 * Modal "Tambah Pengeluaran" / "Tambah Pendapatan".
 * `mode` = 'pengeluaran' | 'pendapatan'. Tipe transaksi dipilih dari master
 * (difilter sesuai mode), staff dipilih dari daftar user.
 */
export default function TambahTransaksiModal({ mode = 'pengeluaran', currentUserId = '', onClose, onSave }) {
  const isPengeluaran = mode === 'pengeluaran';
  const fileRef = useRef(null);
  const [cents, setCents] = useState(0);
  const [tipeId, setTipeId] = useState('');
  const [staffId, setStaffId] = useState(currentUserId ? String(currentUserId) : '');
  const [catatan, setCatatan] = useState('');
  const [files, setFiles] = useState([]);
  const [waktu, setWaktu] = useState(nowLocal);
  const [saving, setSaving] = useState(false);

  const [tipeOptions, setTipeOptions] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, uRes] = await Promise.all([
          apiClient.get(`/cash-transaction-types/?tipe=${mode}`),
          apiClient.get('/users/'),
        ]);
        setTipeOptions(tRes.data.results || tRes.data || []);
        setStaffOptions(uRes.data.results || uRes.data || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [mode]);

  const jumlah = 'Rp. ' + (cents / 100).toLocaleString('id-ID', { minimumFractionDigits: 2 });
  const canSave = cents > 0 && tipeId && staffId && !saving;

  const onAmountChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setCents(digits ? parseInt(digits, 10) : 0);
  };

  const addFiles = (list) => {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave?.({
        tipe_transaksi: tipeId,
        staff: staffId,
        jumlah: cents / 100,
        waktu: new Date(waktu).toISOString(),
        catatan,
        files,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">
            {isPengeluaran ? 'Tambah Pengeluaran' : 'Tambah Pendapatan'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className={`text-sm font-semibold rounded-lg px-5 py-2 transition-colors ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Jumlah Transaksi</label>
            <input value={jumlah} onChange={onAmountChange} inputMode="numeric" className={inputClass} />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Tipe Transaksi</label>
            <select
              value={tipeId}
              onChange={(e) => setTipeId(e.target.value)}
              className={`${inputClass} cursor-pointer ${tipeId ? '' : 'text-slate-400'}`}
            >
              <option value="">
                {tipeOptions.length ? 'Pilih tipe transaksi' : `Belum ada tipe ${mode} — tambahkan di tab Tipe Transaksi`}
              </option>
              {tipeOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.nama}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">Staff</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className={`${inputClass} cursor-pointer ${staffId ? '' : 'text-slate-400'}`}
              >
                <option value="">Pilih salah satu</option>
                {staffOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">Tgl Transaksi</label>
              <input
                type="datetime-local"
                value={waktu}
                onChange={(e) => setWaktu(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* File Lampiran */}
          <div className="border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">File Lampiran</p>
              {files.length > 0 && (
                <ul className="mt-1 text-xs text-slate-500 space-y-0.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <FileText size={12} className="text-blue-500" /> {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm shrink-0"
            >
              <Plus size={16} /> Tambah
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
