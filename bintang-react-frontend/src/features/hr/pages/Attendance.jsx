import { useState, useEffect } from 'react';
import { Search, FileSpreadsheet, Info, AlertCircle, Save, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function Attendance() {
  const [absensiList, setAbsensiList] = useState([]);
  const [loading, setLoading] = useState(true);

  // State untuk Kalender dan Filter
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivisi, setSelectedDivisi] = useState('Semua Divisi');
  const [divisiList, setDivisiList] = useState([]);

  // State untuk Modals (Detail & Jadwal)
  const [detailData, setDetailData] = useState(null);
  const [jadwalData, setJadwalData] = useState(null);

  // State untuk Keterangan/Catatan
  const [notes, setNotes] = useState({});
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Mengirim parameter tanggal ke API (Format YYYY-MM-DD)
      const res = await apiClient.get('/hr/absensi/', { params: { tanggal: selectedDate } });
      setAbsensiList(res.data);

      // Set inisial data keterangan/catatan ke dalam state
      const initialNotes = {};
      res.data.forEach((item) => {
        initialNotes[item.id] = item.catatan || '';
      });
      setNotes(initialNotes);
    } catch (err) {
      console.error('Error fetching absensi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient
      .get('/divisi/')
      .then((res) => setDivisiList(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]); // Auto fetch setiap kali tanggal diubah

  const handleSaveNote = async (id) => {
    setSavingNoteId(id);
    try {
      await apiClient.patch(`/hr/absensi/${id}/`, { catatan: notes[id] });
      // Flash color atau feedback sukses sederhana (opsional)
    } catch (error) {
      console.error('Gagal menyimpan catatan:', error);
      alert('Gagal menyimpan keterangan. Coba lagi.');
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleToggleWorkspaceLock = async (id, currentStatus) => {
    try {
      await apiClient.patch(`/hr/absensi/${id}/`, {
        workspace_unlocked: !currentStatus,
      });
      fetchData();
    } catch (err) {
      console.error('Gagal mengubah kunci papan kerja:', err);
      alert('Gagal memperbarui status kunci papan kerja.');
    }
  };

  // Filter data berdasarkan input pencarian & divisi
  const filteredList = absensiList.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      (item.staff_nama && item.staff_nama.toLowerCase().includes(query)) ||
      (item.divisi_nama && item.divisi_nama.toLowerCase().includes(query));
    const matchDivisi = selectedDivisi === 'Semua Divisi' || item.divisi_nama === selectedDivisi;
    return matchSearch && matchDivisi;
  });

  // Hitung ringkasan dinamis dari data yang sudah difilter
  const summary = {
    sesuai: filteredList.filter((a) => a.status === 'hadir' && a.durasi_kerja_jam >= 7).length,
    tidakMasuk: filteredList.filter((a) => a.status === 'alpha').length,
    pulangCepat: filteredList.filter((a) => a.durasi_kerja_jam > 0 && a.durasi_kerja_jam < 7)
      .length,
    terlambat: filteredList.filter((a) => {
      if (!a.jam_masuk) return false;
      const h = new Date(a.jam_masuk).getHours();
      return h >= 9; // Anggap masuk di atas jam 9 itu terlambat
    }).length,
    cuti: filteredList.filter((a) => a.status === 'izin' || a.status === 'sakit').length,
    lembur: filteredList.filter((a) => a.durasi_kerja_jam > 8).length,
  };

  // Format data tabel
  const attendanceData = filteredList.map((item) => {
    const formatTime = (isoString) => {
      if (!isoString) return '-';
      return new Date(isoString).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    let lembur = '-';
    let warnaLembur = '';
    if (item.durasi_kerja_jam > 8) {
      const lemburJam = Math.floor(item.durasi_kerja_jam - 8);
      const lemburMenit = Math.round((item.durasi_kerja_jam - 8 - lemburJam) * 60);
      lembur = `${lemburJam} Jam ${lemburMenit} Menit`;
      warnaLembur = 'green';
    }

    const jam = Math.floor(item.durasi_kerja_jam || 0);
    const menit = Math.round(((item.durasi_kerja_jam || 0) - jam) * 60);
    const totalJam = item.durasi_kerja_jam > 0 ? `${jam} Jam ${menit} Menit` : '-';

    return {
      id: item.id,
      nama: item.staff_nama,
      divisi: item.divisi_nama || 'Belum Ditentukan',
      status: item.status.toUpperCase(),
      masuk: formatTime(item.jam_masuk),
      pulang: formatTime(item.jam_keluar),
      warnaMasuk: item.jam_masuk
        ? new Date(item.jam_masuk).getHours() >= 9
          ? 'red'
          : 'purple'
        : 'blue',
      warnaPulang: item.jam_keluar ? 'blue' : 'red',
      lembur: lembur,
      warnaLembur: warnaLembur,
      totalJam: totalJam,
      errorTotal: item.jam_masuk && !item.jam_keluar,
      textStatus: item.status === 'alpha' ? 'text-red-500' : 'text-slate-600',
      workspace_unlocked: item.workspace_unlocked,
    };
  });

  // Helper function untuk warna background & border cell tabel
  const getColorClasses = (color) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 border-l-4 border-blue-500 text-slate-800';
      case 'red':
        return 'bg-red-50 border-l-4 border-red-500 text-slate-800';
      case 'purple':
        return 'bg-purple-50 border-l-4 border-purple-400 text-slate-800';
      case 'green':
        return 'bg-emerald-50 border-l-4 border-emerald-500 text-slate-800';
      default:
        return 'bg-slate-50 border-l-4 border-slate-300 text-slate-800';
    }
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await apiClient.get('/export/absensi/', {
        params: { tanggal: selectedDate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `absensi_${selectedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Gagal mengekspor data absensi.');
    } finally {
      setExporting(false);
    }
  };

  // Format Tanggal untuk Header Ringkasan
  const displayDate = new Date(selectedDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-3 max-w-7xl mx-auto pb-4 animate-fade-in relative">
      <div>
        <h1 className="text-sm font-bold text-slate-800">Data Absensi Harian</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 space-y-4">
        {/* Baris Filter & Pencarian */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* INPUT CALENDAR */}
            <div className="flex items-center gap-1.5 border border-slate-300 rounded-md px-2.5 py-1 text-[11px] text-slate-700 bg-white hover:bg-slate-50 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 cursor-pointer"
              />
            </div>

            <select
              value={selectedDivisi}
              onChange={(e) => setSelectedDivisi(e.target.value)}
              className="flex items-center gap-1.5 border border-slate-300 rounded-md px-2.5 py-1 text-[11px] text-slate-700 bg-white cursor-pointer hover:bg-slate-50 focus:outline-none focus:border-blue-500"
            >
              <option value="Semua Divisi">Semua Divisi</option>
              {divisiList.map((div) => (
                <option key={div.id} value={div.nama}>
                  {div.nama}
                </option>
              ))}
            </select>

            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-md px-3 py-1.5 text-[11px] font-bold hover:bg-emerald-100 transition-colors shadow-sm disabled:opacity-50"
            >
              <FileSpreadsheet size={13} /> {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>

          <div className="relative w-full md:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau divisi..."
              className="w-full pl-2.5 pr-8 py-1.5 border border-slate-300 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search size={12} className="absolute right-2.5 top-2 text-slate-400" />
          </div>
        </div>

        {/* Kotak Status Kehadiran */}
        <div className="border border-slate-200 rounded-md overflow-hidden">
          <div className="border-b border-slate-200 px-3 py-2 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-slate-800 font-bold text-xs inline-block border-b-2 border-blue-500 pb-0.5">
              Status Kehadiran Staff
            </h2>
            <span className="font-semibold text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              {displayDate}
            </span>
          </div>

          <div className="bg-slate-50/30 px-3 py-2.5 grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="p-1">
              <p className="text-[10px] text-slate-500 font-bold leading-tight">Sesuai Jadwal</p>
              <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 mt-1">
                <span className="w-2 h-2 bg-blue-500 rounded-sm"></span> {summary.sesuai}
              </div>
            </div>
            <div className="p-1">
              <p className="text-[10px] text-slate-500 font-bold leading-tight">Tidak Masuk</p>
              <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 mt-1">
                <span className="w-2 h-2 bg-red-500 rounded-sm"></span> {summary.tidakMasuk}
              </div>
            </div>
            <div className="p-1">
              <p className="text-[10px] text-slate-500 font-bold leading-tight">Pulang Cepat</p>
              <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 mt-1">
                <span className="w-2 h-2 bg-slate-300 rounded-sm"></span> {summary.pulangCepat}
              </div>
            </div>
            <div className="p-1">
              <p className="text-[10px] text-slate-500 font-bold leading-tight">Terlambat</p>
              <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 mt-1">
                <span className="w-2 h-2 bg-purple-400 rounded-sm"></span> {summary.terlambat}
              </div>
            </div>
            <div className="p-1">
              <p className="text-[10px] text-slate-500 font-bold leading-tight">Cuti</p>
              <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 mt-1">
                <span className="w-2 h-2 bg-amber-400 rounded-sm"></span> {summary.cuti}
              </div>
            </div>
            <div className="p-1">
              <p className="text-[10px] text-slate-500 font-bold leading-tight">Lembur</p>
              <div className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 mt-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-sm"></span> {summary.lembur}
              </div>
            </div>
          </div>
        </div>

        {/* Indikator Loading Data */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-medium">Memuat data absensi...</p>
          </div>
        )}

        {/* Tabel Data Absensi */}
        {!loading && (
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left text-[11px] whitespace-nowrap">
              <thead className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <tr>
                  <th className="py-2 px-2 font-semibold">Nama Staff</th>
                  <th className="py-2 px-2 font-semibold">Divisi</th>
                  <th className="py-2 px-2 font-semibold">Status</th>
                  <th className="py-2 px-2 font-semibold text-center">Jam Masuk</th>
                  <th className="py-2 px-2 font-semibold text-center">Jam Pulang</th>
                  <th className="py-2 px-2 font-semibold text-left">Lembur</th>
                  <th className="py-2 px-2 font-semibold text-left">Total Jam Kerja</th>
                  <th className="py-2 px-2 font-semibold">Keterangan</th>
                  <th className="py-2 px-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {attendanceData.length > 0 ? (
                  attendanceData.map((row) => (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2 px-2 font-bold capitalize">{row.nama}</td>
                      <td className="py-2 px-2 text-slate-500">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold">
                          {row.divisi === 'Belum Ditentukan' && (
                            <Info size={11} className="text-blue-500" />
                          )}
                          {row.divisi}
                        </div>
                      </td>
                      <td className={`py-2 px-2 font-medium ${row.textStatus || 'text-slate-600'}`}>
                        {row.status}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <div
                          className={`px-2 py-1 mx-auto rounded font-bold text-[10px] w-20 text-center ${getColorClasses(row.warnaMasuk)}`}
                        >
                          {row.masuk}
                        </div>
                      </td>
                      <td className="py-1 px-2 text-center">
                        <div
                          className={`px-2 py-1 mx-auto rounded font-bold text-[10px] w-20 text-center ${getColorClasses(row.warnaPulang)}`}
                        >
                          {row.pulang}
                        </div>
                      </td>
                      <td className="py-1 px-2 text-left">
                        {row.lembur === '-' ? (
                          <span className="text-slate-400 pl-2">-</span>
                        ) : (
                          <div
                            className={`px-2 py-1.5 rounded font-bold text-[10px] inline-block ${getColorClasses(row.warnaLembur)}`}
                          >
                            {row.lembur}
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-2 text-left">
                        {row.errorTotal ? (
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold pl-1">
                            <AlertCircle size={14} className="text-white fill-red-500" /> -
                          </div>
                        ) : (
                          <span className="text-slate-600 font-medium pl-2">{row.totalJam}</span>
                        )}
                      </td>

                      {/* Kolom Keterangan / Catatan */}
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Tulis keterangan..."
                            value={notes[row.id] || ''}
                            onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                            className="w-32 px-2 py-1 text-[10px] border border-slate-300 rounded focus:outline-none focus:border-blue-500 bg-white"
                          />
                          <button
                            onClick={() => handleSaveNote(row.id)}
                            disabled={savingNoteId === row.id}
                            title="Simpan Keterangan"
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50"
                          >
                            {savingNoteId === row.id ? (
                              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Save size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-2 px-2 text-right">
                        <div className="flex justify-end gap-1 items-center">
                          {row.masuk !== '-' && (
                            <button
                              onClick={() =>
                                handleToggleWorkspaceLock(row.id, row.workspace_unlocked)
                              }
                              className={`border px-2 py-1 rounded text-[10px] font-bold shadow-sm transition-all ${
                                row.workspace_unlocked
                                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                              title={
                                row.workspace_unlocked
                                  ? 'Kunci kembali papan kerja staff'
                                  : 'Buka kunci papan kerja staff'
                              }
                            >
                              {row.workspace_unlocked ? 'Papan Terbuka' : 'Buka Papan'}
                            </button>
                          )}
                          <button
                            onClick={() => setDetailData(row)}
                            className="border border-slate-200 bg-white text-slate-700 px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-50 shadow-sm"
                          >
                            Detail
                          </button>
                          <button
                            onClick={() => setJadwalData(row)}
                            className="border border-slate-200 bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-200 shadow-sm"
                          >
                            Jadwal
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      Tidak ada data absensi untuk tanggal atau kriteria ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETAIL */}
      {detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 relative animate-fade-in border border-slate-100">
            <button
              onClick={() => setDetailData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-base text-slate-800 mb-4 border-b border-slate-100 pb-2">
              Detail Absensi Harian
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Nama Staff:</span>
                <span className="font-bold text-slate-800 capitalize">{detailData.nama}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Tanggal:</span>
                <span className="font-bold text-slate-800">{displayDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Status Kehadiran:</span>
                <span className="font-bold text-blue-600 uppercase">{detailData.status}</span>
              </div>

              <div className="my-2 border-t border-slate-100"></div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Waktu Masuk:</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">
                  {detailData.masuk}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Waktu Pulang:</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">
                  {detailData.pulang}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Lembur:</span>
                <span className="font-bold text-emerald-600">{detailData.lembur}</span>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 mt-2 flex justify-between items-center">
                <span className="font-bold text-blue-700">Total Jam Kerja:</span>
                <span className="font-black text-blue-800 text-sm">{detailData.totalJam}</span>
              </div>
            </div>

            <button
              onClick={() => setDetailData(null)}
              className="mt-5 w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Tutup Detail
            </button>
          </div>
        </div>
      )}

      {/* MODAL JADWAL (DIVISI) */}
      {jadwalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 relative animate-fade-in border border-slate-100">
            <button
              onClick={() => setJadwalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-base text-slate-800 mb-4 border-b border-slate-100 pb-2">
              Informasi Jadwal & Divisi
            </h3>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Nama Staff:</span>
                <span className="font-bold text-slate-800 capitalize">{jadwalData.nama}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Divisi saat ini:</span>
                <span className="font-bold text-slate-800 uppercase">{jadwalData.divisi}</span>
              </div>

              <div className="p-3 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg mt-3 leading-relaxed">
                <Info size={14} className="inline mr-1.5 -mt-0.5 text-amber-600" />
                Staff ini dijadwalkan secara otomatis mengikuti jadwal default pada divisi{' '}
                <strong>{jadwalData.divisi}</strong>. Fitur kustomisasi *shift* manual masih dalam
                tahap pengembangan.
              </div>
            </div>

            <button
              onClick={() => setJadwalData(null)}
              className="mt-5 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Kembali
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
