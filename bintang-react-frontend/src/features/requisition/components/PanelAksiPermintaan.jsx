import { useState } from 'react';

// Panel kecil untuk aksi yang butuh masukan: setujui/siapkan (atur qty per bahan)
// dan tolak (alasan wajib). Aksi tanpa masukan (terima, batalkan) tidak lewat sini.

const JUDUL = {
  setujui: 'Setujui permintaan',
  siapkan: 'Tandai bahan disiapkan',
  tolak: 'Tolak permintaan',
};

const kunciQty = { setujui: 'qty_disetujui', siapkan: 'qty_disiapkan' };
const batasQty = { setujui: 'qty_diminta', siapkan: 'qty_disetujui' };

export default function PanelAksiPermintaan({ permintaan, aksi, sibuk, onKonfirmasi, onBatal }) {
  const perluQty = aksi === 'setujui' || aksi === 'siapkan';
  const [qty, setQty] = useState(() =>
    Object.fromEntries(permintaan.items.map((i) => [i.item_id, String(Number(i[batasQty[aksi]] ?? 0))])),
  );
  const [alasan, setAlasan] = useState('');

  const konfirmasi = () => {
    if (aksi === 'tolak') onKonfirmasi({ alasan });
    else onKonfirmasi({ [kunciQty[aksi]]: qty });
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <p className="text-xs font-bold text-slate-700">{JUDUL[aksi]}</p>

      {perluQty &&
        permintaan.items.map((i) => (
          <label key={i.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <span className="truncate">
              {i.item_nama}
              <span className="text-slate-400"> (maks {Number(i[batasQty[aksi]] ?? 0)} {i.satuan})</span>
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={qty[i.item_id]}
              onChange={(e) => setQty((prev) => ({ ...prev, [i.item_id]: e.target.value }))}
              className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs"
            />
          </label>
        ))}

      {aksi === 'tolak' && (
        <textarea
          rows={2}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="Alasan penolakan (wajib)"
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        />
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onBatal} className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded">
          Batal
        </button>
        <button
          type="button"
          disabled={sibuk || (aksi === 'tolak' && !alasan.trim())}
          onClick={konfirmasi}
          className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
        >
          Konfirmasi
        </button>
      </div>
    </div>
  );
}
