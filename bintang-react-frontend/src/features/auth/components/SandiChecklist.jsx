import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { kriteriaSandi } from '../utils/kriteriaSandi';

// Catatan kriteria di bawah kolom sandi. Sebelum pengguna mengetik: lingkaran abu-abu
// (netral). Setelah mengetik: centang hijau bila terpenuhi, silang merah bila belum.
function Baris({ ok, netral, label }) {
  let Ikon = Circle;
  let warna = 'text-slate-400';
  if (!netral) {
    Ikon = ok ? CheckCircle2 : XCircle;
    warna = ok ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold';
  }
  return (
    <li className={`flex items-center gap-2 text-xs ${warna}`}>
      <Ikon size={14} className="shrink-0" />
      <span>{label}</span>
    </li>
  );
}

export default function SandiChecklist({ sandi, konfirmasi, username }) {
  const mulaiMengetik = sandi.length > 0;
  return (
    <ul className="pt-1 space-y-1" aria-label="Kriteria kata sandi">
      {kriteriaSandi(sandi, username).map((k) => (
        <Baris key={k.id} ok={k.ok} netral={!mulaiMengetik} label={k.label} />
      ))}
      <Baris
        ok={konfirmasi.length > 0 && sandi === konfirmasi}
        netral={konfirmasi.length === 0}
        label="Sama dengan konfirmasi"
      />
      <li className="text-[11px] text-slate-400 pl-6">
        Hindari kata sandi yang umum (mis. 12345678, password); server akan menolaknya.
      </li>
    </ul>
  );
}
