import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { AlertTriangle, Loader2, Printer } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';
import { uiConfirm } from '../../../utils/dialog';

/**
 * Catatan atas Laporan Keuangan (CALK) -- draf otomatis acuan SAK EP (2026-11-15).
 * Disusun dari Neraca, Laba Rugi, Perubahan Ekuitas, register aset tetap, dan piutang pesanan.
 */
const rp = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
const tgl = (v) => (v ? dayjs(v).format('DD MMM YYYY') : '-');

function Judul({ nomor, children }) {
  return <h2 className="mt-8 mb-3 text-sm font-bold text-slate-900">{nomor}. {children}</h2>;
}

function TabelRincian({ baris, total }) {
  if (!baris.length) return <p className="text-xs text-slate-400">Tidak ada saldo pada periode ini.</p>;
  return (
    <table className="w-full text-xs">
      <tbody>
        {baris.map((b) => (
          <tr key={b.kode} className="border-b border-slate-100">
            <td className="py-1.5 pr-3 text-slate-500 w-24">{b.kode}</td>
            <td className="py-1.5 text-slate-700">{b.nama}</td>
            <td className="py-1.5 text-right tabular-nums text-slate-800">{rp(b.nilai)}</td>
          </tr>
        ))}
        <tr className="font-bold text-slate-900">
          <td />
          <td className="py-2">Jumlah</td>
          <td className="py-2 text-right tabular-nums">{rp(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function TutupSaldoAwal({ akunEkuitas, onSelesai }) {
  const [tujuan, setTujuan] = useState('');
  const [tanggal, setTanggal] = useState(dayjs().format('YYYY-MM-DD'));
  const [proses, setProses] = useState(false);
  const kirim = async () => {
    if (!tujuan) return;
    const akun = akunEkuitas.find((a) => String(a.id) === String(tujuan));
    if (!(await uiConfirm(`Pindahkan seluruh saldo akun Saldo Awal ke ${akun?.code} ${akun?.name} per ${tanggal}? Jurnal akan diposting.`))) return;
    setProses(true);
    try {
      const { data } = await apiClient.post('/accounting/reports/tutup-saldo-awal/', { akun_tujuan: tujuan, tanggal });
      notify({ type: 'success', title: 'Saldo Awal ditutup', message: `Jurnal ${data.entry_number} diposting.` });
      onSelesai();
    } catch (error) {
      notifyApiError(error, 'Gagal menutup akun Saldo Awal');
    } finally {
      setProses(false);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
      <select value={tujuan} onChange={(e) => setTujuan(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
        <option value="">Pilih akun ekuitas tujuan</option>
        {akunEkuitas.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
      </select>
      <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
      <button type="button" disabled={!tujuan || proses} onClick={kirim} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
        {proses ? 'Memposting...' : 'Tutup akun Saldo Awal'}
      </button>
    </div>
  );
}

export default function Calk() {
  const [mode, setMode] = useState('Tahun');
  const [acuan, setAcuan] = useState(dayjs());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [akunEkuitas, setAkunEkuitas] = useState([]);

  const rentang = useMemo(() => {
    const satuan = mode === 'Tahun' ? 'year' : 'month';
    return { from: acuan.startOf(satuan).format('YYYY-MM-DD'), to: acuan.endOf(satuan).format('YYYY-MM-DD') };
  }, [acuan, mode]);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/accounting/reports/calk/', { params: { date_from: rentang.from, date_to: rentang.to } });
      setData(res.data);
    } catch (error) {
      setData(null);
      notifyApiError(error, 'Gagal menyusun CALK');
    } finally {
      setLoading(false);
    }
  }, [rentang]);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    apiClient.get('/accounting/accounts/', { params: { semua_akun: true } })
      .then((res) => setAkunEkuitas((res.data.results || res.data).filter((a) => a.account_type === 'equity' && !a.is_contra && a.is_active && a.code !== '34000')))
      .catch(() => {});
  }, []);

  const saldoAwalTerbuka = (data?.belum_diterapkan || []).some((b) => b.includes('Saldo Awal'));
  let nomor = 0;
  const no = () => { nomor += 1; return nomor; };

  return (
    <div className="space-y-4 text-slate-800">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 print:hidden">
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {['Bulan', 'Tahun'].map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-3 py-1 text-xs font-bold ${mode === m ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{m}</button>
          ))}
        </div>
        {mode === 'Bulan' ? (
          <input type="month" value={acuan.format('YYYY-MM')} onChange={(e) => e.target.value && setAcuan(dayjs(`${e.target.value}-01`))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
        ) : (
          <input type="number" min="2020" max="2100" value={acuan.year()} onChange={(e) => setAcuan(acuan.year(Number(e.target.value) || acuan.year()))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
        )}
        <button type="button" onClick={() => window.print()} className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <Printer size={14} /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="relative min-h-[400px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-xs font-bold text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin" /> Menyusun CALK...
          </div>
        )}
        {data && (
          <>
            <div className="text-center">
              <p className="text-base font-bold text-slate-900">{data.umum.nama_usaha}</p>
              <p className="text-sm font-semibold">Catatan atas Laporan Keuangan</p>
              <p className="text-xs text-slate-500">Periode {tgl(data.umum.periode_mulai)} s.d. {tgl(data.umum.periode_akhir)}</p>
              <p className="mt-1 text-[11px] italic text-slate-400">{data.catatan}</p>
            </div>

            <Judul nomor={no()}>Informasi umum</Judul>
            <table className="text-xs"><tbody>
              {[
                ['Nama usaha', data.umum.nama_usaha],
                ['Standar akuntansi', data.umum.standar],
                ['Mata uang penyajian', data.umum.mata_uang],
                ['Mulai pembukuan di sistem', tgl(data.umum.mulai_pembukuan)],
              ].map(([k, v]) => <tr key={k}><td className="py-1 pr-6 text-slate-500">{k}</td><td className="py-1">{v}</td></tr>)}
            </tbody></table>

            <Judul nomor={no()}>Ikhtisar kebijakan akuntansi</Judul>
            <ol className="list-[lower-alpha] space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
              {data.kebijakan.map((k) => <li key={k.judul}><b>{k.judul}.</b> {k.isi}</li>)}
            </ol>

            {data.rincian.map((r) => (
              <div key={r.judul}>
                <Judul nomor={no()}>{r.judul}</Judul>
                <TabelRincian baris={r.baris} total={r.total} />
              </div>
            ))}

            <Judul nomor={no()}>Aset tetap</Judul>
            {data.aset_tetap.aset.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada aset tetap terdaftar di register aset.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-xs">
                  <thead className="text-slate-500">
                    <tr className="border-b border-slate-200">
                      {['Aset', 'Perolehan', 'Saldo awal', 'Penambahan', 'Pelepasan', 'Saldo akhir', 'Akumulasi', 'Nilai buku', 'Penyusutan periode'].map((h, i) => (
                        <th key={h} className={`py-2 pr-3 font-semibold ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.aset_tetap.aset.map((a) => (
                      <tr key={a.kode} className="border-b border-slate-100">
                        <td className="py-1.5 pr-3">{a.kode} {a.nama}</td>
                        <td className="py-1.5 pr-3">{tgl(a.tanggal_perolehan)}</td>
                        {['saldo_awal', 'penambahan', 'pelepasan', 'saldo_akhir', 'akumulasi', 'nilai_buku', 'penyusutan_periode'].map((k) => (
                          <td key={k} className="py-1.5 pr-3 text-right tabular-nums">{rp(a[k])}</td>
                        ))}
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-2" colSpan={2}>Jumlah</td>
                      {['awal', 'tambah', 'lepas', 'akhir', 'akumulasi', 'nilai_buku', 'penyusutan_periode'].map((k) => (
                        <td key={k} className="py-2 pr-3 text-right tabular-nums">{rp(data.aset_tetap.jumlah[k])}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <Judul nomor={no()}>Umur piutang pesanan</Judul>
            <table className="text-xs"><tbody>
              {data.umur_piutang.map((u) => (
                <tr key={u.umur}>
                  <td className="py-1 pr-6 text-slate-500">{u.umur}</td>
                  <td className="py-1 pr-6 tabular-nums">{u.jumlah} pesanan</td>
                  <td className="py-1 text-right tabular-nums">{rp(u.nilai)}</td>
                </tr>
              ))}
            </tbody></table>

            <Judul nomor={no()}>Ringkasan laba</Judul>
            <table className="text-xs"><tbody>
              {[
                ['Laba kotor', data.ringkasan.laba_kotor], ['Laba usaha', data.ringkasan.laba_usaha],
                ['Laba sebelum pajak', data.ringkasan.laba_sebelum_pajak], ['Laba setelah pajak', data.ringkasan.laba_setelah_pajak],
                ['EBITDA', data.ringkasan.ebitda],
              ].map(([k, v]) => <tr key={k}><td className="py-1 pr-6 text-slate-500">{k}</td><td className="py-1 text-right tabular-nums">{rp(v)}</td></tr>)}
            </tbody></table>

            <Judul nomor={no()}>Hal yang belum diterapkan</Judul>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {data.belum_diterapkan.map((b) => (
                <li key={b} className="flex items-start gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />{b}</li>
              ))}
            </ul>
            {saldoAwalTerbuka && <TutupSaldoAwal akunEkuitas={akunEkuitas} onSelesai={muat} />}
          </>
        )}
      </div>
    </div>
  );
}
