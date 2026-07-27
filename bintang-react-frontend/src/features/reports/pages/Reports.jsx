import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/apiClient';
import {
  Briefcase,
  CheckCircle,
  AlertCircle,
  Search,
  Grid,
  Download,
  Users,
  Coins,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  UserCheck,
  Building,
} from 'lucide-react';

export default function Reports() {
  const [reportData, setReportData] = useState([]);
  const [detailedJobs, setDetailedJobs] = useState([]);
  const [range, setRange] = useState('bulan_ini');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Navigation Tabs: 'global' | 'divisi' | 'staff'
  const [activeTab, setActiveTab] = useState('global');

  // Expanded views
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const [expandedDivisi, setExpandedDivisi] = useState(null);

  // --- Spreadsheet States & Functions ---
  const [spreadsheetGrid, setSpreadsheetGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null); // { r, c }
  const [pivotConfig, setPivotConfig] = useState({
    rowField: 'staff', // 'staff' | 'divisi' | 'produk'
    valField: 'insentif', // 'insentif' | 'durasi' | 'qty'
    aggType: 'sum', // 'sum' | 'avg' | 'count'
  });

  const evaluateCell = (formulaStr, currentGrid) => {
    if (!formulaStr || !String(formulaStr).startsWith('=')) {
      return formulaStr;
    }
    const cleanFormula = String(formulaStr).substring(1).toUpperCase().trim();
    
    // Pattern matches like SUM(J3:J12)
    const match = cleanFormula.match(/^([A-Z]+)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
    if (!match) {
      return '#VALUE!';
    }
    
    const [_, func, colStartLetter, rowStartStr, colEndLetter, rowEndStr] = match;
    const startRow = parseInt(rowStartStr) - 1;
    const endRow = parseInt(rowEndStr) - 1;
    
    const letterToIdx = (l) => l.charCodeAt(0) - 65; // A=0, B=1, ...
    const startCol = letterToIdx(colStartLetter);
    const endCol = letterToIdx(colEndLetter);
    
    // Gather values in range
    const values = [];
    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        if (currentGrid[r] && currentGrid[r][c]) {
          const val = parseFloat(currentGrid[r][c].computed || currentGrid[r][c].value || 0);
          if (!isNaN(val)) {
            values.push(val);
          }
        }
      }
    }
    
    if (func === 'SUM') {
      return values.reduce((sum, v) => sum + v, 0);
    }
    if (func === 'AVERAGE' || func === 'AVG') {
      return values.length > 0 ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1) : 0;
    }
    if (func === 'COUNT') {
      return values.length;
    }
    if (func === 'MIN') {
      return values.length > 0 ? Math.min(...values) : 0;
    }
    if (func === 'MAX') {
      return values.length > 0 ? Math.max(...values) : 0;
    }
    
    return '#REF!';
  };

  const recalculateGrid = (currentGrid) => {
    const newGrid = currentGrid.map((row) => row.map((cell) => ({ ...cell })));
    for (let pass = 0; pass < 2; pass++) {
      for (let r = 0; r < newGrid.length; r++) {
        for (let c = 0; c < newGrid[r].length; c++) {
          const cell = newGrid[r][c];
          if (cell.value && String(cell.value).startsWith('=')) {
            cell.computed = String(evaluateCell(cell.value, newGrid));
          } else {
            cell.computed = cell.value;
          }
        }
      }
    }
    return newGrid;
  };

  const initSpreadsheetWithJobs = useCallback(() => {
    const ROWS = 35;
    const COLS = 11;
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push({ value: '', computed: '' });
      }
      grid.push(row);
    }
    
    const headers = [
      'Date',        // A
      'Job ID',      // B
      'Order ID',    // C
      'Customer',    // D
      'Product',     // E
      'Qty',         // F
      'Division',    // G
      'PIC Staff',   // H
      'Duration (m)',// I
      'Incentive (Rp)', // J
      'HPP Bahan'    // K
    ];
    headers.forEach((h, idx) => {
      grid[0][idx] = { value: h, computed: h, isHeader: true };
    });
    
    const maxJobs = Math.min(detailedJobs.length, 25);
    for (let i = 0; i < maxJobs; i++) {
      const job = detailedJobs[i];
      const r = i + 1;
      grid[r][0] = { value: job.waktu_selesai || '', computed: job.waktu_selesai || '' };
      grid[r][1] = { value: job.id || '', computed: String(job.id || '') };
      grid[r][2] = { value: job.order_id || '', computed: String(job.order_id || '') };
      grid[r][3] = { value: job.order_nama || '', computed: job.order_nama || '' };
      grid[r][4] = { value: job.jenis_produk || '', computed: job.jenis_produk || '' };
      grid[r][5] = { value: job.qty || 0, computed: String(job.qty || 0) };
      grid[r][6] = { value: job.divisi || '', computed: job.divisi || '' };
      grid[r][7] = { value: job.pic_fullname || '', computed: job.pic_fullname || '' };
      grid[r][8] = { value: job.durasi_menit || 0, computed: String(job.durasi_menit || 0) };
      grid[r][9] = { value: job.insentif || 0, computed: String(job.insentif || 0) };
      grid[r][10] = { value: job.hpp_bahan || 0, computed: String(job.hpp_bahan || 0) };
    }
    
    const totalRowIdx = maxJobs + 2;
    if (totalRowIdx < ROWS) {
      grid[totalRowIdx][0] = { value: 'Total / Rata-rata', computed: 'Total / Rata-rata', isLabel: true };
      grid[totalRowIdx][5] = { value: `=SUM(F2:F${totalRowIdx})`, computed: '' };
      grid[totalRowIdx][8] = { value: `=AVERAGE(I2:I${totalRowIdx})`, computed: '' };
      grid[totalRowIdx][9] = { value: `=SUM(J2:J${totalRowIdx})`, computed: '' };
      grid[totalRowIdx][10] = { value: `=SUM(K2:K${totalRowIdx})`, computed: '' };
      
      grid[totalRowIdx - 1][5] = { value: 'Total Qty', computed: 'Total Qty', isLabel: true };
      grid[totalRowIdx - 1][8] = { value: 'Avg Dur', computed: 'Avg Dur', isLabel: true };
      grid[totalRowIdx - 1][9] = { value: 'Total Ins', computed: 'Total Ins', isLabel: true };
      grid[totalRowIdx - 1][10] = { value: 'Total HPP', computed: 'Total HPP', isLabel: true };
    }
    
    setSpreadsheetGrid(recalculateGrid(grid));
  }, [detailedJobs]);

  useEffect(() => {
    if (detailedJobs.length > 0) {
      initSpreadsheetWithJobs();
    }
  }, [detailedJobs, initSpreadsheetWithJobs]);

  const generatePivotTable = () => {
    const groups = {};
    detailedJobs.forEach((job) => {
      let key = 'Lainnya';
      if (pivotConfig.rowField === 'staff') key = job.pic_fullname || 'Tanpa Staff';
      else if (pivotConfig.rowField === 'divisi') key = job.divisi || 'Tanpa Divisi';
      else if (pivotConfig.rowField === 'produk') key = job.jenis_produk || 'Tanpa Produk';
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(job);
    });
    
    const ROWS = 35;
    const COLS = 11;
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push({ value: '', computed: '' });
      }
      grid.push(row);
    }
    
    grid[0][0] = { value: pivotConfig.rowField.toUpperCase(), computed: pivotConfig.rowField.toUpperCase(), isHeader: true };
    grid[0][1] = { value: `${pivotConfig.valField.toUpperCase()} (${pivotConfig.aggType.toUpperCase()})`, computed: `${pivotConfig.valField.toUpperCase()} (${pivotConfig.aggType.toUpperCase()})`, isHeader: true };
    
    let currentIdx = 1;
    Object.keys(groups).forEach((key) => {
      const jobs = groups[key];
      let finalVal = 0;
      
      const getVal = (job) => {
        if (pivotConfig.valField === 'insentif') return job.insentif || 0;
        if (pivotConfig.valField === 'durasi') return job.durasi_menit || 0;
        if (pivotConfig.valField === 'qty') return job.qty || 0;
        return 0;
      };
      
      if (pivotConfig.aggType === 'sum') {
        finalVal = jobs.reduce((sum, j) => sum + getVal(j), 0);
      } else if (pivotConfig.aggType === 'avg') {
        const total = jobs.reduce((sum, j) => sum + getVal(j), 0);
        finalVal = jobs.length > 0 ? (total / jobs.length).toFixed(1) : 0;
      } else if (pivotConfig.aggType === 'count') {
        finalVal = jobs.length;
      }
      
      grid[currentIdx][0] = { value: key, computed: key };
      grid[currentIdx][1] = { value: finalVal, computed: String(finalVal) };
      currentIdx++;
    });
    
    grid[currentIdx][0] = { value: 'GRAND TOTAL', computed: 'GRAND TOTAL', isLabel: true };
    grid[currentIdx][1] = { value: `=SUM(B2:B${currentIdx})`, computed: '' };
    
    setSpreadsheetGrid(recalculateGrid(grid));
  };

  const downloadSpreadsheetCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    spreadsheetGrid.forEach((row) => {
      const rowData = row.map((cell) => {
        const val = cell.computed !== undefined ? cell.computed : cell.value;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",");
      csvContent += rowData + "\r\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pivot_spreadsheet_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const fetchReport = useCallback(() => {
    setLoading(true);
    apiClient
      .get(`/reports/staff-performance/?range=${range}`)
      .then((res) => {
        setReportData(res.data.data || []);
        setDetailedJobs(res.data.detailed_jobs || []);
      })
      .catch((err) => {
        console.error('Gagal mengambil data laporan:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [range]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportExcel = (type = 'global', divisi = '', staffId = '') => {
    if (exporting) return;
    setExporting(true);

    let url = `/export/staff-performance/?range=${range}&type=${type}`;
    if (type === 'divisi' && divisi) {
      url += `&divisi=${encodeURIComponent(divisi)}`;
    } else if (type === 'staff' && staffId) {
      url += `&staff_id=${staffId}`;
    }

    apiClient
      .get(url, {
        responseType: 'blob',
      })
      .then((res) => {
        const urlObj = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = urlObj;

        let filename = `laporan_global_${range}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        if (type === 'divisi' && divisi) {
          filename = `laporan_divisi_${divisi.toLowerCase().replace(/\s+/g, '_')}_${range}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        } else if (type === 'staff' && staffId) {
          filename = `laporan_staff_${staffId}_${range}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        }

        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(urlObj);
      })
      .catch((err) => {
        console.error('Gagal mengunduh file Excel:', err);
        alert('Gagal mengunduh file Excel.');
      })
      .finally(() => {
        setExporting(false);
      });
  };

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka || 0);

  // Perhitungan Agregasi Global
  const totalCompleted = reportData.reduce((sum, item) => sum + item.jobs_completed, 0);
  const totalInprogress = reportData.reduce((sum, item) => sum + item.jobs_in_progress, 0);
  const totalPending = reportData.reduce((sum, item) => sum + item.jobs_pending, 0);
  const totalFailed = reportData.reduce((sum, item) => sum + item.jobs_failed, 0);
  const totalConstraint = reportData.reduce((sum, item) => sum + item.jobs_constraint, 0);
  const totalJobs = reportData.reduce((sum, item) => sum + item.jobs_total, 0);

  const totalInsentifGlobal = detailedJobs
    .filter((j) => j.status === 'selesai')
    .reduce((sum, item) => sum + (item.insentif || 0), 0);

  // Agregasi Kehadiran
  const totalOntime = reportData.reduce((sum, item) => sum + item.att_ontime, 0);
  const totalLate = reportData.reduce((sum, item) => sum + item.att_late, 0);
  const totalAlpha = reportData.reduce((sum, item) => sum + item.att_alpha, 0);
  const totalAttendance = totalOntime + totalLate + totalAlpha;
  const totalPresent = totalOntime + totalLate;

  // Staff Highlights
  const mostProductiveStaff = [...reportData].sort(
    (a, b) => b.jobs_completed - a.jobs_completed
  )[0];
  const mostLateStaff = [...reportData]
    .filter((x) => x.att_late > 0)
    .sort((a, b) => b.att_late - a.att_late)[0];
  const mostOntimeStaff = [...reportData]
    .filter((x) => x.att_ontime > 0)
    .sort((a, b) => b.att_ontime - a.att_ontime)[0];

  // Conic Gradients for Charts
  const pctOntime = totalAttendance > 0 ? (totalOntime / totalAttendance) * 100 : 100;
  const pctLate = totalAttendance > 0 ? (totalLate / totalAttendance) * 100 : 0;
  const attConic = `conic-gradient(
    #10b981 0% ${pctOntime}%,
    #f59e0b ${pctOntime}% ${pctOntime + pctLate}%,
    #ef4444 ${pctOntime + pctLate}% 100%
  )`;

  const pctSelesai = totalJobs > 0 ? (totalCompleted / totalJobs) * 100 : 100;
  const pctDikerjakan = totalJobs > 0 ? (totalInprogress / totalJobs) * 100 : 0;
  const pctAntrean = totalJobs > 0 ? (totalPending / totalJobs) * 100 : 0;
  const pctKendala = totalJobs > 0 ? (totalConstraint / totalJobs) * 100 : 0;
  const jobConic = `conic-gradient(
    #10b981 0% ${pctSelesai}%,
    #3b82f6 ${pctSelesai}% ${pctSelesai + pctDikerjakan}%,
    #6366f1 ${pctSelesai + pctDikerjakan}% ${pctSelesai + pctDikerjakan + pctAntrean}%,
    #a855f7 ${pctSelesai + pctDikerjakan + pctAntrean}% ${pctSelesai + pctDikerjakan + pctAntrean + pctKendala}%,
    #ef4444 ${pctSelesai + pctDikerjakan + pctAntrean + pctKendala}% 100%
  )`;

  // Group detailed jobs by Division
  const divisionGroups = detailedJobs.reduce((acc, job) => {
    const div = job.divisi || 'Tanpa Divisi';
    if (!acc[div]) {
      acc[div] = {
        name: div,
        jobs: [],
        totalIncentive: 0,
        totalDuration: 0,
        completedCount: 0,
        failedCount: 0,
      };
    }
    acc[div].jobs.push(job);
    if (job.status === 'selesai') {
      acc[div].totalIncentive += job.insentif;
      acc[div].completedCount += 1;
      acc[div].totalDuration += job.durasi_menit;
    } else if (job.status === 'gagal' || job.status === 'batal') {
      acc[div].failedCount += 1;
    }
    return acc;
  }, {});

  const divisionReport = Object.values(divisionGroups).map((group) => ({
    ...group,
    avgDuration:
      group.completedCount > 0 ? (group.totalDuration / group.completedCount).toFixed(1) : 0,
  }));

  // Filtering for Global Jobs List
  const filteredJobs = detailedJobs.filter((job) => {
    const term = searchTerm.toLowerCase();
    return (
      String(job.id).toLowerCase().includes(term) ||
      String(job.order_id).toLowerCase().includes(term) ||
      job.order_nama.toLowerCase().includes(term) ||
      job.jenis_produk.toLowerCase().includes(term) ||
      job.bahan.toLowerCase().includes(term) ||
      job.pic_fullname.toLowerCase().includes(term) ||
      job.divisi.toLowerCase().includes(term)
    );
  });

  // Filter staff berdasarkan search box
  const filteredStaff = reportData.filter(
    (staff) =>
      staff.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.divisi.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter division list based on search box
  const filteredDivisions = divisionReport.filter((div) =>
    div.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase animate-pulse">
            Membuat Dasbor Laporan Kinerja...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-slate-800 bg-[#f8fafc] p-6 rounded-3xl min-h-screen">
      {/* Title & Control Panel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            Laporan Kinerja & Detail Pekerjaan
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dasbor pelaporan komprehensif untuk memantau detail order, durasi kerja, alokasi divisi,
            dan pencapaian staff.
          </p>
        </div>

        {/* Tab Filters & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-150 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setRange('bulan_ini')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                range === 'bulan_ini'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setRange('bulan_lalu')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                range === 'bulan_lalu'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => setRange('semua')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                range === 'semua'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua Waktu
            </button>
          </div>

          <button
            onClick={() => handleExportExcel('global')}
            disabled={exporting}
            className="flex items-center gap-2 bg-[#0fb981] hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? 'Mengekspor...' : 'Unduh Laporan Excel'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Global vs Divisi vs Staff) */}
      <div className="flex border-b border-slate-200 gap-1 bg-slate-100/60 p-1 rounded-2xl w-fit">
        <button
          onClick={() => {
            setActiveTab('global');
            setSearchTerm('');
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'global'
              ? 'bg-white text-indigo-700 shadow-md shadow-slate-100'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Grid size={13} />
          <span>Laporan Global</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('divisi');
            setSearchTerm('');
            setExpandedDivisi(null);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'divisi'
              ? 'bg-white text-indigo-700 shadow-md shadow-slate-100'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building size={13} />
          <span>Laporan Per Divisi</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('staff');
            setSearchTerm('');
            setExpandedStaffId(null);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'staff'
              ? 'bg-white text-indigo-700 shadow-md shadow-slate-100'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={13} />
          <span>Laporan Per Staff</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('spreadsheet');
            setSearchTerm('');
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'spreadsheet'
              ? 'bg-white text-indigo-700 shadow-md shadow-slate-100'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Grid size={13} className="text-emerald-500" />
          <span>Live Spreadsheet</span>
        </button>
      </div>

      {/* METRIC CARDS AND CHARTS: Rendered dynamically or in global tab */}
      {activeTab === 'global' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Summary List */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Ringkasan Tugas
              </h3>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Total Tugas
                      </p>
                      <h4 className="text-sm font-black text-slate-800">{totalJobs} Job</h4>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Selesai
                      </p>
                      <h4 className="text-sm font-black text-slate-800">{totalCompleted} Job</h4>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <AlertCircle size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Gagal/Batal
                      </p>
                      <h4 className="text-sm font-black text-slate-800">{totalFailed} Job</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Kehadiran Staff */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm flex flex-col xl:flex-row items-center gap-4 min-w-0">
              <div
                style={{ background: attConic }}
                className="w-24 h-24 rounded-full flex items-center justify-center shrink-0 animate-fade-in"
              >
                <div className="w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    Hadir
                  </span>
                  <span className="text-[11px] font-black text-slate-800">{totalPresent} Hari</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 w-full min-w-0">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Skor Kehadiran
                </h3>
                <div className="flex items-center justify-between gap-2 text-xs w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium truncate">Tepat Waktu</span>
                  </div>
                  <span className="font-bold text-slate-700 shrink-0">{totalOntime}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium truncate">Terlambat</span>
                  </div>
                  <span className="font-bold text-amber-600 shrink-0">{totalLate}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium truncate">Mangkir</span>
                  </div>
                  <span className="font-bold text-rose-600 shrink-0">{totalAlpha}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Distribusi Status Job */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm flex flex-col xl:flex-row items-center gap-4 min-w-0">
              <div
                style={{ background: jobConic }}
                className="w-24 h-24 rounded-full flex items-center justify-center shrink-0"
              >
                <div className="w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    Total
                  </span>
                  <span className="text-[11px] font-black text-slate-800">{totalJobs} Job</span>
                </div>
              </div>
              <div className="flex-1 space-y-1 w-full min-w-0 text-xs">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Status Pekerjaan
                </h3>
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-slate-600 truncate">Selesai</span>
                  </div>
                  <span className="font-bold text-slate-700 shrink-0">{totalCompleted}</span>
                </div>
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                    <span className="text-slate-600 truncate">Kerja</span>
                  </div>
                  <span className="font-bold text-slate-700 shrink-0">{totalInprogress}</span>
                </div>
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                    <span className="text-slate-600 truncate">Antrean</span>
                  </div>
                  <span className="font-bold text-slate-700 shrink-0">{totalPending}</span>
                </div>
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                    <span className="text-slate-600 truncate">Kendala</span>
                  </div>
                  <span className="font-bold text-slate-700 shrink-0">{totalConstraint}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Finansial Insentif Global */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Insentif Produksi
                </h3>
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Coins size={14} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-black text-emerald-600 tracking-tight block">
                  {formatRupiah(totalInsentifGlobal)}
                </span>
                <span className="text-[10px] text-slate-450 font-bold block mt-1">
                  Akumulasi insentif staff dari pesanan terselesaikan.
                </span>
              </div>
            </div>
          </div>

          {/* Evaluasi Highlights */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-1 flex items-center justify-center">
              <div className="w-12 h-12 bg-slate-100 text-slate-650 rounded-full flex items-center justify-center border border-slate-200">
                <AlertCircle size={24} className="text-indigo-650" />
              </div>
            </div>
            <div className="lg:col-span-11 space-y-2">
              <h4 className="text-sm font-extrabold text-slate-800">
                Catatan Evaluasi Kinerja Karyawan
              </h4>
              <div className="text-xs leading-relaxed text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="font-bold text-slate-700">Ringkasan Produktivitas Kerja:</p>
                  {mostProductiveStaff && mostProductiveStaff.jobs_completed > 0 ? (
                    <p className="mt-1">
                      Penyelesaian tugas terbanyak dicatat oleh{' '}
                      <span className="font-extrabold text-slate-850">
                        {mostProductiveStaff.nama_lengkap}
                      </span>{' '}
                      dari divisi {mostProductiveStaff.divisi} dengan total{' '}
                      {mostProductiveStaff.jobs_completed} job diselesaikan. Akumulasi insentif yang
                      diperoleh adalah{' '}
                      <span className="font-extrabold text-emerald-600">
                        {formatRupiah(mostProductiveStaff.total_insentif)}
                      </span>
                      .
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-500">
                      Belum ada tugas yang diselesaikan pada rentang tanggal ini.
                    </p>
                  )}
                </div>

                <div>
                  <p className="font-bold text-slate-700">Ringkasan Kehadiran & Kedisiplinan:</p>
                  <div className="mt-1 space-y-1">
                    {mostOntimeStaff ? (
                      <p>
                        Kehadiran tepat waktu paling konsisten dicapai oleh{' '}
                        <span className="font-bold text-slate-800">
                          {mostOntimeStaff.nama_lengkap}
                        </span>{' '}
                        ({mostOntimeStaff.att_ontime} kali hadir tepat waktu).
                      </p>
                    ) : null}
                    {mostLateStaff ? (
                      <p className="text-amber-700">
                        Catatan keterlambatan tertinggi diidentifikasi pada{' '}
                        {mostLateStaff.nama_lengkap} sebanyak {mostLateStaff.att_late} kali
                        terlambat.
                      </p>
                    ) : (
                      <p className="text-slate-500">
                        Seluruh staff yang hadir tercatat tepat waktu tanpa keterlambatan pada
                        periode ini.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MAIN DATA PANELS BY ACTIVE TAB */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Search & Filter Header bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            {activeTab === 'global' && (
              <>
                <FileText className="w-4 h-4 text-indigo-500" /> Daftar Detail Pekerjaan & Order
              </>
            )}
            {activeTab === 'divisi' && (
              <>
                <Building className="w-4 h-4 text-indigo-500" /> Kinerja dan Beban Per Divisi
              </>
            )}
            {activeTab === 'staff' && (
              <>
                <Users className="w-4 h-4 text-indigo-500" /> Evaluasi dan Insentif Per Staff
              </>
            )}
            {activeTab === 'spreadsheet' && (
              <>
                <Grid className="w-4 h-4 text-emerald-600" /> Live Pivot Spreadsheet Grid
              </>
            )}
          </h2>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 gap-2 w-64">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'global'
                    ? 'Cari produk, order, bahan, staff...'
                    : activeTab === 'divisi'
                      ? 'Cari nama divisi...'
                      : 'Cari nama staff atau divisi...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs bg-transparent border-none outline-none w-full text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* TAB 1 CONTENT: GLOBAL DETAILED JOBS REPORT */}
        {activeTab === 'global' && (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-5 py-3.5 w-12 text-center">No</th>
                  <th className="px-3 py-3.5">Tanggal Selesai</th>
                  <th className="px-3 py-3.5">No Order</th>
                  <th className="px-4 py-3.5">Pelanggan</th>
                  <th className="px-4 py-3.5">Detail Produk / Jenis</th>
                  <th className="px-3 py-3.5">Bahan</th>
                  <th className="px-3 py-3.5 text-center">Qty</th>
                  <th className="px-3 py-3.5">Divisi & Tahap</th>
                  <th className="px-4 py-3.5">Operator PIC</th>
                  <th className="px-3 py-3.5 text-center">Durasi</th>
                  <th className="px-4 py-3.5 text-right">Insentif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((job, idx) => (
                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-[10px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Calendar size={11} className="text-indigo-400" />
                          {job.waktu_selesai}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 font-bold text-slate-850 font-mono">
                        #{job.order_id}
                      </td>
                      <td className="px-4 py-3.5 capitalize text-slate-700">{job.order_nama}</td>
                      <td className="px-4 py-3.5 text-slate-800">
                        <div className="font-bold">{job.jenis_produk}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Job ID: #{job.id}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-slate-500 font-medium">{job.bahan || '-'}</td>
                      <td className="px-3 py-3.5 text-center font-bold text-slate-700">
                        {job.qty}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9.5px] uppercase font-black tracking-wide w-fit">
                            {job.divisi}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium pl-1">
                            Tahap: {job.tahap}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-150 flex items-center justify-center font-black capitalize text-[9.5px]">
                            {job.pic_username.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{job.pic_fullname}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center font-mono text-[10.5px]">
                        <span className="text-slate-600 font-bold">{job.durasi_menit}m</span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-emerald-600">
                        {formatRupiah(job.insentif)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="11"
                      className="text-center py-12 text-slate-450 italic bg-slate-50/20"
                    >
                      Tidak ada detail data pekerjaan yang cocok atau selesai pada rentang ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2 CONTENT: DIVISION GROUPED REPORTS */}
        {activeTab === 'divisi' && (
          <div className="p-6 space-y-6 bg-slate-50/50">
            {filteredDivisions.length > 0 ? (
              filteredDivisions.map((div) => {
                const isExpanded = expandedDivisi === div.name;
                return (
                  <div
                    key={div.name}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300"
                  >
                    {/* Division Header bar */}
                    <div
                      onClick={() => setExpandedDivisi(isExpanded ? null : div.name)}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/40 select-none border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shrink-0">
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                              {div.name}
                            </h3>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportExcel('divisi', div.name);
                              }}
                              className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-emerald-250 transition-colors shadow-sm cursor-pointer"
                            >
                              <Download size={10} /> Export Detail
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-450 font-bold">
                            {div.jobs.length} total pekerjaan terproses
                          </p>
                        </div>
                      </div>

                      {/* Division Stats overview */}
                      <div className="flex items-center gap-6 self-end md:self-auto">
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Selesai / Gagal
                          </span>
                          <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">
                            <span className="text-emerald-600">{div.completedCount} Selesai</span>
                            {div.failedCount > 0 && (
                              <span className="text-rose-500"> · {div.failedCount} Gagal</span>
                            )}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Rata-rata Durasi
                          </span>
                          <span className="text-xs font-black text-slate-850 mt-0.5 block">
                            {div.avgDuration} m
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                            Total Insentif
                          </span>
                          <span className="text-xs font-black text-emerald-600 mt-0.5 block">
                            {formatRupiah(div.totalIncentive)}
                          </span>
                        </div>
                        <div className="text-slate-400 hover:text-slate-600 transition-colors ml-2">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Division Jobs Expanded Detail list */}
                    {isExpanded && (
                      <div className="overflow-x-auto w-full border-t border-slate-100 animate-slide-down">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/70 text-[9.5px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <th className="px-5 py-3 w-12 text-center font-bold">No</th>
                              <th className="px-3 py-3 font-mono">Tgl Selesai</th>
                              <th className="px-3 py-3">Order</th>
                              <th className="px-4 py-3">Pelanggan</th>
                              <th className="px-4 py-3">Produk / Item</th>
                              <th className="px-4 py-3">PIC Operator</th>
                              <th className="px-3 py-3 text-center">Durasi Kerja</th>
                              <th className="px-3 py-3 text-center">Status</th>
                              <th className="px-5 py-3 text-right">Insentif</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                            {div.jobs.map((job, jIdx) => (
                              <tr key={job.id} className="hover:bg-slate-50/20">
                                <td className="px-5 py-3 text-center text-slate-400">{jIdx + 1}</td>
                                <td className="px-3 py-3 whitespace-nowrap text-[10px] font-mono">
                                  {job.waktu_selesai}
                                </td>
                                <td className="px-3 py-3 font-bold text-slate-800">
                                  #{job.order_id}
                                </td>
                                <td className="px-4 py-3 capitalize">{job.order_nama}</td>
                                <td className="px-4 py-3">
                                  <div className="font-extrabold text-slate-800">
                                    {job.jenis_produk}
                                  </div>
                                  {job.bahan && (
                                    <div className="text-[10px] text-slate-400 font-medium">
                                      {job.bahan} (x{job.qty})
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-800">
                                  @{job.pic_username}
                                </td>
                                <td className="px-3 py-3 text-center font-mono">
                                  {job.durasi_menit}m
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      job.status === 'selesai'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                                    }`}
                                  >
                                    {job.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right font-extrabold text-emerald-600">
                                  {formatRupiah(job.insentif)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-450 italic bg-white border border-slate-200 rounded-2xl">
                Tidak ada divisi yang cocok dengan pencarian Anda.
              </div>
            )}
          </div>
        )}

        {/* TAB 3 CONTENT: STAFF EVALUATION AND JOBS EXPANDED LIST */}
        {activeTab === 'staff' && (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-5 py-3.5 w-12 text-center">No</th>
                  <th className="px-3 py-3.5 text-center">ID</th>
                  <th className="px-5 py-3.5">Nama Staff</th>
                  <th className="px-3 py-3.5">Divisi</th>
                  <th className="px-3 py-3.5 text-center">Total Job</th>
                  <th className="px-3 py-3.5 text-center text-emerald-600">Selesai</th>
                  <th className="px-3 py-3.5 text-center text-rose-500">Gagal</th>
                  <th className="px-4 py-3.5 text-center">
                    Status Absensi (Tepat / Telat / Alpha)
                  </th>
                  <th className="px-3 py-3.5 text-center">Kategori Kehadiran</th>
                  <th className="px-5 py-3.5 text-right">Total Insentif</th>
                  <th className="px-5 py-3.5 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((staff, index) => {
                    const totalPresentStaff = staff.att_ontime + staff.att_late;
                    const lateRatio =
                      totalPresentStaff > 0 ? staff.att_late / totalPresentStaff : 0;

                    let disciplineBadge = (
                      <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                        Tanpa Absensi
                      </span>
                    );

                    if (totalPresentStaff > 0) {
                      if (lateRatio === 0 && staff.att_alpha === 0) {
                        disciplineBadge = (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            Sangat Disiplin
                          </span>
                        );
                      } else if (lateRatio < 0.15) {
                        disciplineBadge = (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            Cepat & Rajin
                          </span>
                        );
                      } else {
                        disciplineBadge = (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            Sering Terlambat
                          </span>
                        );
                      }
                    }

                    const isExpanded = expandedStaffId === staff.id;
                    const staffJobsList = detailedJobs.filter(
                      (j) => j.pic_username === staff.username
                    );

                    return (
                      <React.Fragment key={staff.id}>
                        {/* Parent Staff row */}
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 text-center text-slate-400 font-medium">
                            {index + 1}
                          </td>
                          <td className="px-3 py-4 text-center font-bold text-indigo-650 bg-indigo-55/10 rounded-md">
                            {staff.id}
                          </td>
                          <td className="px-5 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold capitalize border border-slate-200 shadow-sm shrink-0">
                              {staff.nama_lengkap.charAt(0)}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-800 capitalize">
                                {staff.nama_lengkap}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border border-slate-200">
                              {staff.divisi}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center font-black text-slate-800">
                            {staff.jobs_total}
                          </td>
                          <td className="px-3 py-4 text-center font-black text-emerald-600">
                            {staff.jobs_completed}
                          </td>
                          <td className="px-3 py-4 text-center font-black text-rose-500">
                            {staff.jobs_failed}
                          </td>

                          {/* Status Absensi Detail */}
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-100">
                                {staff.att_ontime} Tepat
                              </span>
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-100">
                                {staff.att_late} Telat
                              </span>
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-100">
                                {staff.att_alpha} Alpha
                              </span>
                            </div>
                          </td>

                          {/* Kategori Kehadiran */}
                          <td className="px-3 py-4 text-center">{disciplineBadge}</td>

                          {/* Total Insentif */}
                          <td className="px-5 py-4 text-right font-extrabold text-emerald-600 text-sm">
                            {formatRupiah(staff.total_insentif)}
                          </td>

                          {/* Action toggle button */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setExpandedStaffId(isExpanded ? null : staff.id)}
                                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 text-slate-650 hover:text-indigo-650 px-3 py-1.5 rounded-xl border border-slate-200 text-[10.5px] font-extrabold transition-all cursor-pointer"
                              >
                                <span>Tugas</span>
                                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                              <button
                                onClick={() => handleExportExcel('staff', '', staff.id)}
                                className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 px-2 py-1.5 rounded-xl border border-emerald-200 text-[10.5px] font-extrabold transition-all cursor-pointer"
                                title="Export Detail Staff"
                              >
                                <Download size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Nested Staff Jobs log row */}
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan="11"
                              className="bg-slate-50/70 p-4 border-b border-t border-slate-100"
                            >
                              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-inner max-w-[95%] mx-auto">
                                <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex justify-between items-center">
                                  <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                                    Detail Riwayat Pekerjaan: {staff.nama_lengkap}
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-bold font-mono">
                                    Total: {staffJobsList.length} Job terdaftar
                                  </span>
                                </div>
                                <div className="overflow-x-auto w-full">
                                  <table className="w-full text-left border-collapse text-[11px]">
                                    <thead>
                                      <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="px-4 py-2 w-10 text-center">No</th>
                                        <th className="px-3 py-2">Tgl Selesai</th>
                                        <th className="px-3 py-2 font-mono">Order ID</th>
                                        <th className="px-4 py-2">Nama Pelanggan</th>
                                        <th className="px-4 py-2">Produk & Detail</th>
                                        <th className="px-3 py-2">Divisi</th>
                                        <th className="px-3 py-2 text-center">Durasi</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-4 py-2 text-right">Insentif</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-650 font-semibold">
                                      {staffJobsList.length > 0 ? (
                                        staffJobsList.map((job, jIdx) => (
                                          <tr key={job.id} className="hover:bg-slate-50/40">
                                            <td className="px-4 py-2 text-center text-slate-400">
                                              {jIdx + 1}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-[9.5px] whitespace-nowrap">
                                              {job.waktu_selesai}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-slate-800">
                                              #{job.order_id}
                                            </td>
                                            <td className="px-4 py-2 capitalize">
                                              {job.order_nama}
                                            </td>
                                            <td className="px-4 py-2">
                                              <div className="font-extrabold text-slate-800">
                                                {job.jenis_produk}
                                              </div>
                                              {job.bahan && (
                                                <div className="text-[9.5px] text-slate-400 font-medium">
                                                  {job.bahan} (x{job.qty})
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] uppercase font-black w-fit block">
                                                {job.divisi}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono">
                                              {job.durasi_menit}m
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span
                                                className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                  job.status === 'selesai'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                                                }`}
                                              >
                                                {job.status}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-extrabold text-emerald-600">
                                              {formatRupiah(job.insentif)}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan="9"
                                            className="text-center py-6 text-slate-400 italic"
                                          >
                                            Belum ada detail pekerjaan untuk staff ini.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="10"
                      className="text-center py-12 text-slate-400 font-medium bg-slate-50/20"
                    >
                      Tidak ditemukan data hasil kerja staff.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'spreadsheet' && (
          <div className="p-6 space-y-6 bg-slate-50/50">
            {/* Control Panel: Pivot Settings, CSV, Reset */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex flex-wrap gap-4 items-center">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Config Pivot
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold">Baris:</span>
                  <select
                    value={pivotConfig.rowField}
                    onChange={(e) => setPivotConfig({ ...pivotConfig, rowField: e.target.value })}
                    className="border border-slate-250 bg-slate-50 rounded px-2.5 py-1 text-slate-700 font-bold outline-none"
                  >
                    <option value="staff">Staf PIC</option>
                    <option value="divisi">Divisi Kerja</option>
                    <option value="produk">Produk / Jenis</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold">Kolom Nilai:</span>
                  <select
                    value={pivotConfig.valField}
                    onChange={(e) => setPivotConfig({ ...pivotConfig, valField: e.target.value })}
                    className="border border-slate-250 bg-slate-50 rounded px-2.5 py-1 text-slate-700 font-bold outline-none"
                  >
                    <option value="insentif">Insentif (Rp)</option>
                    <option value="durasi">Durasi (Menit)</option>
                    <option value="qty">Qty Pekerjaan</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold">Agregasi:</span>
                  <select
                    value={pivotConfig.aggType}
                    onChange={(e) => setPivotConfig({ ...pivotConfig, aggType: e.target.value })}
                    className="border border-slate-250 bg-slate-50 rounded px-2.5 py-1 text-slate-700 font-bold outline-none"
                  >
                    <option value="sum">SUM (Jumlah)</option>
                    <option value="avg">AVG (Rata-rata)</option>
                    <option value="count">COUNT (Banyaknya)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={generatePivotTable}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Generate Pivot
                </button>
              </div>

              <div className="lg:col-span-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={initSpreadsheetWithJobs}
                  className="bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl shadow-3xs transition-all cursor-pointer"
                >
                  Reset Grid Data
                </button>
                <button
                  type="button"
                  onClick={downloadSpreadsheetCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-3xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={13} />
                  Download CSV
                </button>
              </div>
            </div>

            {/* Formula Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono select-none">
                  {selectedCell ? `${String.fromCharCode(65 + selectedCell.c)}${selectedCell.r + 1}` : 'CELL'}
                </div>
                <div className="h-5 w-px bg-slate-200"></div>
                <div className="text-xs font-bold text-slate-400 font-serif italic select-none">fx</div>
                <input
                  type="text"
                  value={
                    selectedCell
                      ? spreadsheetGrid[selectedCell.r]?.[selectedCell.c]?.value || ''
                      : ''
                  }
                  disabled={!selectedCell}
                  onChange={(e) => {
                    if (!selectedCell) return;
                    const newGrid = spreadsheetGrid.map((row, rIdx) =>
                      row.map((cell, cIdx) => {
                        if (rIdx === selectedCell.r && cIdx === selectedCell.c) {
                          return { ...cell, value: e.target.value };
                        }
                        return cell;
                      })
                    );
                    setSpreadsheetGrid(recalculateGrid(newGrid));
                  }}
                  placeholder="Pilih sel di bawah, lalu masukkan nilai manual atau rumus (Cth: =SUM(J2:J12) atau 50000)"
                  className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-slate-800"
                />
              </div>

              {/* Spreadsheet Grid */}
              <div className="overflow-x-auto w-full border border-slate-200/80 rounded-xl bg-slate-100/30">
                <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-100 select-none">
                      <th className="w-10 border border-slate-200 text-center bg-slate-200/60 font-black text-slate-500 text-[10px]"></th>
                      {Array.from({ length: 11 }).map((_, cIdx) => (
                        <th
                          key={cIdx}
                          className="px-3 py-1.5 border border-slate-200 text-center bg-slate-200/60 font-black text-slate-500 font-mono text-[10px]"
                        >
                          {String.fromCharCode(65 + cIdx)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spreadsheetGrid.map((row, rIdx) => (
                      <tr key={rIdx} className="bg-white">
                        {/* Row Index Column */}
                        <td className="border border-slate-200 text-center bg-slate-100 font-mono font-bold text-slate-400 text-[10px] py-1 select-none">
                          {rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => {
                          const isSelected = selectedCell && selectedCell.r === rIdx && selectedCell.c === cIdx;
                          const isHeader = cell.isHeader;
                          const isLabel = cell.isLabel;
                          
                          let cellStyle = "border border-slate-200 px-2 py-1 text-[11px] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] transition-all cursor-pointer ";
                          if (isSelected) {
                            cellStyle += "ring-2 ring-indigo-500 bg-indigo-50/40 z-10 relative ";
                          } else if (isHeader) {
                            cellStyle += "bg-slate-50 font-black text-slate-700 text-center font-sans tracking-wide uppercase ";
                          } else if (isLabel) {
                            cellStyle += "bg-slate-50/50 font-bold text-slate-500 font-sans ";
                          } else if (cell.value && String(cell.value).startsWith('=')) {
                            cellStyle += "font-bold text-indigo-700 bg-indigo-50/20 ";
                          } else {
                            cellStyle += "text-slate-650 hover:bg-slate-50/50 ";
                          }

                          return (
                            <td
                              key={cIdx}
                              onClick={() => {
                                setSelectedCell({ r: rIdx, c: cIdx });
                              }}
                              className={cellStyle}
                              title={cell.value ? `Val: ${cell.value}\nComputed: ${cell.computed}` : ''}
                            >
                              {cell.computed !== undefined
                                ? ( (cIdx === 9 || cIdx === 10) && !isNaN(parseFloat(cell.computed)) && !isHeader
                                  ? formatRupiah(parseFloat(cell.computed))
                                  : cell.computed )
                                : cell.value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
