import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import AssetForm from './AssetForm';
import { fetchAsetDariHR, prosesAsetDariHR, selesaiTinjauAsetDariHR, tolakAsetDariHR } from '../../services/assets';
import { notify, notifyApiError } from '../../../../utils/notify';
import { uiPrompt } from '../../../../utils/dialog';

/**
 * Antrean aset yang dipilih HR untuk masuk akuntansi (2026-11-10). Kiriman HR belum
 * menjurnal apa pun; Finance melengkapi akun & umur manfaat lalu "Proses" -> jadi aset
 * tetap + jurnal perolehan. "Tolak" = bukan aset tetap (dibebankan langsung).
 */
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

const TAB = [
  { id: 'menunggu', label: 'Menunggu' },
  { id: 'tinjau', label: 'Perlu Ditinjau' },
  { id: 'diproses', label: 'Sudah Diproses' },
  { id: 'ditolak', label: 'Ditolak' },
  { id: 'ditarik', label: 'Ditarik HR' },
];

export default function AsetDariHRPanel({ accounts, onChanged }) {
  const [tab, setTab] = useState('menunggu');
  const [data, setData] = useState({ jumlah: {}, hasil: [] });
  const [loading, setLoading] = useState(true);
  const [proses, setProses] = useState(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAsetDariHR(tab));
    } catch (error) {
      notifyApiError(error, 'Gagal memuat aset dari HR');
    } finally {
      setLoading(false);
    }
  }, [tab]);
  useEffect(() => { muat(); }, [muat]);

  const tolak = async (row) => {
    const alasan = await uiPrompt(`Alasan menolak ${row.kode} - ${row.nama} (mis. di bawah batas aset tetap, dibebankan langsung):`, '');
    if (alasan === null) return;
    try {
      await tolakAsetDariHR(row.id, alasan);
      notify({ type: 'success', title: 'Ditolak', message: `${row.kode} tidak dicatat sebagai aset tetap.` });
      muat();
    } catch (error) {
      notifyApiError(error, 'Gagal menolak aset');
    }
  };

  const selesaiTinjau = async (row) => {
    try {
      await selesaiTinjauAsetDariHR(row.id);
      muat();
    } catch (error) {
      notifyApiError(error, 'Gagal menandai selesai ditinjau');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
        {TAB.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {t.label}
            {t.id === 'menunggu' && data.jumlah?.menunggu > 0 && <span className="ml-1.5 rounded-full bg-[#0088E8] px-1.5 text-[10px] text-white">{data.jumlah.menunggu}</span>}
            {t.id === 'tinjau' && data.jumlah?.tinjau > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{data.jumlah.tinjau}</span>}
          </button>
        ))}
        <p className="ml-auto text-[11px] font-medium text-slate-400">
          Aset dipilih di HR (Aset &gt; Kirim ke Akuntansi). Belum ada jurnal sampai diproses di sini.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto min-h-[260px]">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Memuat...</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Aset</th>
                <th className="px-4 py-3">Pemegang</th>
                <th className="px-4 py-3">Tanggal Beli</th>
                <th className="px-4 py-3 text-right">Harga x Jumlah</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.hasil.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400 font-bold">Tidak ada data.</td></tr>
              ) : data.hasil.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-bold text-[#0088E8]">{row.kode}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{row.nama}</div>
                    <div className="text-[10px] text-slate-400">{row.kategori || 'Tanpa kategori'} · status HR: {row.status_hr || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.pemegang || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.tanggal_beli}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{money.format(row.harga)} x {row.jumlah}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{money.format(row.harga_total)}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-500 max-w-[220px]">
                    {row.perlu_ditinjau && (
                      <span className="flex items-start gap-1 text-amber-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" />Data/status di HR berubah; cek perlu pelepasan aset?</span>
                    )}
                    {row.kode_aset_akuntansi && <span>Aset tetap: {row.kode_aset_akuntansi}</span>}
                    {row.alasan_tolak && <span>{row.alasan_tolak}</span>}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {row.status === 'menunggu' && (
                      <>
                        <button type="button" onClick={() => setProses(row)} className="px-2.5 py-1 rounded-lg bg-[#0088E8] text-white font-bold hover:bg-[#0077CC]">Proses</button>
                        <button type="button" onClick={() => tolak(row)} className="ml-1.5 px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">Tolak</button>
                      </>
                    )}
                    {row.perlu_ditinjau && (
                      <button type="button" onClick={() => selesaiTinjau(row)} className="px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">Selesai Ditinjau</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {proses && (
        <AssetForm
          key={proses.id}
          accounts={accounts}
          title={`Proses Aset dari HR: ${proses.kode}`}
          initial={{
            ...proses.usulan,
            acquisition_cost: proses.usulan?.acquisition_cost ?? proses.harga_total,
            useful_life_months: proses.usulan?.useful_life_months ?? '',
            description: `Dari HR: ${proses.kategori || '-'}, pemegang ${proses.pemegang || '-'}.`,
          }}
          info={(
            <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-[11px] font-medium leading-relaxed text-sky-800">
              Dari HR: {proses.nama} ({proses.kategori || 'tanpa kategori'}), {money.format(proses.harga)} x {proses.jumlah} unit.
              Lengkapi akun, umur manfaat, dan akun pembayaran. Aset yang dibeli sebelum Mulai Akuntansi: centang saldo awal
              dan isi akumulasi penyusutan awal.
            </div>
          )}
          onSave={async (payload) => {
            await prosesAsetDariHR(proses.id, payload);
            await muat();
            onChanged?.();
          }}
          onClose={() => setProses(null)}
        />
      )}
    </div>
  );
}
