import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { Kanban, Download, Grid } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

// Hook & Komponen
import { useJobsData } from '../../hooks/useJobsData';
import EditJobModal from '../../components/modals/EditJobModal';
import ForwardJobModal from '../../components/modals/ForwardJobModal';

export default function PapanKerjaSpkPanel() {
  const { user } = useAuth();
  const isManager = ['owner', 'manager'].includes(user?.role?.toLowerCase());

  // Data & Handlers dari custom hook
  const {
    jobs,
    orderMap,
    loading,
    saving,
    exporting,
    error,
    tahapList,
    staffList,
    fetchData,
    handleModalSave,
    handleForward,
    handleExport,
  } = useJobsData();

  // State Modal
  const [editJob, setEditJob] = useState(null);
  const [forwardJob, setForwardJob] = useState(null);

  // Spreadsheet States & Functions
  const [spreadsheetGrid, setSpreadsheetGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null); // { r, c }
  const [pivotConfig, setPivotConfig] = useState({
    rowField: 'staff',
    valField: 'insentif',
    aggType: 'sum',
  });

  const evaluateCell = (formulaStr, currentGrid) => {
    if (!formulaStr || !String(formulaStr).startsWith('=')) {
      return formulaStr;
    }
    const cleanFormula = String(formulaStr).substring(1).toUpperCase().trim();
    const match = cleanFormula.match(/^([A-Z]+)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
    if (!match) return '#VALUE!';
    
    const [_, func, colStartLetter, rowStartStr, colEndLetter, rowEndStr] = match;
    const startRow = parseInt(rowStartStr) - 1;
    const endRow = parseInt(rowEndStr) - 1;
    
    const letterToIdx = (l) => l.charCodeAt(0) - 65;
    const startCol = letterToIdx(colStartLetter);
    const endCol = letterToIdx(colEndLetter);
    
    const values = [];
    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        if (currentGrid[r] && currentGrid[r][c]) {
          const val = parseFloat(currentGrid[r][c].computed || currentGrid[r][c].value || 0);
          if (!isNaN(val)) values.push(val);
        }
      }
    }
    
    if (func === 'SUM') return values.reduce((sum, v) => sum + v, 0);
    if (func === 'AVERAGE' || func === 'AVG') return values.length > 0 ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1) : 0;
    if (func === 'COUNT') return values.length;
    if (func === 'MIN') return values.length > 0 ? Math.min(...values) : 0;
    if (func === 'MAX') return values.length > 0 ? Math.max(...values) : 0;
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
    const COLS = 10;
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push({ value: '', computed: '' });
      }
      grid.push(row);
    }
    
    const headers = [
      'Job ID',      // A
      'Order ID',    // B
      'Customer',    // C
      'Product',     // D
      'Stage / Div', // E
      'PIC Operator',// F
      'Status',      // G
      'Duration (m)',// H
      'Incentive (Rp)', // I
      'HPP Bahan'    // J
    ];
    headers.forEach((h, idx) => {
      grid[0][idx] = { value: h, computed: h, isHeader: true };
    });
    
    const maxJobs = Math.min(jobs.length, 25);
    for (let i = 0; i < maxJobs; i++) {
      const job = jobs[i];
      const r = i + 1;
      const order = orderMap[job.order_item] || {};
      
      grid[r][0] = { value: job.id || '', computed: String(job.id || '') };
      grid[r][1] = { value: order.orderId || '', computed: String(order.orderId || '') };
      grid[r][2] = { value: order.customerName || '', computed: order.customerName || '' };
      grid[r][3] = { value: order.jenisProduk || '', computed: order.jenisProduk || '' };
      grid[r][4] = { value: job.tahap_nama || '', computed: job.tahap_nama || '' };
      grid[r][5] = { value: job.pic_nama || 'Belum Ada', computed: job.pic_nama || 'Belum Ada' };
      grid[r][6] = { value: job.status_pekerjaan || '', computed: job.status_pekerjaan || '' };
      grid[r][7] = { value: job.durasi_menit || 0, computed: String(job.durasi_menit || 0) };
      grid[r][8] = { value: job.insentif || 0, computed: String(job.insentif || 0) };
      grid[r][9] = { value: job.hpp_bahan || 0, computed: String(job.hpp_bahan || 0) };
    }
    
    const totalRowIdx = maxJobs + 2;
    if (totalRowIdx < ROWS) {
      grid[totalRowIdx][0] = { value: 'Total / Rata-rata', computed: 'Total / Rata-rata', isLabel: true };
      grid[totalRowIdx][7] = { value: `=AVERAGE(H2:H${totalRowIdx})`, computed: '' };
      grid[totalRowIdx][8] = { value: `=SUM(I2:I${totalRowIdx})`, computed: '' };
      grid[totalRowIdx][9] = { value: `=SUM(J2:J${totalRowIdx})`, computed: '' };
      
      grid[totalRowIdx - 1][7] = { value: 'Avg Dur', computed: 'Avg Dur', isLabel: true };
      grid[totalRowIdx - 1][8] = { value: 'Total Ins', computed: 'Total Ins', isLabel: true };
      grid[totalRowIdx - 1][9] = { value: 'Total HPP', computed: 'Total HPP', isLabel: true };
    }
    
    setSpreadsheetGrid(recalculateGrid(grid));
  }, [jobs, orderMap]);

  useEffect(() => {
    if (jobs.length > 0) {
      initSpreadsheetWithJobs();
    }
  }, [jobs, initSpreadsheetWithJobs]);

  const generatePivotTable = () => {
    const groups = {};
    jobs.forEach((job) => {
      let key = 'Lainnya';
      if (pivotConfig.rowField === 'staff') key = job.pic_nama || 'Tanpa PIC';
      else if (pivotConfig.rowField === 'divisi') key = job.tahap_nama || 'Tanpa Tahap';
      else if (pivotConfig.rowField === 'produk') {
        const order = orderMap[job.order_item] || {};
        key = order.jenisProduk || 'Tanpa Produk';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(job);
    });
    
    const ROWS = 35;
    const COLS = 10;
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
      const gJobs = groups[key];
      let finalVal = 0;
      
      const getVal = (j) => {
        if (pivotConfig.valField === 'insentif') return j.insentif || 0;
        if (pivotConfig.valField === 'durasi') return j.durasi_menit || 0;
        if (pivotConfig.valField === 'qty') return 1;
        return 0;
      };
      
      if (pivotConfig.aggType === 'sum') {
        finalVal = gJobs.reduce((sum, j) => sum + getVal(j), 0);
      } else if (pivotConfig.aggType === 'avg') {
        const total = gJobs.reduce((sum, j) => sum + getVal(j), 0);
        finalVal = gJobs.length > 0 ? (total / gJobs.length).toFixed(1) : 0;
      } else if (pivotConfig.aggType === 'count') {
        finalVal = gJobs.length;
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
    link.setAttribute("download", `laporan_pekerjaan.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">Memuat data papan SPK...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-3 pb-4 max-w-[1400px] mx-auto min-h-0">
      {/* Header Panel */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-sm">
        <div>
          <h1 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Kanban size={13} className="text-indigo-650" />
            Monitoring Master SPK & Analisis Pivot
          </h1>
          <p className="text-[10px] text-slate-500 font-medium">
            Monitor semua SPK aktif, kelola OTP verifikasi, dan lakukan analisis pivot insentif interaktif.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5 text-[10px] font-bold hover:bg-emerald-100 shadow-sm disabled:opacity-50 cursor-pointer transition-all"
          >
            <Download size={11} /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-[300px] animate-fade-in">
            {/* Control Panel */}
            <div className="p-3 bg-slate-50/50 border-b border-slate-200 space-y-2 shrink-0">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-1.5 shadow-3xs">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider pl-1">
                    Config Pivot
                  </div>
                  <div className="h-5 w-px bg-slate-200"></div>
                  
                  <div className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="text-slate-550 font-bold">Baris:</span>
                    <select
                      value={pivotConfig.rowField}
                      onChange={(e) => setPivotConfig({ ...pivotConfig, rowField: e.target.value })}
                      className="border border-slate-200 bg-slate-50 rounded px-2 py-0.5 text-slate-700 font-bold outline-none text-[10.5px]"
                    >
                      <option value="staff">Staf PIC</option>
                      <option value="divisi">Tahap Divisi</option>
                      <option value="produk">Produk / Jenis</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="text-slate-550 font-bold">Nilai:</span>
                    <select
                      value={pivotConfig.valField}
                      onChange={(e) => setPivotConfig({ ...pivotConfig, valField: e.target.value })}
                      className="border border-slate-200 bg-slate-50 rounded px-2 py-0.5 text-slate-700 font-bold outline-none text-[10.5px]"
                    >
                      <option value="insentif">Insentif (Rp)</option>
                      <option value="durasi">Durasi (Menit)</option>
                      <option value="qty">Banyak Pekerjaan</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="text-slate-550 font-bold">Agregasi:</span>
                    <select
                      value={pivotConfig.aggType}
                      onChange={(e) => setPivotConfig({ ...pivotConfig, aggType: e.target.value })}
                      className="border border-slate-200 bg-slate-50 rounded px-2 py-0.5 text-slate-700 font-bold outline-none text-[10.5px]"
                    >
                      <option value="sum">SUM</option>
                      <option value="avg">AVG</option>
                      <option value="count">COUNT</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={generatePivotTable}
                    className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3 py-1 rounded-md shadow-xs transition-all cursor-pointer"
                  >
                    Pivot Table
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={initSpreadsheetWithJobs}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-3xs transition-all cursor-pointer"
                  >
                    Reset Grid
                  </button>
                  <button
                    type="button"
                    onClick={downloadSpreadsheetCSV}
                    className="bg-emerald-650 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-3xs transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Download size={11} />
                    Download CSV
                  </button>
                </div>
              </div>

              {/* Formula Bar */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-4xs">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono select-none">
                  {selectedCell ? `${String.fromCharCode(65 + selectedCell.c)}${selectedCell.r + 1}` : 'CELL'}
                </div>
                <div className="h-4 w-px bg-slate-200"></div>
                <div className="text-[10px] font-bold text-slate-450 font-serif italic select-none">fx</div>
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
                  placeholder="Pilih sel di bawah, lalu masukkan nilai manual atau rumus (Cth: =SUM(I2:I25))"
                  className="flex-1 bg-transparent border-none outline-none text-[10.5px] font-mono text-slate-800"
                />
              </div>

              {/* Interactive Database Actions */}
              {(() => {
                const selectedRowJobId = selectedCell && spreadsheetGrid[selectedCell.r]?.[0]?.value;
                const selectedJob = selectedRowJobId ? jobs.find(j => String(j.id) === String(selectedRowJobId)) : null;
                if (!selectedJob) return null;
                return (
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-2 flex items-center justify-between gap-3 animate-fade-in shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                      <span className="text-[10px] font-bold text-indigo-950">
                        JOB TERPILIH: #{selectedJob.id} &bull; {(orderMap[selectedJob.order_item]?.customerName) || 'Klien'} &bull; {(orderMap[selectedJob.order_item]?.jenisProduk) || 'Produk'}
                      </span>
                    </div>
                    <button
                      onClick={() => setEditJob(selectedJob)}
                      className="bg-slate-700 hover:bg-slate-800 text-white text-[9.5px] font-bold px-2.5 py-1 rounded shadow-sm cursor-pointer transition-all"
                    >
                      Edit Info Job
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Grid Table */}
            <div className="overflow-x-auto overflow-y-auto flex-1 bg-slate-100/30 custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-150 bg-slate-100 select-none sticky top-0 z-10">
                    <th className="w-10 border border-slate-200 text-center bg-slate-200/60 font-black text-slate-500 text-[9px] py-1"></th>
                    {Array.from({ length: 10 }).map((_, cIdx) => (
                      <th
                        key={cIdx}
                        className="px-2.5 py-1 border border-slate-200 text-center bg-slate-200/60 font-black text-slate-500 font-mono text-[9px]"
                      >
                        {String.fromCharCode(65 + cIdx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spreadsheetGrid.map((row, rIdx) => (
                    <tr key={rIdx} className="bg-white">
                      <td className="border border-slate-200 text-center bg-slate-100 font-mono font-bold text-slate-400 text-[9px] py-0.5 select-none">
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => {
                        const isSelected = selectedCell && selectedCell.r === rIdx && selectedCell.c === cIdx;
                        const isHeader = cell.isHeader;
                        const isLabel = cell.isLabel;
                        
                        let cellStyle = "border border-slate-200 px-2 py-0.5 text-[10.5px] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] transition-all cursor-pointer ";
                        if (isSelected) {
                          cellStyle += "ring-2 ring-indigo-500 bg-indigo-50/40 z-10 relative ";
                        } else if (isHeader) {
                          cellStyle += "bg-slate-50 font-black text-slate-700 text-center font-sans tracking-wide uppercase ";
                        } else if (isLabel) {
                          cellStyle += "bg-slate-50/50 font-bold text-slate-500 font-sans ";
                        } else if (cell.value && String(cell.value).startsWith('=')) {
                          cellStyle += "font-bold text-indigo-750 text-indigo-700 bg-indigo-50/20 ";
                        } else {
                          cellStyle += "text-slate-650 hover:bg-slate-50/50 ";
                        }

                        const formatRupiah = (number) => {
                          return new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }).format(number);
                        };

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
                              ? ( (cIdx === 8 || cIdx === 9) && !isNaN(parseFloat(cell.computed)) && !isHeader
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

      {/* Modals */}
      <ForwardJobModal
        job={forwardJob}
        orderMap={orderMap}
        tahapList={tahapList}
        staffList={staffList}
        saving={saving}
        onSubmit={async (jobId, data) => {
          const result = await handleForward(jobId, data);
          if (result.ok) setForwardJob(null);
          else alert(result.error);
        }}
        onClose={() => setForwardJob(null)}
      />

      <EditJobModal
        job={editJob}
        orderMap={orderMap}
        tahapList={tahapList}
        staffList={staffList}
        saving={saving}
        isManager={isManager}
        onSubmit={async (jobId, formData) => {
          const result = await handleModalSave(jobId, formData, isManager);
          if (result.ok) setEditJob(null);
          else alert(result.error);
        }}
        onClose={() => setEditJob(null)}
      />
    </div>
  );
}
