import { useState } from 'react';

const JENIS = {
  kewajiban: { label: 'Kewajiban ke pihak ketiga (BPJS, pajak)', tipeAkun: 'liability' },
  piutang: { label: 'Piutang karyawan (kasbon/cicilan)', tipeAkun: 'asset' },
  pengurang_beban: { label: 'Pengurang biaya gaji (denda telat)', tipeAkun: null },
};

function FormPemetaan({ judul, akun, sedangProses, onSimpan }) {
  const [jenis, setJenis] = useState('kewajiban');
  const [akunId, setAkunId] = useState('');
  const [akunIuran, setAkunIuran] = useState('');
  const tipe = JENIS[jenis].tipeAkun;
  const pilihan = tipe ? akun.filter((a) => a.account_type === tipe) : [];
  const hutang = akun.filter((a) => a.account_type === 'liability');
  const valid = jenis === 'pengurang_beban' || akunId;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
      <span className="text-xs font-semibold text-amber-900 min-w-32">{judul}</span>
      <select value={jenis} onChange={(e) => { setJenis(e.target.value); setAkunId(''); }}
        className="rounded border border-slate-300 px-2 py-1 text-xs">
        {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      {tipe && (
        <select value={akunId} onChange={(e) => setAkunId(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
          <option value="">Akun...</option>
          {pilihan.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
        </select>
      )}
      {jenis === 'kewajiban' && (
        <select value={akunIuran} onChange={(e) => setAkunIuran(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
          <option value="">Akun hutang iuran perusahaan (jika ada)...</option>
          {hutang.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
        </select>
      )}
      <button type="button" disabled={!valid || sedangProses}
        onClick={() => onSimpan({
          judul, jenis, akun: akunId ? Number(akunId) : null,
          akun_iuran_perusahaan: akunIuran ? Number(akunIuran) : null,
        })}
        className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded">
        Simpan
      </button>
    </div>
  );
}

export default function PemetaanKomponenGaji({ komponenHr, pemetaan, akun, sedangProses, onSimpan, onHapus }) {
  const terpetakan = new Set(pemetaan.map((p) => p.judul));
  const belum = [...new Set(komponenHr.map((k) => k.judul).filter((j) => j && !terpetakan.has(j)))];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800">Pemetaan Komponen Potongan HR</h3>
      <p className="text-xs text-slate-500">
        Setiap judul potongan di slip HR harus dipetakan sebelum bisa diposting. Yang belum dipetakan menolak posting.
      </p>
      {belum.map((j) => (
        <FormPemetaan key={j} judul={j} akun={akun} sedangProses={sedangProses} onSimpan={onSimpan} />
      ))}
      {pemetaan.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {pemetaan.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800">{p.judul}</span>
              <span className="text-slate-500 truncate">
                {JENIS[p.jenis]?.label} {p.akun_display ? `→ ${p.akun_display}` : ''}
                {p.akun_iuran_perusahaan_display ? ` · iuran: ${p.akun_iuran_perusahaan_display}` : ''}
              </span>
              <button type="button" disabled={sedangProses}
                onClick={() => window.confirm(`Hapus pemetaan "${p.judul}"?`) && onHapus(p.id)}
                className="text-red-600 hover:underline">
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}
      {belum.length === 0 && pemetaan.length === 0 && (
        <p className="text-xs text-slate-400">Belum ada komponen potongan di slip final periode ini.</p>
      )}
    </div>
  );
}
