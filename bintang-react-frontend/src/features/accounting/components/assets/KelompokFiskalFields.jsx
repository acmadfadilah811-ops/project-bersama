/**
 * Pilihan kelompok & metode penyusutan pajak (UU PPh Pasal 11, PMK 72/2023), 2026-11-10.
 * Dipakai form Tambah Aset dan Ubah Aset. Bangunan hanya garis lurus.
 */
export const KELOMPOK_FISKAL = [
  ['', 'Belum diatur'],
  ['k1', 'Kelompok 1 - 4 tahun (komputer, perabot ringan)'],
  ['k2', 'Kelompok 2 - 8 tahun (mesin ringan, kendaraan kecil)'],
  ['k3', 'Kelompok 3 - 16 tahun (mesin industri berat)'],
  ['k4', 'Kelompok 4 - 20 tahun (alat berat)'],
  ['bangunan_permanen', 'Bangunan permanen - 20 tahun'],
  ['bangunan_non_permanen', 'Bangunan tidak permanen - 10 tahun'],
  ['tidak', 'Tidak disusutkan (tanah)'],
];

export default function KelompokFiskalFields({ kelompok, metode, onChange, inputClass, labelClass }) {
  const bangunan = kelompok === 'bangunan_permanen' || kelompok === 'bangunan_non_permanen';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1.5 block">
        <span className={labelClass}>Kelompok Pajak</span>
        <select
          value={kelompok}
          onChange={(e) => {
            const v = e.target.value;
            const b = v === 'bangunan_permanen' || v === 'bangunan_non_permanen';
            onChange({ kelompok_fiskal: v, metode_fiskal: b ? 'garis_lurus' : metode });
          }}
          className={inputClass}
        >
          {KELOMPOK_FISKAL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 block">
        <span className={labelClass}>Metode Pajak</span>
        <select
          value={bangunan ? 'garis_lurus' : metode}
          disabled={bangunan || !kelompok || kelompok === 'tidak'}
          onChange={(e) => onChange({ kelompok_fiskal: kelompok, metode_fiskal: e.target.value })}
          className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
        >
          <option value="garis_lurus">Garis lurus</option>
          <option value="saldo_menurun">Saldo menurun</option>
        </select>
      </label>
    </div>
  );
}
