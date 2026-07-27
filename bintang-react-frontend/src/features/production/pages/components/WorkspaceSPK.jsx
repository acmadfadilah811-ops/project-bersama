import { useState, useEffect, useCallback } from 'react';
import { Play, CheckCircle, Save, Trash, ChevronLeft, Download, Printer, RefreshCw, Plus, Search, AlertTriangle } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import KomplainModal from '../../../orders/components/KomplainModal';

const getKonsepDesain = (detail) => {
  if (!detail) return null;
  try {
    const arr = typeof detail === 'string' ? JSON.parse(detail) : detail;
    if (Array.isArray(arr)) {
      const found = arr.find(d => d && (d.key === 'Konsep Desain' || d.key === 'konsep_desain'));
      if (found && found.value) {
        return found.value;
      }
    }
  } catch (e) {
    console.error("Error parsing detail:", e);
  }
  return null;
};

const COLS = ['A','B','C','D','E','F','G','H'];
const FREE_ROWS = 20;
const mkEmpty = () => Array.from({ length: FREE_ROWS }, () => Array(COLS.length).fill(''));

export default function WorkspaceSPK({ job, onClose, onStart, onComplete, saving }) {
  const [driveLink, setDriveLink] = useState(job?.gdrive_output_link || '');
  const [designFee, setDesignFee] = useState(job?.biaya_desain || 0);
  const [incentive, setIncentive] = useState(job?.insentif || 0);
  const [materialUsage, setMaterialUsage] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [historyNotes, setHistoryNotes] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [staffNote, setStaffNote] = useState('');

  // Excel sheet state and custom calculator parameters
  const [activeSheet, setActiveSheet] = useState('detail');
  const [tarifPerm2, setTarifPerm2] = useState(15000);
  const [komisiPersen, setKomisiPersen] = useState(5);

  // Free-form Catatan Bebas grid
  const [freeGrid, setFreeGrid] = useState(mkEmpty);
  const [activeCell, setActiveCell] = useState(null); // { r, c }
  const [formulaVal, setFormulaVal] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isKomplainOpen, setIsKomplainOpen] = useState(false);
  const [complaints, setComplaints] = useState([]);

  const setFreeCell = useCallback((r, c, val) => {
    setFreeGrid(g => g.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? val : cell) : row));
  }, []);

  const exportFreeGridCSV = () => {
    const header = COLS.join(',');
    const rows = freeGrid.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `catatan_spk_${job?.id || 'draft'}.csv`; a.click();
  };

  useEffect(() => {
    setDriveLink(job?.gdrive_output_link || '');
    setDesignFee(job?.biaya_desain || 0);
    setIncentive(job?.insentif || 0);

    // Load inventory items for the dropdown
    apiClient
      .get('/inventory/')
      .then((res) => setInventoryItems(res.data))
      .catch((err) => console.error('Failed to load inventory items:', err));

    // Parse existing material usage from job.catatan_staff
    if (Array.isArray(job?.catatan_staff)) {
      // Find the last index of separator (keterangan starting with "--- Dari Divisi:")
      const lastSeparatorIdx = job.catatan_staff
        .map((row) => String(row.keterangan || '').startsWith('--- Dari Divisi:'))
        .lastIndexOf(true);

      let historyRows = [];
      let currentMaterials;

      if (lastSeparatorIdx === -1) {
        currentMaterials = job.catatan_staff;
      } else {
        historyRows = job.catatan_staff.slice(0, lastSeparatorIdx + 1);
        currentMaterials = job.catatan_staff.slice(lastSeparatorIdx + 1);
      }

      // Filter out non-material rows for current division
      const materialsOnly = currentMaterials.filter((row) => row.item_id);
      setMaterialUsage(
        materialsOnly.map((m) => ({
          item_id: m.item_id || '',
          item_nama: m.item_nama || m.keterangan || '',
          satuan: m.satuan || '',
          qty: m.qty || m.jumlah || '',
          catatan: m.catatan || '',
        }))
      );
      setHistoryNotes(historyRows);

      // Find staff note if exists
      const noteObj = currentMaterials.find((row) => row.type === 'catatan_tambahan');
      setStaffNote(noteObj ? noteObj.text : '');
    } else {
      setMaterialUsage([]);
      setHistoryNotes([]);
      setStaffNote('');
    }
  }, [job]);

  const addMaterialRow = () => {
    setMaterialUsage((prev) => [
      ...prev,
      { item_id: '', item_nama: '', satuan: '', qty: '', catatan: '' },
    ]);
  };

  const removeMaterialRow = (idx) => {
    setMaterialUsage((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMaterialField = (idx, field, val) => {
    setMaterialUsage((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));
  };

  const selectInventoryItem = (idx, itemId) => {
    const found = inventoryItems.find((it) => String(it.id) === String(itemId));
    if (found) {
      let suggestedQty = '';
      let autoNote = '';
      const isRoll = found.satuan?.toLowerCase() === 'm²' || found.satuan?.toLowerCase() === 'm2' || found.kategori?.toLowerCase() === 'bahan cetak';
      if (isRoll) {
        if (panjang > 0 && lebar > 0) {
          suggestedQty = String(panjang * lebar * orderQty);
          autoNote = `Konversi UoM: ${panjang}x${lebar}m x ${orderQty} pcs`;
        }
      }
      setMaterialUsage((prev) =>
        prev.map((row, i) =>
          i === idx
            ? {
                ...row,
                item_id: found.id,
                item_nama: found.nama,
                satuan: found.satuan,
                qty: suggestedQty || row.qty || '1',
                catatan: autoNote || row.catatan || '',
              }
            : row
        )
      );
    } else if (itemId === '') {
      setMaterialUsage((prev) =>
        prev.map((row, i) =>
          i === idx
            ? {
                ...row,
                item_id: '',
                item_nama: '',
                satuan: '',
                qty: '',
                catatan: '',
              }
            : row
        )
      );
    }
  };

  const handleSaveDraft = async () => {
    setUpdating(true);
    try {
      const tableRows = materialUsage.map((row) => ({
        keterangan: row.item_nama,
        jumlah: row.qty,
        satuan: row.satuan,
        catatan: row.catatan,
        item_id: row.item_id,
      }));

      // Append staff note if present
      if (staffNote.trim()) {
        tableRows.push({
          type: 'catatan_tambahan',
          text: staffNote.trim(),
          keterangan: 'Catatan Tambahan Staff',
          catatan: staffNote.trim(),
        });
      }

      // Combine history notes and current rows
      const combinedNotes = [...historyNotes, ...tableRows];

      await apiClient.patch(`/jobs/${job.id}/`, {
        gdrive_output_link: driveLink,
        catatan_staff: combinedNotes,
        biaya_desain: designFee,
        insentif: incentive,
      });
      alert('Draft lembar kerja berhasil disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan draft.');
    } finally {
      setUpdating(false);
    }
  };

  const item = job?.order_item_detail || {};
  const panjang = parseFloat(item.panjang) || 0;
  const lebar = parseFloat(item.lebar) || 0;
  const luas = panjang * lebar;
  const orderQty = parseFloat(item.jumlah) || parseFloat(item.qty) || 1;
  const orderTotal =
    parseFloat(item.total_harga) ||
    parseFloat(item.subtotal) ||
    parseFloat(item.harga) * orderQty ||
    0;

  const baseValue = luas > 0 ? luas * tarifPerm2 * orderQty : orderTotal;
  const computedIncentive = Math.round(baseValue * (komisiPersen / 100) + designFee);

  const fetchComplaints = useCallback(async () => {
    const orderId = job?.order_id || job?.order_item_detail?.order || job?.order_item;
    if (!orderId) return;
    try {
      const res = await apiClient.get(`/komplain/?order=${orderId}`);
      setComplaints(res.data);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    }
  }, [job]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Must be ABOVE early return to comply with Rules of Hooks
  useEffect(() => {
    if (activeSheet === 'incentive') {
      setIncentive(computedIncentive);
    }
  }, [computedIncentive, activeSheet]);

  if (!job) return null;

  const formatUkuran = panjang > 0 && lebar > 0 ? `${panjang} x ${lebar} m` : null;

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3] text-[11px] font-sans overflow-hidden border border-[#ccc]">
      {/* EXCEL RIBBON & TABS */}
      <div className="bg-[#107c41] text-white shrink-0">
        {/* File / Home Menu Tabs */}
        <div className="flex items-center px-3 pt-1 gap-1 text-[10px] select-none font-semibold overflow-x-auto">
          {[['detail','SPK Detail'],['materials','Bahan Baku'],['incentive','Insentif'],['notes','Catatan Bebas']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveSheet(id)}
              className={`px-3 py-1 rounded-t-sm whitespace-nowrap border-none outline-none cursor-pointer transition-all ${
                activeSheet === id ? 'bg-[#f3f3f3] text-[#107c41] font-black' : 'opacity-80 text-white hover:bg-[#185e37]'
              }`}>
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {savedAt && <span className="text-[8.5px] bg-[#0d5c30] px-2 py-0.5 rounded text-green-200">✓ Tersimpan {savedAt}</span>}
            <span className="text-[9px] bg-[#185e37] px-2 py-0.5 rounded uppercase font-black tracking-wide">{job.tahap_nama}</span>
          </div>
        </div>

        {/* Toolbar / Actions (Green Ribbon Style) */}
        <div className="bg-[#f3f3f3] border-b border-[#ccc] p-1.5 flex items-center gap-1.5 text-slate-700 shadow-sm flex-wrap">
          <button onClick={onClose} className="flex items-center gap-1 px-2 py-1 bg-white border border-[#ccc] hover:bg-slate-100 rounded font-bold text-[10px] cursor-pointer shadow-sm">
            <ChevronLeft size={11} className="text-[#107c41]" /><span>Kembali</span>
          </button>
          <div className="h-4 w-px bg-slate-300 mx-0.5" />
          <button onClick={async () => { await handleSaveDraft(); setSavedAt(new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})); }} disabled={updating}
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#ccc] hover:bg-slate-100 disabled:opacity-50 rounded font-extrabold text-[10px] cursor-pointer shadow-sm">
            <Save size={11} className="text-[#107c41]" /><span>Simpan</span>
          </button>
          {job?.order_id && (
            <button onClick={() => setIsKomplainOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-extrabold text-[10px] cursor-pointer shadow-sm">
              <AlertTriangle size={11} className="text-rose-600 animate-pulse" /><span>Catat Komplain</span>
            </button>
          )}
          {activeSheet === 'notes' && (
            <button onClick={exportFreeGridCSV} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#ccc] hover:bg-slate-100 rounded font-bold text-[10px] cursor-pointer shadow-sm">
              <Download size={11} className="text-indigo-600" /><span>Export CSV</span>
            </button>
          )}
          {activeSheet === 'notes' && (
            <button onClick={() => setFreeGrid(mkEmpty())} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#ccc] hover:bg-slate-100 rounded font-bold text-[10px] cursor-pointer shadow-sm">
              <RefreshCw size={11} className="text-red-500" /><span>Reset Grid</span>
            </button>
          )}
          <div className="h-4 w-px bg-slate-300 mx-0.5" />
          {/* Formula bar */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-white border border-[#ccc] rounded px-2 py-0.5">
            <span className="text-[9px] font-black font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
              {activeCell ? `${COLS[activeCell.c]}${activeCell.r + 1}` : '—'}
            </span>
            <span className="text-slate-300 text-[10px] shrink-0">fx</span>
            <input value={formulaVal} onChange={e => { setFormulaVal(e.target.value); if (activeCell) setFreeCell(activeCell.r, activeCell.c, e.target.value); }}
              disabled={activeSheet !== 'notes'}
              placeholder={activeSheet === 'notes' ? 'Klik sel untuk edit...' : 'Pilih Sheet "Catatan Bebas" untuk mengedit'}
              className="flex-1 bg-transparent outline-none text-[10px] font-mono text-slate-800 min-w-0 disabled:text-slate-400" />
          </div>
          <div className="h-4 w-px bg-slate-300 mx-0.5" />
          {job.status_pekerjaan === 'antrean' && (
            <button onClick={() => onStart(job.id)} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#107c41] text-white hover:bg-[#0d6233] disabled:opacity-50 rounded font-extrabold text-[10px] cursor-pointer shadow-sm">
              <Play size={11} fill="white" /><span>Mulai SPK</span>
            </button>
          )}
          {job.status_pekerjaan === 'dikerjakan' && (
            <button onClick={async () => { await handleSaveDraft(); onComplete(job); }} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#107c41] text-white hover:bg-[#0d6233] disabled:opacity-50 rounded font-extrabold text-[10px] cursor-pointer shadow-sm">
              <CheckCircle size={11} /><span>Finalisasi & Teruskan</span>
            </button>
          )}
        </div>
      </div>

      {/* SPREADSHEET AREA */}
      <div className="flex-1 overflow-auto bg-white">
        {/* SHEET 1: DETAIL SPK */}
        {activeSheet === 'detail' && (
          <table className="w-full border-collapse table-fixed text-[10.5px]">
            <thead>
              <tr className="bg-[#f3f3f3] select-none text-slate-500 font-normal">
                <th className="w-8 border border-[#ccc] bg-[#f3f3f3] text-[8.5px] font-bold py-1"></th>
                <th className="w-36 border border-[#ccc] text-center font-semibold text-slate-500">
                  A
                </th>
                <th className="w-48 border border-[#ccc] text-center font-semibold text-slate-500">
                  B
                </th>
                <th className="w-36 border border-[#ccc] text-center font-semibold text-slate-500">
                  C
                </th>
                <th className="w-48 border border-[#ccc] text-center font-semibold text-slate-500">
                  D
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  1
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  NO SPK
                </td>
                <td className="px-2 font-mono font-bold text-slate-800 border border-[#ccc] bg-slate-50">
                  #{job.id}
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  STATUS SPK
                </td>
                <td className="px-2 font-bold text-[#107c41] border border-[#ccc] uppercase bg-slate-50">
                  {job.status_pekerjaan}
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  2
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  NAMA PRODUK
                </td>
                <td className="px-2 font-extrabold text-slate-800 border border-[#ccc]">
                  {item.jenis_produk || 'Produk'}
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  BAHAN UTAMA
                </td>
                <td className="px-2 text-slate-700 border border-[#ccc]">{item.bahan || '-'}</td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  3
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  UKURAN
                </td>
                <td className="px-2 text-slate-700 border border-[#ccc] font-bold">
                  {formatUkuran || '-'}
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  NO NOTA
                </td>
                <td className="px-2 font-mono text-slate-700 border border-[#ccc] bg-slate-50">
                  #{item.order || '-'}
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  4
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  BIAYA DESAIN (Rp)
                </td>
                <td className="p-0 border border-[#ccc] bg-white">
                  <input
                    type="number"
                    value={designFee}
                    onChange={(e) => setDesignFee(parseFloat(e.target.value) || 0)}
                    className="w-full h-full bg-transparent px-2 outline-none font-bold text-slate-800 border border-transparent focus:border-[#107c41] focus:bg-white"
                  />
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                  ESTIMASI INSENTIF (Rp)
                </td>
                <td className="p-0 border border-[#ccc] bg-white">
                  <input
                    type="number"
                    value={incentive}
                    onChange={(e) => setIncentive(parseFloat(e.target.value) || 0)}
                    className="w-full h-full bg-transparent px-2 outline-none font-bold text-slate-800 border border-transparent focus:border-[#107c41] focus:bg-white"
                  />
                </td>
              </tr>
              {(() => {
                const konsep = getKonsepDesain(item.detail);
                if (konsep) {
                  return (
                    <>
                      <tr className="bg-indigo-50/10">
                        <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                          5a
                        </td>
                        <td className="bg-[#e8eaf6] px-2 font-extrabold text-indigo-900 border border-[#ccc] uppercase">
                          KONSEP DESAIN (TULISAN)
                        </td>
                        <td colSpan={3} className="px-2 font-bold text-slate-800 border border-[#ccc] py-1 bg-white whitespace-pre-wrap">
                          {konsep.tulisan || '-'}
                        </td>
                      </tr>
                      <tr className="bg-indigo-50/10">
                        <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                          5b
                        </td>
                        <td className="bg-[#e8eaf6] px-2 font-extrabold text-indigo-900 border border-[#ccc] uppercase">
                          WARNA DOMINAN
                        </td>
                        <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-white">
                          {konsep.warna_dominan || '-'}
                        </td>
                        <td className="bg-[#e8eaf6] px-2 font-extrabold text-indigo-900 border border-[#ccc] uppercase">
                          LOGO / FOTO
                        </td>
                        <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-white">
                          {konsep.logo_foto || '-'}
                        </td>
                      </tr>
                      <tr className="bg-indigo-50/10">
                        <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                          5c
                        </td>
                        <td className="bg-[#e8eaf6] px-2 font-extrabold text-indigo-900 border border-[#ccc] uppercase">
                          BENTUK / LAYOUT
                        </td>
                        <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-white">
                          {konsep.bentuk || '-'}
                        </td>
                        <td className="bg-[#e8eaf6] px-2 font-extrabold text-indigo-900 border border-[#ccc] uppercase">
                          REQ TAMBAHAN
                        </td>
                        <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-white">
                          {konsep.request_tambahan || '-'}
                        </td>
                      </tr>
                    </>
                  );
                }
                
                const label = item.keterangan_detail?.startsWith('Konsep Desain:') ? 'KONSEP DESAIN' : 'CATATAN CS (FINISHING)';
                return (
                  <tr className="h-14 hover:bg-slate-50/30">
                    <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                      5
                    </td>
                    <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc] uppercase">
                      {label}
                    </td>
                    <td
                      colSpan={3}
                      className="px-3 py-2 text-amber-800 bg-amber-50/40 border border-[#ccc] align-top leading-relaxed font-semibold whitespace-pre-wrap"
                    >
                      {item.keterangan_detail || 'Tidak ada catatan pengerjaan spesifik.'}
                    </td>
                  </tr>
                );
              })()}
              <tr className="h-8 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  6
                </td>
                <td className="bg-[#e1f5fe] px-2 font-extrabold text-indigo-700 border border-[#ccc] uppercase">
                  DRIVE OUTPUT LINK
                </td>
                <td colSpan={3} className="p-0 border border-[#ccc] bg-indigo-50/20">
                  <input
                    type="url"
                    placeholder="Paste link file hasil pengerjaan desain/cetak di sini..."
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    className="w-full h-full bg-transparent px-3 outline-none text-indigo-700 font-mono text-[10px] border border-transparent focus:border-[#107c41] focus:bg-white"
                  />
                </td>
              </tr>
              <tr className="h-10 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  7
                </td>
                <td className="bg-[#e8f5e9] px-2 font-extrabold text-[#2e7d32] border border-[#ccc] uppercase">
                  CATATAN TAMBAHAN STAFF
                </td>
                <td colSpan={3} className="p-0 border border-[#ccc] bg-[#e8f5e9]/10">
                  <input
                    type="text"
                    placeholder="Tulis catatan tambahan pengerjaan di sini (misal: mesin aman, bahan sisa dikembalikan, dll)..."
                    value={staffNote}
                    onChange={(e) => setStaffNote(e.target.value)}
                    className="w-full h-full bg-transparent px-3 outline-none text-[#2e7d32] font-semibold text-[10px] border border-transparent focus:border-[#107c41] focus:bg-white"
                  />
                </td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  8
                </td>
                <td className="bg-rose-50 px-2 font-extrabold text-rose-800 border border-[#ccc] uppercase align-top py-2">
                  RIWAYAT KOMPLAIN
                </td>
                <td colSpan={3} className="px-3 py-2 text-slate-700 border border-[#ccc] align-top bg-rose-50/10">
                  {complaints.length === 0 ? (
                    <span className="text-slate-400 italic">Tidak ada komplain tercatat untuk pesanan ini.</span>
                  ) : (
                    <div className="space-y-2">
                      {complaints.map((c, idx) => (
                        <div key={c.id} className="bg-white border border-rose-200 rounded p-2 shadow-sm">
                          <div className="flex items-center justify-between font-bold text-rose-700 mb-1">
                            <span>Komplain #{idx + 1} ({c.jenis_display})</span>
                            <span className="text-[9px] uppercase bg-rose-100 px-1.5 py-0.5 rounded font-black text-rose-700">
                              {c.status_display}
                            </span>
                          </div>
                          <p className="text-slate-700 font-semibold whitespace-pre-line leading-relaxed text-[10px]">{c.deskripsi}</p>
                          {c.catatan_resolusi && (
                            <div className="mt-1.5 pt-1.5 border-t border-rose-100 text-[9.5px] text-slate-500 font-medium">
                              <strong>Resolusi ({c.resolusi_display}):</strong> {c.catatan_resolusi}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
              {historyNotes.length > 0 ? (
                <tr className="hover:bg-slate-50/30">
                  <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                    9
                  </td>
                  <td className="bg-amber-50 px-2 font-extrabold text-amber-800 border border-[#ccc] uppercase align-top py-2">
                    RIWAYAT & CATATAN DIVISI SEBELUMNYA
                  </td>
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-slate-700 border border-[#ccc] align-top bg-amber-50/20"
                  >
                    <div className="space-y-2">
                      {historyNotes.map((row, rIdx) => {
                        const isSep = String(row.keterangan || '').startsWith('--- Dari Divisi:');
                        if (isSep) {
                          return (
                            <div key={rIdx} className="border-b border-amber-250 pb-1 mb-2">
                              <span className="text-[10px] font-black text-amber-800 uppercase block">
                                {row.keterangan}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[8.5px] font-bold text-slate-500">
                                  {row.catatan}
                                </span>
                                {row.gdrive_link && (
                                  <a
                                    href={row.gdrive_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[9px] font-black text-indigo-650 hover:underline inline-flex items-center gap-0.5 ml-2"
                                  >
                                    📁 Buka File Output Divisi Ini
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        } else if (row.type === 'catatan_tambahan') {
                          return (
                            <div key={rIdx} className="pl-2 py-1 text-amber-900 font-medium flex items-center gap-1.5 bg-amber-50 rounded border border-amber-200/50 px-2 my-1">
                              <span className="font-extrabold text-[9.5px]">💬 Catatan Tambahan Staff:</span>
                              <span className="italic text-slate-700 font-bold">"{row.text}"</span>
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={rIdx}
                              className="pl-2 flex items-center gap-2 py-0.5 text-slate-600 font-medium"
                            >
                              <span>•</span>
                              <span className="font-bold text-slate-700">{row.keterangan}</span>
                              {row.jumlah && row.jumlah !== '-' && (
                                <span className="text-slate-400">
                                  Qty: {row.jumlah} {row.satuan}
                                </span>
                              )}
                              {row.catatan && (
                                <span className="text-slate-450 italic">({row.catatan})</span>
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  </td>
                </tr>
              ) : (
                <tr className="h-6">
                  <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                    9
                  </td>
                  <td className="border border-[#ccc]"></td>
                  <td className="border border-[#ccc]"></td>
                  <td className="border border-[#ccc]"></td>
                  <td className="border border-[#ccc]"></td>
                </tr>
              )}
              <tr className="h-6">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  9
                </td>
                <td className="border border-[#ccc]"></td>
                <td className="border border-[#ccc]"></td>
                <td className="border border-[#ccc]"></td>
                <td className="border border-[#ccc]"></td>
              </tr>
            </tbody>
          </table>
        )}

        {/* SHEET 2: BAHAN BAKU TERPAKAI */}
        {activeSheet === 'materials' && (
          <table className="w-full border-collapse table-fixed text-[10.5px]">
            <thead>
              <tr className="bg-[#f3f3f3] select-none text-slate-500 font-normal">
                <th className="w-8 border border-[#ccc] bg-[#f3f3f3] text-[8.5px] font-bold py-1"></th>
                <th className="w-48 border border-[#ccc] text-center font-semibold text-slate-500">
                  A
                </th>
                <th className="w-24 border border-[#ccc] text-center font-semibold text-slate-500">
                  B
                </th>
                <th className="w-20 border border-[#ccc] text-center font-semibold text-slate-500">
                  C
                </th>
                <th className="w-64 border border-[#ccc] text-center font-semibold text-slate-500">
                  D
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-8">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  1
                </td>
                <td
                  colSpan={4}
                  className="bg-[#107c41] text-white font-extrabold px-3 uppercase text-[9px] tracking-wide border border-[#ccc]"
                >
                  <div className="flex justify-between items-center w-full">
                    <span>LAPORAN PEMAKAIAN BAHAN BAKU / INVENTORI TERPAKAI</span>
                    <button
                      type="button"
                      onClick={addMaterialRow}
                      className="bg-white hover:bg-slate-100 text-[#107c41] text-[8.5px] font-black px-2.5 py-0.5 rounded shadow-sm cursor-pointer transition-all uppercase border-none"
                    >
                      + Tambah Baris Bahan
                    </button>
                  </div>
                </td>
              </tr>
              <tr className="bg-[#f3f3f3] select-none text-slate-600 font-bold h-6 text-[9.5px]">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  2
                </td>
                <td className="border border-[#ccc] text-center uppercase tracking-wide">
                  PILIH INVENTORI BAHAN
                </td>
                <td className="border border-[#ccc] text-center uppercase tracking-wide">
                  QTY JUMLAH
                </td>
                <td className="border border-[#ccc] text-center uppercase tracking-wide">SATUAN</td>
                <td className="border border-[#ccc] text-center uppercase tracking-wide">
                  CATATAN DETAIL OPERATOR (HAPUS)
                </td>
              </tr>
              {materialUsage.length === 0 ? (
                <tr className="h-12">
                  <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                    3
                  </td>
                  <td
                    colSpan={4}
                    className="px-4 text-center text-slate-400 italic border border-[#ccc] bg-[#fafafa] py-4"
                  >
                    Belum ada pemakaian bahan dicatat. Klik "+ Tambah Baris Bahan" di pojok kanan
                    atas.
                  </td>
                </tr>
              ) : (
                materialUsage.map((row, idx) => {
                  const rowNum = 3 + idx;
                  return (
                    <tr key={idx} className="h-8 hover:bg-slate-50/50">
                      <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                        {rowNum}
                      </td>
                      <td className="p-0 border border-[#ccc] bg-white">
                        <select
                          value={row.item_id}
                          onChange={(e) => selectInventoryItem(idx, e.target.value)}
                          className="w-full h-full bg-transparent px-2 outline-none text-slate-700 border-none font-bold"
                        >
                          <option value="">-- Pilih Bahan --</option>
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.nama} (Stok: {inv.stok} {inv.satuan})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-0 border border-[#ccc] bg-white">
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => updateMaterialField(idx, 'qty', e.target.value)}
                          placeholder="0"
                          className="w-full h-full bg-transparent px-2 text-center font-bold text-slate-800 outline-none border border-transparent focus:border-[#107c41]"
                        />
                      </td>
                      <td className="px-2 text-center text-slate-500 font-extrabold border border-[#ccc] bg-[#fafafa]">
                        {row.satuan || '-'}
                      </td>
                      <td className="p-0 border border-[#ccc] bg-white">
                        <div className="flex items-center h-full w-full">
                          <input
                            type="text"
                            value={row.catatan}
                            onChange={(e) => updateMaterialField(idx, 'catatan', e.target.value)}
                            placeholder="Tulis catatan pemakaian..."
                            className="flex-1 h-full bg-transparent px-2 outline-none border border-transparent focus:border-[#107c41]"
                          />
                          <button
                            type="button"
                            onClick={() => removeMaterialRow(idx)}
                            className="px-2 text-red-500 hover:text-red-700 transition-colors shrink-0 cursor-pointer border-none bg-transparent"
                            title="Hapus baris"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              <tr className="h-6">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  {3 + Math.max(materialUsage.length, 1) + 1}
                </td>
                <td className="border border-[#ccc] bg-white"></td>
                <td className="border border-[#ccc] bg-white"></td>
                <td className="border border-[#ccc] bg-white"></td>
                <td className="border border-[#ccc] bg-white"></td>
              </tr>
            </tbody>
          </table>
        )}

        {/* SHEET 3: RUMUS INSENTIF */}
        {activeSheet === 'incentive' && (
          <table className="w-full border-collapse table-fixed text-[10.5px]">
            <thead>
              <tr className="bg-[#f3f3f3] select-none text-slate-500 font-normal">
                <th className="w-8 border border-[#ccc] bg-[#f3f3f3] text-[8.5px] font-bold py-1"></th>
                <th className="w-48 border border-[#ccc] text-center font-semibold text-slate-500">
                  A
                </th>
                <th className="w-64 border border-[#ccc] text-center font-semibold text-slate-500">
                  B
                </th>
                <th className="w-48 border border-[#ccc] text-center font-semibold text-slate-500">
                  C
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-8">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  1
                </td>
                <td
                  colSpan={3}
                  className="bg-[#107c41] text-white font-extrabold px-3 uppercase text-[9px] tracking-wide border border-[#ccc]"
                >
                  RUMUS KALKULASI & ESTIMASI INSENTIF KERJA
                </td>
              </tr>
              <tr className="bg-[#f3f3f3] select-none text-slate-600 font-bold h-6 text-[9.5px]">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  2
                </td>
                <td className="border border-[#ccc] text-center uppercase tracking-wide">
                  NAMA PARAMETER
                </td>
                <td className="border border-[#ccc] text-center uppercase tracking-wide">
                  NILAI / INPUT SEL
                </td>
                <td className="border border-[#ccc] text-center uppercase tracking-wide">
                  KETERANGAN RUMUS
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  3
                </td>
                <td className="bg-[#f9f9f9] px-2 font-bold text-slate-500 border border-[#ccc]">
                  PANJANG ORDER ITEM (m)
                </td>
                <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-slate-50">
                  {panjang} m
                </td>
                <td className="px-2 text-slate-400 border border-[#ccc] italic">
                  Diambil dari nota penjualan
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  4
                </td>
                <td className="bg-[#f9f9f9] px-2 font-bold text-slate-500 border border-[#ccc]">
                  LEBAR ORDER ITEM (m)
                </td>
                <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-slate-50">
                  {lebar} m
                </td>
                <td className="px-2 text-slate-400 border border-[#ccc] italic">
                  Diambil dari nota penjualan
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  5
                </td>
                <td className="bg-[#f9f9f9] px-2 font-bold text-slate-500 border border-[#ccc]">
                  LUAS TOTAL CETAK (m²)
                </td>
                <td className="px-2 font-black text-indigo-700 border border-[#ccc] bg-slate-50">
                  {luas.toFixed(2)} m²
                </td>
                <td className="px-2 text-slate-400 border border-[#ccc] font-mono">=A3 * A4</td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  6
                </td>
                <td className="bg-[#e2f0d9] px-2 font-extrabold text-emerald-800 border border-[#ccc]">
                  TARIF JASA CETAK / m² (Rp)
                </td>
                <td className="p-0 border border-[#ccc] bg-white">
                  <input
                    type="number"
                    value={tarifPerm2}
                    onChange={(e) => setTarifPerm2(parseFloat(e.target.value) || 0)}
                    className="w-full h-full bg-transparent px-2 font-bold text-slate-800 outline-none border border-transparent focus:border-[#107c41]"
                  />
                </td>
                <td className="px-2 text-slate-400 border border-[#ccc] italic">
                  Bisa diubah (Tarif dasar: Rp15,000)
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  7
                </td>
                <td className="bg-[#f9f9f9] px-2 font-bold text-slate-500 border border-[#ccc]">
                  JUMLAH BARANG (Qty)
                </td>
                <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-slate-50">
                  {orderQty} Pcs
                </td>
                <td className="px-2 text-slate-400 border border-[#ccc] italic">
                  Jumlah pesanan di nota
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  8
                </td>
                <td className="bg-[#e2f0d9] px-2 font-extrabold text-emerald-800 border border-[#ccc]">
                  PERSENTASE KOMISI (%)
                </td>
                <td className="p-0 border border-[#ccc] bg-white">
                  <input
                    type="number"
                    value={komisiPersen}
                    onChange={(e) => setKomisiPersen(parseFloat(e.target.value) || 0)}
                    className="w-full h-full bg-transparent px-2 font-bold text-slate-800 outline-none border border-transparent focus:border-[#107c41]"
                  />
                </td>
                <td className="px-2 text-slate-400 border border-[#ccc] italic">
                  Bisa diubah (Standar: 5%)
                </td>
              </tr>
              <tr className="h-7 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  9
                </td>
                <td className="bg-[#f9f9f9] px-2 font-bold text-slate-500 border border-[#ccc]">
                  BIAYA TAMBAHAN DESAIN (Rp)
                </td>
                <td className="px-2 font-bold text-slate-800 border border-[#ccc] bg-slate-50">
                  Rp{designFee.toLocaleString()}
                </td>
                <td className="px-2 text-slate-400 border border-[#ccc] italic">
                  Diambil dari Input Sel A4 Sheet1
                </td>
              </tr>
              <tr className="h-8 hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  10
                </td>
                <td className="bg-[#f9f9f9] px-2 font-extrabold text-slate-500 border border-[#ccc]">
                  RUMUS EXCEL AKHIR
                </td>
                <td
                  colSpan={2}
                  className="px-2 font-mono text-[#107c41] font-bold border border-[#ccc] bg-[#f9f9f9]"
                >
                  {luas > 0
                    ? `=ROUND(((A5 * A6 * A7) * (A8 / 100)) + A9, 0)`
                    : `=ROUND((TOTAL_NOTA * (A8 / 100)) + A9, 0)`}
                </td>
              </tr>
              <tr className="h-10 hover:bg-slate-50/30 bg-[#e2f0d9]/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  11
                </td>
                <td className="bg-[#e2f0d9] px-2 font-black text-[#107c41] border border-[#ccc] text-[11px]">
                  ESTIMASI INSENTIF BERHASIL (Rp)
                </td>
                <td
                  colSpan={2}
                  className="px-3 font-black text-lg text-[#107c41] border border-[#ccc] font-mono"
                >
                  Rp{computedIncentive.toLocaleString()}
                </td>
              </tr>
              <tr className="h-8">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  12
                </td>
                <td
                  colSpan={3}
                  className="bg-[#107c41] text-white font-extrabold px-3 uppercase text-[9px] tracking-wide border border-[#ccc] py-1"
                >
                  ℹ️ INFORMASI & PANDUAN KUSTOMISASI FORMULA
                </td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  13
                </td>
                <td className="bg-[#fafafa] px-2 font-bold text-slate-500 border border-[#ccc] uppercase align-top py-2">
                  RUMUS UTAMA (ADA UKURAN)
                </td>
                <td colSpan={2} className="px-3 py-2 text-slate-700 border border-[#ccc] font-medium leading-relaxed bg-white">
                  <strong>Rumus:</strong> (Luas m² x Tarif per m² x Qty) x (Persentase Komisi / 100) + Biaya Tambahan Desain <br />
                  <span className="text-slate-500 italic">Digunakan apabila barang memiliki ukuran panjang dan lebar yang valid di nota penjualan.</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  14
                </td>
                <td className="bg-[#fafafa] px-2 font-bold text-slate-500 border border-[#ccc] uppercase align-top py-2">
                  RUMUS ALTERNATIF (TANPA UKURAN)
                </td>
                <td colSpan={2} className="px-3 py-2 text-slate-700 border border-[#ccc] font-medium leading-relaxed bg-white">
                  <strong>Rumus:</strong> Subtotal Harga Nota x (Persentase Komisi / 100) + Biaya Tambahan Desain <br />
                  <span className="text-slate-500 italic">Secara otomatis aktif sebagai fallback apabila ukuran panjang/lebar produk bernilai 0 atau tidak didefinisikan.</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="bg-[#f3f3f3] text-center font-bold text-[9px] text-slate-400 border border-[#ccc] select-none w-8">
                  15
                </td>
                <td className="bg-[#e8f5e9] px-2 font-bold text-[#1b5e20] border border-[#ccc] uppercase align-top py-2">
                  CARA KUSTOMISASI MANDIRI
                </td>
                <td colSpan={2} className="px-3 py-2 text-slate-700 border border-[#ccc] font-medium leading-relaxed bg-[#e8f5e9]/10">
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Pindah ke sel input berwarna <strong>hijau muda</strong> di atas pada Baris 6 (Tarif Jasa Cetak) atau Baris 8 (Persentase Komisi).</li>
                    <li>Ubah angka secara langsung sesuai kebutuhan kesepakatan baru dengan staff.</li>
                    <li>Hasil akhir <strong>ESTIMASI INSENTIF (Baris 11)</strong> akan terkalkulasi ulang secara otomatis dan presisi!</li>
                    <li>Klik <strong>"Simpan Draft"</strong> untuk mengunci nilai insentif baru ini ke dalam SPK.</li>
                  </ol>
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {/* SHEET 4: CATATAN BEBAS */}
        {activeSheet === 'notes' && (
          <div className="flex flex-col h-full">
            {/* Search bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f9f9f9] border-b border-[#ccc] shrink-0">
              <Search size={11} className="text-slate-400 shrink-0" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari teks dalam grid..."
                className="flex-1 bg-transparent outline-none text-[10px] text-slate-700" />
              <button onClick={() => { setFreeGrid(g => [...g, Array(COLS.length).fill('')]); }}
                className="flex items-center gap-1 text-[9px] font-bold text-[#107c41] border border-[#107c41] px-2 py-0.5 rounded hover:bg-[#107c41]/10 cursor-pointer">
                <Plus size={9} /> Tambah Baris
              </button>
            </div>
            {/* Free grid */}
            <div className="overflow-auto flex-1">
              <table className="border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-[#f3f3f3] sticky top-0 z-10">
                    <th className="w-8 border border-[#ccc] text-[8px] text-slate-400 py-1 font-bold" />
                    {COLS.map(c => (
                      <th key={c} className="w-28 border border-[#ccc] text-center text-slate-500 font-semibold py-1">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {freeGrid.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
                      <td className="border border-[#ccc] text-center text-[8.5px] text-slate-400 font-bold bg-[#f3f3f3] select-none w-8">{ri + 1}</td>
                      {row.map((cell, ci) => {
                        const isActive = activeCell?.r === ri && activeCell?.c === ci;
                        const highlight = searchQuery && cell && cell.toLowerCase().includes(searchQuery.toLowerCase());
                        return (
                          <td key={ci}
                            onClick={() => { setActiveCell({ r: ri, c: ci }); setFormulaVal(cell); }}
                            className={`border border-[#ccc] p-0 relative ${
                              isActive ? 'outline outline-2 outline-[#107c41] z-10' : ''
                            } ${highlight ? 'bg-yellow-100' : ''}`}>
                            <input
                              value={cell}
                              onFocus={() => { setActiveCell({ r: ri, c: ci }); setFormulaVal(cell); }}
                              onChange={e => { setFreeCell(ri, ci, e.target.value); setFormulaVal(e.target.value); }}
                              className="w-full h-6 px-1.5 bg-transparent outline-none font-mono text-slate-800 text-[10px]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* EXCEL STATUS BAR / SHEET TABS */}
      <div className="bg-[#f3f3f3] border-t border-[#ccc] px-2 py-0.5 flex items-center justify-between text-[9px] text-slate-500 shrink-0 font-semibold select-none">
        <div className="flex items-center gap-0.5">
          {[['detail','Sheet1 · SPK Detail'],['materials','Sheet2 · Bahan'],['incentive','Sheet3 · Insentif'],['notes','Sheet4 · Catatan Bebas']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveSheet(id)}
              className={`px-2.5 py-0.5 border-none outline-none cursor-pointer transition-all ${
                activeSheet === id
                  ? 'bg-white text-[#107c41] font-black border-t-2 border-t-[#107c41] rounded-t-sm'
                  : 'bg-[#e1dfdd] text-slate-600 hover:bg-slate-200 rounded-t-sm'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 font-mono">
          {activeCell && activeSheet === 'notes' && (
            <span className="text-[#107c41] font-black">Sel: {COLS[activeCell.c]}{activeCell.r + 1}</span>
          )}
          <span className="text-slate-400">SPK #{job.id}</span>
          <span className={`font-bold ${
            job.status_pekerjaan === 'selesai' ? 'text-emerald-600' :
            job.status_pekerjaan === 'dikerjakan' ? 'text-blue-600' : 'text-slate-500'
          }`}>● {job.status_pekerjaan?.toUpperCase()}</span>
        </div>
      </div>
      
      <KomplainModal
        isOpen={isKomplainOpen}
        onClose={() => setIsKomplainOpen(false)}
        order={{
          id: job?.order_id || job?.order_item_detail?.order || job?.order_item,
          nama: job?.pelanggan_nama || 'Pelanggan',
          nomor_wa: job?.pelanggan_wa || '',
        }}
        defaultFotoBukti={driveLink}
        onSuccess={() => {
          setIsKomplainOpen(false);
          fetchComplaints();
        }}
      />
    </div>
  );
}
