import { useState } from 'react';
import PanelAksiPermintaan from './PanelAksiPermintaan';

const WARNA_STATUS = {
  diajukan: 'bg-amber-100 text-amber-800',
  disetujui: 'bg-blue-100 text-blue-800',
  disiapkan: 'bg-indigo-100 text-indigo-800',
  diterima: 'bg-emerald-100 text-emerald-800',
  ditolak: 'bg-red-100 text-red-800',
  batal: 'bg-slate-200 text-slate-600',
};

const LABEL_AKSI = {
  setujui: { teks: 'Setujui', gaya: 'bg-emerald-600 hover:bg-emerald-700 text-white', panel: true },
  tolak: { teks: 'Tolak', gaya: 'border border-red-300 text-red-700 hover:bg-red-50', panel: true },
  siapkan: { teks: 'Tandai Disiapkan', gaya: 'bg-indigo-600 hover:bg-indigo-700 text-white', panel: true },
  terima: { teks: 'Sudah Diterima', gaya: 'bg-emerald-600 hover:bg-emerald-700 text-white', panel: false },
  batalkan: { teks: 'Batalkan', gaya: 'border border-slate-300 text-slate-600 hover:bg-slate-100', panel: false },
};

const angka = (v) => (v === null || v === undefined ? '-' : Number(v));
const waktu = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

export default function KartuPermintaanBahan({ permintaan: p, sibuk, onAksi }) {
  const [panel, setPanel] = useState(null);

  const klik = (nama) => {
    if (LABEL_AKSI[nama].panel) setPanel(nama);
    else if (nama !== 'batalkan' || window.confirm('Batalkan permintaan ini?')) onAksi(p.id, nama, {});
  };

  const konfirmasi = async (body) => {
    if (await onAksi(p.id, panel, body)) setPanel(null);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold text-indigo-700">{p.nomor}</p>
          <p className="text-[11px] text-slate-500">
            {p.pemohon_nama}
            {p.divisi_nama ? ` · ${p.divisi_nama}` : ''} · {waktu(p.created_at)}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${WARNA_STATUS[p.status]}`}>
          {p.status_display}
        </span>
      </div>

      {p.keperluan && <p className="text-xs text-slate-600 italic">&ldquo;{p.keperluan}&rdquo;</p>}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase text-slate-400 text-left">
            <th className="py-1">Bahan</th>
            <th className="py-1 text-right">Diminta</th>
            <th className="py-1 text-right">Disetujui</th>
            <th className="py-1 text-right">Disiapkan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {p.items.map((i) => (
            <tr key={i.id}>
              <td className="py-1 text-slate-700">
                {i.item_nama}
                <span className="text-slate-400"> ({i.satuan})</span>
              </td>
              <td className="py-1 text-right">{angka(i.qty_diminta)}</td>
              <td className="py-1 text-right">{angka(i.qty_disetujui)}</td>
              <td className="py-1 text-right">{angka(i.qty_disiapkan)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {p.status === 'ditolak' && (
        <p className="text-xs text-red-700 bg-red-50 rounded p-2">Ditolak: {p.catatan_penolakan}</p>
      )}

      {panel ? (
        <PanelAksiPermintaan
          permintaan={p}
          aksi={panel}
          sibuk={sibuk}
          onKonfirmasi={konfirmasi}
          onBatal={() => setPanel(null)}
        />
      ) : (
        p.aksi.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-slate-100">
            {p.aksi.map((nama) => (
              <button
                key={nama}
                type="button"
                disabled={sibuk}
                onClick={() => klik(nama)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg disabled:opacity-50 ${LABEL_AKSI[nama].gaya}`}
              >
                {LABEL_AKSI[nama].teks}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
