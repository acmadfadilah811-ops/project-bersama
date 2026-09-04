import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import {
  BookOpen,
  Calendar,
  Filter,
  FileText,
  Download,
  Info,
  Archive,
} from 'lucide-react';
import dayjs from 'dayjs';

export default function BukuBesar() {
  const [akunList, setAkunList] = useState([]);
  const [bukuBesarData, setBukuBesarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // State Filter
  const [filter, setFilter] = useState({
    akun_id: '',
    start_date: dayjs().startOf('month').format('YYYY-MM-DD'),
    end_date: dayjs().endOf('month').format('YYYY-MM-DD'),
  });

  // Saldo awal dari backend
  const [saldoAwal, setSaldoAwal] = useState(0);

  const fetchDaftarAkun = async () => {
    try {
      const res = await apiClient.get('/finance/akun/');
      setAkunList(res.data);
      if (res.data.length > 0) {
        setFilter((prev) => ({ ...prev, akun_id: res.data[0].id }));
      }
    } catch (err) {
      console.error('Gagal memuat daftar akun:', err);
    }
  };

  useEffect(() => {
    fetchDaftarAkun();
  }, []);

  const fetchBukuBesar = async () => {
    if (!filter.akun_id) return alert('Pilih akun terlebih dahulu!');

    try {
      setLoading(true);
      const res = await apiClient.get('/finance/buku-besar/', { params: filter });
      setBukuBesarData(res.data.transaksi || []);
      setSaldoAwal(res.data.saldo_awal || 0);
    } catch (err) {
      console.error('Gagal memuat buku besar:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch ketika akun_id di-set pertama kali oleh daftar akun
  useEffect(() => {
    if (filter.akun_id) {
      fetchBukuBesar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.akun_id]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  // Identifikasi kategori akun terpilih & aturan normal balance
  const selectedAkunObj = akunList.find((a) => String(a.id) === String(filter.akun_id));
  const kategoriAkun = selectedAkunObj ? (selectedAkunObj.kategori || '').toLowerCase() : '';

  // Kewajiban (Utang), Ekuitas (Modal), Pendapatan memiliki saldo normal KREDIT
  const isCreditNormal =
    kategoriAkun.includes('kewajiban') ||
    kategoriAkun.includes('utang') ||
    kategoriAkun.includes('ekuitas') ||
    kategoriAkun.includes('modal') ||
    kategoriAkun.includes('pendapatan') ||
    kategoriAkun.includes('revenue');

  const exportToCSV = () => {
    if (bukuBesarData.length === 0) return alert('Tidak ada data untuk diexport!');

    const headers = ['Tanggal', 'No. Referensi', 'Keterangan', 'Debit', 'Kredit', 'Saldo'];
    let csvContent = headers.join(',') + '\n';

    let current = saldoAwal;
    csvContent += `,,Saldo Awal,,,${current}\n`;

    bukuBesarData.forEach((trx) => {
      const d = parseFloat(trx.debit) || 0;
      const k = parseFloat(trx.kredit) || 0;
      if (isCreditNormal) {
        current = current + k - d;
      } else {
        current = current + d - k;
      }
      const row = [
        dayjs(trx.tanggal).format('YYYY-MM-DD'),
        `"${trx.no_referensi || ''}"`,
        `"${trx.keterangan || ''}"`,
        d,
        k,
        current,
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Buku_Besar_${selectedAkunObj?.nama_akun || 'Akun'}_${filter.start_date}_${filter.end_date}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka || 0);

  // FE-17: hitung saldo berjalan SEBELUM render, bukan dengan memutasi
  // variabel `let` di tengah .map() JSX. Mutasi saat render adalah
  // anti-pattern React (bisa salah saat re-render/strict mode) dan sebelumnya
  // dipakai bersama key={index} yang tidak stabil. React Compiler yang
  // memoize otomatis, jadi tidak perlu useMemo manual di sini.
  const rowsWithSaldo = (() => {
    let running = saldoAwal;
    return bukuBesarData.map((trx) => {
      const d = parseFloat(trx.debit) || 0;
      const k = parseFloat(trx.kredit) || 0;
      running = isCreditNormal ? running + k - d : running + d - k;
      return { ...trx, _d: d, _k: k, _saldo: running };
    });
  })();

  // Menghitung total mutasi dan saldo akhir
  const totalDebit = bukuBesarData.reduce((sum, trx) => sum + (parseFloat(trx.debit) || 0), 0);
  const totalKredit = bukuBesarData.reduce((sum, trx) => sum + (parseFloat(trx.kredit) || 0), 0);

  const saldoAkhir = isCreditNormal
    ? saldoAwal + totalKredit - totalDebit
    : saldoAwal + totalDebit - totalKredit;

  // Warna kategori lencana (badge)
  const getKategoriBadge = (kat) => {
    const k = kat.toLowerCase();
    if (k.includes('aset') || k.includes('harta')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (k.includes('kewajiban') || k.includes('utang')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (k.includes('ekuitas') || k.includes('modal')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    } else if (k.includes('pendapatan') || k.includes('revenue')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (k.includes('beban') || k.includes('biaya')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 w-full text-slate-800">
      {/* Title Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-250 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="text-blue-600" /> Buku Besar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Induk pencatatan mutasi transaksi keuangan berdasarkan klasifikasi rekening (General
            Ledger).
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Info size={14} /> {showGuide ? 'Tutup Panduan' : 'Panduan Akun'}
          </button>
          <button
            onClick={exportToCSV}
            disabled={bukuBesarData.length === 0}
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* T-206: ledger legacy ini dibekukan (M3) — arsip saja, transaksi baru
          harus lewat Akuntansi Internal (accounting.JournalEntry). */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
        <Archive className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <p className="text-[11px] text-amber-800 leading-relaxed">
          Buku Besar ini adalah <span className="font-bold">arsip data lama</span> dan sudah tidak
          menerima transaksi baru. Untuk pencatatan jurnal saat ini, gunakan menu{' '}
          <span className="font-bold">Akuntansi Internal</span>.
        </p>
      </div>

      {/* Panduan Kategori Akun */}
      {showGuide && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Info className="text-blue-600" size={18} />
            <h3 className="font-extrabold text-slate-800 text-sm">
              Panduan 5 Kategori Akun Utama (Percetakan)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Aset */}
            <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-4 space-y-2">
              <h4 className="font-extrabold text-blue-800 text-xs uppercase tracking-wider">
                Aset (Harta)
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Segala sesuatu yang dimiliki perusahaan dan bernilai uang.
              </p>
              <div className="text-[10px] text-slate-600 space-y-1.5 pt-1 border-t border-blue-100/50">
                <p>
                  <span className="font-bold text-slate-700">Kas & Bank:</span> Uang tunai kasir &
                  saldo rekening bank.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Piutang Usaha:</span> Tagihan
                  tempo/invoice pelanggan cetak.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Persediaan:</span> Kertas berbagai
                  ukuran, tinta, pelat, lem.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Aset Tetap:</span> Mesin cetak
                  offset/digital, pemotong, komputer desain.
                </p>
              </div>
            </div>

            {/* Kewajiban */}
            <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-4 space-y-2">
              <h4 className="font-extrabold text-amber-800 text-xs uppercase tracking-wider">
                Kewajiban (Utang)
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Kewajiban finansial perusahaan kepada pihak luar.
              </p>
              <div className="text-[10px] text-slate-600 space-y-1.5 pt-1 border-t border-amber-100/50">
                <p>
                  <span className="font-bold text-slate-700">Utang Usaha:</span> Tagihan belum
                  dibayar ke supplier kertas/tinta.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Utang Bank:</span> Cicilan pembelian
                  kredit mesin cetak.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Utang Pajak:</span> Pajak PPN atau PPh
                  yang wajib disetor.
                </p>
              </div>
            </div>

            {/* Ekuitas */}
            <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-4 space-y-2">
              <h4 className="font-extrabold text-purple-800 text-xs uppercase tracking-wider">
                Ekuitas (Modal)
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Hak kepemilikan atas aset setelah dikurangi kewajiban.
              </p>
              <div className="text-[10px] text-slate-600 space-y-1.5 pt-1 border-t border-purple-100/50">
                <p>
                  <span className="font-bold text-slate-700">Modal Pemilik:</span> Suntikan dana
                  awal dari pemilik/investor.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Laba Ditahan:</span> Akumulasi
                  keuntungan yang diputar kembali.
                </p>
              </div>
            </div>

            {/* Pendapatan */}
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 space-y-2">
              <h4 className="font-extrabold text-emerald-800 text-xs uppercase tracking-wider">
                Pendapatan
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Aliran uang masuk dari aktivitas bisnis percetakan.
              </p>
              <div className="text-[10px] text-slate-600 space-y-1.5 pt-1 border-t border-emerald-100/50">
                <p>
                  <span className="font-bold text-slate-700">Jasa Cetak:</span> Hasil cetak buku,
                  kalender, brosur, dll.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Lain-lain:</span> Hasil penjualan
                  limbah kertas afkir/potong.
                </p>
              </div>
            </div>

            {/* Beban */}
            <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-4 space-y-2">
              <h4 className="font-extrabold text-rose-800 text-xs uppercase tracking-wider">
                Beban (Biaya)
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Pengeluaran untuk menjaga operasional berjalan.
              </p>
              <div className="text-[10px] text-slate-600 space-y-1.5 pt-1 border-t border-rose-100/50">
                <p>
                  <span className="font-bold text-slate-700">HPP:</span> Pembelian kertas & tinta
                  terpakai produksi.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Operasional:</span> Gaji staff, listrik
                  industri, pemeliharaan mesin.
                </p>
                <p>
                  <span className="font-bold text-slate-700">Penyusutan:</span> Penurunan nilai
                  mesin seiring usia pakai.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1.5 w-full">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Akun Rekening
          </label>
          <select
            name="akun_id"
            value={filter.akun_id}
            onChange={handleFilterChange}
            className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none bg-slate-50 font-bold focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="">-- Pilih Akun --</option>
            {akunList.map((akun) => (
              <option key={akun.id} value={akun.id}>
                {akun.kode_akun} - {akun.nama_akun} ({akun.kategori})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-1.5 w-full">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar size={12} /> Tanggal Mulai
          </label>
          <input
            type="date"
            name="start_date"
            value={filter.start_date}
            onChange={handleFilterChange}
            className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold"
          />
        </div>

        <div className="flex-1 space-y-1.5 w-full">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar size={12} /> Tanggal Akhir
          </label>
          <input
            type="date"
            name="end_date"
            value={filter.end_date}
            onChange={handleFilterChange}
            className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold"
          />
        </div>

        <button
          onClick={fetchBukuBesar}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 w-full md:w-auto justify-center cursor-pointer shadow-sm"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <Filter size={14} />
          )}
          Tampilkan
        </button>
      </div>

      {/* Account Info Summary Widget */}
      {selectedAkunObj && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Akun Aktif
            </p>
            <h4 className="text-base font-extrabold text-slate-800 truncate">
              {selectedAkunObj.nama_akun}
            </h4>
            <p className="text-xs font-mono text-slate-500">Kode: {selectedAkunObj.kode_akun}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Klasifikasi & Saldo Normal
            </p>
            <div>
              <span
                className={`inline-block border text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${getKategoriBadge(selectedAkunObj.kategori)}`}
              >
                {selectedAkunObj.kategori}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">
              Kenaikan dicatat di sisi{' '}
              <span className="font-extrabold text-slate-700">
                {isCreditNormal ? 'Kredit (-)' : 'Debit (+)'}
              </span>
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Awal periode
            </p>
            <h4 className="text-sm font-extrabold text-slate-800">{formatRupiah(saldoAwal)}</h4>
            <p className="text-[10px] text-slate-400">
              Sebelum {dayjs(filter.start_date).format('DD MMM YYYY')}
            </p>
          </div>

          <div className="space-y-1 bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Saldo Akhir
            </p>
            <h4
              className={`text-base font-black ${saldoAkhir >= 0 ? 'text-blue-700' : 'text-rose-600'}`}
            >
              {formatRupiah(saldoAkhir)}
            </h4>
            <p className="text-[9px] text-slate-500 font-medium">
              Akumulasi per {dayjs(filter.end_date).format('DD MMM YYYY')}
            </p>
          </div>
        </div>
      )}

      {/* Tabel Buku Besar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-5 py-3.5 w-32">Tanggal</th>
                <th className="px-3 py-3.5 w-32">Ref</th>
                <th className="px-4 py-3.5">Keterangan</th>
                <th className="px-4 py-3.5 text-right w-40">Debit</th>
                <th className="px-4 py-3.5 text-right w-40">Kredit</th>
                <th className="px-5 py-3.5 text-right w-44">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
              {/* Baris Saldo Awal */}
              <tr className="bg-slate-50/50">
                <td className="px-5 py-3 text-slate-400 italic">
                  {dayjs(filter.start_date).format('DD MMM YYYY')}
                </td>
                <td className="px-3 py-3 font-mono text-slate-400">-</td>
                <td className="px-4 py-3 text-slate-400 font-bold italic text-right">Saldo Awal</td>
                <td className="px-4 py-3 text-right text-slate-300">-</td>
                <td className="px-4 py-3 text-right text-slate-300">-</td>
                <td className="px-5 py-3 text-right font-black text-blue-700 bg-blue-50/20">
                  {formatRupiah(saldoAwal)}
                </td>
              </tr>

              {rowsWithSaldo.length > 0 ? (
                rowsWithSaldo.map((trx, index) => {
                  const d = trx._d;
                  const k = trx._k;
                  const currentSaldo = trx._saldo;

                  return (
                    <tr key={trx.id ?? index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">{dayjs(trx.tanggal).format('DD MMM YYYY')}</td>
                      <td className="px-3 py-3.5 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                        {trx.no_referensi || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-800 font-medium">{trx.keterangan}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-600 font-bold">
                        {d > 0 ? formatRupiah(d) : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-rose-500 font-bold">
                        {k > 0 ? formatRupiah(k) : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-extrabold text-slate-850">
                        {formatRupiah(currentSaldo)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    <FileText className="mx-auto mb-2 opacity-30" size={32} />
                    <p className="text-xs">
                      Tidak ada mutasi transaksi pada rentang tanggal terpilih.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
