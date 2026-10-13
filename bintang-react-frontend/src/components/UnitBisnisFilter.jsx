import { useAuth } from '../context/AuthContext';
import {
  UNIT_BELUM_DITANDAI,
  UNIT_SEMUA,
  bolehKelompokUnit,
  useDaftarUnitBisnis,
} from '../utils/unitBisnis';

// Pengelompokan per unit bisnis di Pesanan & Papan Kerja (2026-10-14); logika di utils/unitBisnis.js.

/**
 * Tombol pilih unit bisnis.
 * `jumlah`: [{id, jumlah}] (id null = belum ditandai) untuk menampilkan angka di tiap tombol.
 */
export default function UnitBisnisFilter({ value, onChange, jumlah = null, className = '' }) {
  const { user } = useAuth();
  const daftar = useDaftarUnitBisnis();
  if (!bolehKelompokUnit(user?.role) || daftar.length === 0) return null;

  const hitung = (id) => {
    if (!jumlah) return null;
    const baris = jumlah.find((j) => (j.id ?? null) === id);
    return baris ? baris.jumlah : 0;
  };
  const total = jumlah ? jumlah.reduce((s, j) => s + j.jumlah, 0) : null;
  const belumDitandai = hitung(null);

  const pilihan = [
    { nilai: UNIT_SEMUA, label: 'Semua Unit', angka: total },
    ...daftar.map((u) => ({ nilai: String(u.id), label: u.nama, angka: hitung(u.id) })),
  ];
  if (belumDitandai) {
    pilihan.push({ nilai: UNIT_BELUM_DITANDAI, label: 'Belum ditandai', angka: belumDitandai });
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="filter-unit-bisnis">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        Unit Bisnis
      </span>
      <div className="flex gap-1 bg-slate-100/50 p-1 rounded-md border border-slate-200 overflow-x-auto">
        {pilihan.map((p) => (
          <button
            key={p.nilai || 'semua'}
            type="button"
            onClick={() => onChange(p.nilai)}
            className={`px-3 py-1 rounded text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
              (value || '') === p.nilai
                ? 'bg-slate-900 text-white shadow-sm border border-slate-900'
                : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            {p.label}
            {p.angka !== null && p.angka !== undefined && (
              <span className={`ml-1 font-semibold ${(value || '') === p.nilai ? 'text-slate-300' : 'text-slate-400'}`}>
                {p.angka}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
