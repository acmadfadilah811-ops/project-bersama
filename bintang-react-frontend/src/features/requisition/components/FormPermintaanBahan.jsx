import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { notifyApiError } from '../../../utils/notify';
import { listBahan } from '../services/requisitionApi';

const barisKosong = () => ({ kunci: crypto.randomUUID(), item_id: '', qty: '' });

export default function FormPermintaanBahan({ onKirim, onTutup }) {
  const [bahan, setBahan] = useState([]);
  const [baris, setBaris] = useState([barisKosong()]);
  const [keperluan, setKeperluan] = useState('');
  const [mengirim, setMengirim] = useState(false);

  useEffect(() => {
    listBahan().then(setBahan).catch((e) => notifyApiError(e, 'Gagal memuat daftar bahan baku.'));
  }, []);

  const ubah = (kunci, patch) => setBaris((prev) => prev.map((b) => (b.kunci === kunci ? { ...b, ...patch } : b)));
  const dipakai = new Set(baris.map((b) => b.item_id).filter(Boolean));
  const valid = baris.length > 0 && baris.every((b) => b.item_id && Number(b.qty) > 0);

  const kirim = async () => {
    setMengirim(true);
    const ok = await onKirim({
      keperluan,
      items: baris.map((b) => ({ item_id: b.item_id, qty: b.qty })),
    });
    setMengirim(false);
    if (ok) onTutup();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">Ajukan Permintaan Bahan</h2>
          <button type="button" onClick={onTutup} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 p-4 max-h-[70vh] overflow-y-auto">
          {baris.map((b) => {
            const terpilih = bahan.find((x) => x.id === b.item_id);
            return (
              <div key={b.kunci} className="flex items-center gap-2">
                <select
                  value={b.item_id}
                  onChange={(e) => ubah(b.kunci, { item_id: e.target.value })}
                  className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Pilih bahan...</option>
                  {bahan.map((x) => (
                    <option key={x.id} value={x.id} disabled={dipakai.has(x.id) && x.id !== b.item_id}>
                      {x.nama} (stok {x.stok} {x.satuan})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={b.qty}
                  onChange={(e) => ubah(b.kunci, { qty: e.target.value })}
                  placeholder="Qty"
                  className="w-20 rounded border border-slate-300 px-2 py-1.5 text-right text-xs"
                />
                <span className="w-12 text-[11px] text-slate-400">{terpilih?.satuan || ''}</span>
                <button
                  type="button"
                  disabled={baris.length === 1}
                  onClick={() => setBaris((prev) => prev.filter((x) => x.kunci !== b.kunci))}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setBaris((prev) => [...prev, barisKosong()])}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            <Plus size={13} /> Tambah bahan
          </button>

          <textarea
            rows={2}
            value={keperluan}
            onChange={(e) => setKeperluan(e.target.value)}
            placeholder="Keperluan (mis. cetak banner order ORD-...)"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={onTutup} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">
            Batal
          </button>
          <button
            type="button"
            disabled={!valid || mengirim}
            onClick={kirim}
            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
          >
            {mengirim ? 'Mengirim...' : 'Ajukan'}
          </button>
        </div>
      </div>
    </div>
  );
}
