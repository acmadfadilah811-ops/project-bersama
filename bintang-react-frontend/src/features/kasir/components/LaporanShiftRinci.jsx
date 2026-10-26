import React from 'react';

// Laporan rincian shift bergaya Olsera (Shift Saat Ini / setelah Akhiri Shift):
// Tunai (awal di laci, penjualan, pembayaran kredit, pembatalan, kas masuk-keluar),
// lalu tiap metode non-tunai (penjualan, pembayaran kredit, pembatalan), lalu Total
// Diharapkan. Dipakai di layar kasir (shift berjalan & laporan setelah shift ditutup)
// dan di drawer Detail Shift (Ringkasan Shift V2) supaya angkanya satu sumber:
// `rincian_metode` hasil api/services/shift_summary.calculate_shift_cash_summary.
//
// Istilah: "Pembayaran Kredit" = DP/pelunasan Order yang dibayar pada shift ini;
// "Pembatalan" = penjualan POS yang di-void pada shift ini (hanya informasi, tidak
// ikut dihitung sebagai penjualan).

const angka = (v) => Number(v) || 0;

export const formatRupiahTitik = (v) => {
  const n = Math.round(angka(v));
  return n.toLocaleString('de-DE');
};

const isTunai = (row) => {
  const tipe = String(row?.tipe || '').toLowerCase();
  const nama = String(row?.metode || '').toLowerCase();
  return tipe === 'tunai' || nama === 'tunai' || nama === 'cash';
};

function Baris({ label, nilai, tebal = false, redup = false, anak = false, warna = '' }) {
  return (
    <div className={`flex justify-between items-center py-2 pr-1 border-b border-slate-100 ${anak ? 'pl-6' : ''}`}>
      <span className={`${tebal ? 'font-extrabold text-slate-900' : 'font-semibold'} ${redup ? 'text-slate-400' : 'text-slate-600'}`}>
        {label}
      </span>
      <span className={`${tebal ? 'font-extrabold' : 'font-bold'} ${warna || (redup ? 'text-slate-400' : 'text-slate-900')}`}>
        {nilai}
      </span>
    </div>
  );
}

export default function LaporanShiftRinci({
  kasir,
  mulai,
  berakhir,
  kasAwal = 0,
  penjualanTunaiSnapshot = 0,
  metode = [],
  kasMasuk = 0,
  kasKeluar = 0,
  aktual = null,
  selisih = null,
  keterangan = '',
}) {
  const baris = Array.isArray(metode) ? metode : [];
  const tunai = baris.filter(isTunai);
  const lain = baris.filter((r) => !isTunai(r));

  const sum = (rows, key) => rows.reduce((total, r) => total + angka(r[key]), 0);
  // Snapshot lama (sebelum rincian per metode disimpan) tidak punya baris Tunai: pakai total
  // penjualan_tunai-nya supaya Kas Diharapkan tetap cocok.
  const penjualanTunai = tunai.length ? sum(tunai, 'pos') : angka(penjualanTunaiSnapshot);
  const kreditTunai = sum(tunai, 'order');
  const pembatalanTunai = sum(tunai, 'pembatalan');
  const kasMasukKeluar = angka(kasMasuk) - angka(kasKeluar);
  const totalTunai = angka(kasAwal) + penjualanTunai + kreditTunai + kasMasukKeluar;
  const totalDiharapkan = totalTunai + lain.reduce((total, r) => total + angka(r.total), 0);

  const adaAktual = aktual !== null && aktual !== undefined && aktual !== '';

  return (
    <div className="text-xs">
      <Baris label="Kasir" nilai={kasir || '-'} tebal />
      <Baris label="Mulai Shift" nilai={mulai || '-'} tebal />
      {berakhir ? <Baris label="Akhir Shift" nilai={berakhir} tebal /> : null}

      <Baris label="Tunai" nilai={formatRupiahTitik(totalTunai)} tebal />
      <Baris anak label="Awal di Laci" nilai={formatRupiahTitik(kasAwal)} />
      <Baris anak label="Penjualan Tunai" nilai={formatRupiahTitik(penjualanTunai)} />
      <Baris anak label="Pembayaran Kredit" nilai={formatRupiahTitik(kreditTunai)} />
      <Baris anak label="Pembatalan Tunai" nilai={formatRupiahTitik(pembatalanTunai)} redup />
      <Baris anak label="Kas Masuk-Keluar" nilai={`${kasMasukKeluar < 0 ? '-' : ''}${formatRupiahTitik(Math.abs(kasMasukKeluar))}`} />

      {lain.map((r) => (
        <React.Fragment key={`${r.metode}-${r.tipe}`}>
          <Baris label={String(r.metode || '').toUpperCase()} nilai={formatRupiahTitik(r.total)} tebal />
          <Baris anak label="Penjualan" nilai={formatRupiahTitik(r.pos)} />
          <Baris anak label="Pembayaran Kredit" nilai={formatRupiahTitik(r.order)} />
          <Baris anak label="Pembatalan" nilai={formatRupiahTitik(r.pembatalan)} redup />
        </React.Fragment>
      ))}

      <div className="mt-2 border-t-2 border-slate-300">
        <Baris label="Total Diharapkan" nilai={formatRupiahTitik(totalDiharapkan)} tebal />
      </div>

      {adaAktual ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1">
          <Baris label="Kas Diharapkan di Laci" nilai={formatRupiahTitik(totalTunai)} />
          <Baris label="Kas Aktual" nilai={formatRupiahTitik(aktual)} tebal />
          <div className="flex justify-between items-center py-2">
            <span className="font-extrabold text-slate-900">Selisih</span>
            <span className={`font-extrabold ${angka(selisih) === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {`${angka(selisih) < 0 ? '-' : angka(selisih) > 0 ? '+' : ''}${formatRupiahTitik(Math.abs(angka(selisih)))}`}
            </span>
          </div>
        </div>
      ) : null}

      {keterangan ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-[10px] text-slate-400 font-bold block">Keterangan</span>
          <p className="text-slate-700 font-semibold whitespace-pre-wrap">{keterangan}</p>
        </div>
      ) : null}
    </div>
  );
}
