import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, Loader2, Settings } from 'lucide-react';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import DetailTutupBuku from '../components/DetailTutupBuku';
import PengaturanTutupBukuDrawer from '../components/PengaturanTutupBukuDrawer';
import useAccountingPeriods from '../hooks/useAccountingPeriods';
import { closeAccountingPeriod, closeAllAccountingPeriods, fetchCurrentAccountingPeriod } from '../services/periods';

const formatDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export default function TutupBukuTokoIni() {
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [closeAllResult, setCloseAllResult] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { periods, loading, reload } = useAccountingPeriods(fiscalYear);
  const sortedPeriods = useMemo(() => [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date)), [periods]);
  // Periode berjalan dihitung server (tanggal potong di Pengaturan). Sebelum
  // terisi, tombol Tutup Buku Periode Berjalan tidak aktif.
  const [currentPeriod, setCurrentPeriod] = useState(null);
  useEffect(() => {
    fetchCurrentAccountingPeriod().then(setCurrentPeriod).catch(() => setCurrentPeriod(null));
  }, [settingsOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submitClose = async () => {
    if (!currentPeriod) return;
    setClosing(true);
    try {
      await closeAccountingPeriod(currentPeriod.start_date, currentPeriod.end_date);
      notifySuccess('Tutup buku berhasil', `Periode ${currentPeriod.nama} berhasil dikunci.`);
      setConfirmClose(false);
      await reload();
    } catch (error) {
      notifyApiError(error, 'Tutup buku ditolak. Perbaiki saldo atau jurnal terlebih dahulu.');
    } finally {
      setClosing(false);
    }
  };

  const submitCloseAll = async () => {
    setClosingAll(true);
    try {
      const result = await closeAllAccountingPeriods(fiscalYear);
      setConfirmCloseAll(false);
      setCloseAllResult(result);
      await reload();
    } catch (error) {
      notifyApiError(error, 'Tutup semua periode gagal diproses.');
    } finally {
      setClosingAll(false);
    }
  };

  if (selectedPeriod) return <DetailTutupBuku period={selectedPeriod} onBack={() => setSelectedPeriod(null)} />;

  return (
    <div className="space-y-4 pb-12 text-xs text-slate-700">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><h1 className="text-base font-bold text-slate-900">Tutup Buku</h1><p className="mt-1 text-slate-500">Pastikan saldo dan jurnal sudah benar sebelum menutup periode.</p></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold text-slate-600 hover:bg-slate-50" aria-label="Pengaturan Tutup Buku"><Settings size={14} />Pengaturan</button>
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-1.5 rounded-lg bg-[#52C41A] px-4 py-2 font-bold text-white hover:bg-green-600">
              Tutup Buku<ChevronDown size={14} className={menuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button type="button" disabled={!currentPeriod} onClick={() => { setMenuOpen(false); setConfirmClose(true); }} className="block w-full px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Tutup Buku Periode Berjalan{currentPeriod ? ` (${currentPeriod.nama})` : ''}</button>
                <button type="button" onClick={() => { setMenuOpen(false); setConfirmCloseAll(true); }} className="block w-full px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50">Tutup Buku Semua Bulan</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold text-slate-900">Daftar Periode</h2>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
            <button type="button" onClick={() => setFiscalYear((year) => year - 1)} className="rounded p-1.5 hover:bg-slate-100" aria-label="Tahun sebelumnya"><ChevronLeft size={16} /></button>
            <span className="min-w-14 text-center font-bold text-slate-900">{fiscalYear}</span>
            <button type="button" onClick={() => setFiscalYear((year) => year + 1)} className="rounded p-1.5 hover:bg-slate-100" aria-label="Tahun berikutnya"><ChevronRight size={16} /></button>
          </div>
        </div>
        {loading ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-400"><Loader2 className="animate-spin text-[#0088E8]" size={28} />Memuat periode...</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-500"><tr><th className="px-4 py-3">Tahun</th><th className="px-4 py-3">Periode</th><th className="px-4 py-3">Rentang Tanggal</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{sortedPeriods.length === 0 ? <tr><td colSpan={4} className="px-4 py-16 text-center text-slate-400">Belum ada data periode untuk tahun ini.</td></tr> : sortedPeriods.map((period) => {
              return <tr key={period.id} className="hover:bg-slate-50"><td className="px-4 py-3">{period.fiscal_year}</td><td className="px-4 py-3 font-semibold text-slate-900">{period.nama || '-'}<span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${period.status === 'closed' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{period.status === 'closed' ? 'Ditutup' : 'Terbuka'}</span></td><td className="px-4 py-3">{formatDate(period.start_date)} s/d {formatDate(period.end_date)}</td><td className="px-4 py-3 text-center"><button type="button" onClick={() => setSelectedPeriod(period)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold text-[#0088E8] hover:bg-blue-50"><Eye size={14} />Detail</button></td></tr>;
            })}</tbody>
          </table></div>
        )}
      </section>

      {confirmClose && currentPeriod && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h2 className="text-sm font-bold text-slate-900">Konfirmasi Tutup Buku</h2><p className="mt-2 leading-5 text-slate-600">Tutup buku periode {currentPeriod.nama} ({formatDate(currentPeriod.start_date)} s/d {formatDate(currentPeriod.end_date)})? Sistem akan menolak bila masih ada jurnal draft atau saldo akun abnormal negatif.</p>{currentPeriod.belum_berakhir && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 leading-5 text-amber-800"><b>Periode ini belum berakhir</b> (berakhir {formatDate(currentPeriod.end_date)}). Setelah ditutup, transaksi bertanggal sampai {formatDate(currentPeriod.end_date)} akan ditolak. Disarankan menutup setelah tanggal itu terlewati.</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmClose(false)} disabled={closing} className="rounded-lg border border-slate-300 px-3 py-2 font-bold hover:bg-slate-50 disabled:opacity-50">Batal</button><button type="button" onClick={submitClose} disabled={closing} className="rounded-lg bg-[#52C41A] px-3 py-2 font-bold text-white hover:bg-green-600 disabled:opacity-50">{closing ? 'Memproses...' : 'Tutup Buku'}</button></div></div></div>}

      {confirmCloseAll && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h2 className="text-sm font-bold text-slate-900">Konfirmasi Tutup Buku Semua Bulan</h2><p className="mt-2 leading-5 text-slate-600">Semua periode tahun {fiscalYear} yang masih Terbuka dan sudah berakhir akan ditutup satu per satu (bulan berjalan tidak ikut). Bulan yang gagal (mis. saldo negatif) akan dilewati dan dilaporkan, tidak menghentikan bulan lain.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmCloseAll(false)} disabled={closingAll} className="rounded-lg border border-slate-300 px-3 py-2 font-bold hover:bg-slate-50 disabled:opacity-50">Batal</button><button type="button" onClick={submitCloseAll} disabled={closingAll} className="rounded-lg bg-[#52C41A] px-3 py-2 font-bold text-white hover:bg-green-600 disabled:opacity-50">{closingAll ? 'Memproses...' : 'Tutup Semua'}</button></div></div></div>}

      {closeAllResult && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CheckCircle2 size={18} className="text-[#52C41A]" />Hasil Tutup Buku Semua Bulan</h2>
            <p className="mt-2 leading-5 text-slate-600">{closeAllResult.closed_count} periode berhasil ditutup, {closeAllResult.failed_count} periode gagal.</p>
            {closeAllResult.failed_count > 0 && (
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {closeAllResult.failed.map((item) => (
                  <div key={item.period.id} className="text-slate-600">
                    <p className="font-bold text-slate-900">{formatDate(item.period.start_date)} s/d {formatDate(item.period.end_date)}</p>
                    <p className="mt-0.5 leading-4">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end"><button type="button" onClick={() => setCloseAllResult(null)} className="rounded-lg bg-[#52C41A] px-3 py-2 font-bold text-white hover:bg-green-600">Tutup</button></div>
          </div>
        </div>
      )}

      <PengaturanTutupBukuDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
