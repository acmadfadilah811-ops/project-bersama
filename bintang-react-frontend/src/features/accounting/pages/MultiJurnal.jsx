import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, Trash2, HelpCircle, AlertCircle, Plus, FileText, ChevronDown, Calendar } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function MultiJurnal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isHutang = searchParams.get('active') === 'payable';

  // Journal names list
  const defaultJournalNames = [
    'Akumulasi penyusutan',
    'Biaya',
    'Pembelian',
    'Penjualan',
    'Modal',
    'Hutang',
    'Piutang',
    'Pengembalian'
  ];
  const [journalNames, setJournalNames] = useState(defaultJournalNames);
  const [selectedJournal, setSelectedJournal] = useState('');
  const [isJournalDropdownOpen, setIsJournalDropdownOpen] = useState(false);
  const journalDropdownRef = useRef(null);

  // Inline add journal name form
  const [showAddJournalInput, setShowAddJournalInput] = useState(false);
  const [newJournalName, setNewJournalName] = useState('');

  // Department names list
  const defaultDepts = ['Pusat', 'Cabang A', 'Cabang B'];
  const [depts, setDepts] = useState(defaultDepts);
  const [selectedDept, setSelectedDept] = useState('');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef(null);

  // Inline add department name form
  const [showAddDeptInput, setShowAddDeptInput] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  // Date and currency
  const [txDate, setTxDate] = useState('2026-07-26');
  const [currency] = useState('IDR');

  // Account selector list
  const accountsList = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '11200 Investasi jangka pendek dan surat berharga',
    '11300 Piutang dagang',
    '11400 Persediaan barang dagang',
    '11500 Peralatan',
    '11600 Akumulasi penyusutan peralatan',
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan',
    '12000 Aset Tetap',
    '13000 Aset tak berwujud',
    '14000 Akumulasi penyusutan aset tetap',
    '15000 Akumulasi penyusutan aset tak berwujud',
    '21000 Hutang dagang',
    '21002 Cash Example',
    '22000 Hutang bank',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
    '31000 Modal',
    '32000 Prive',
    '33000 Laba rugi ditahan',
    '40000 Penjualan',
    '41000 Penjualan antar cabang',
    '42000 Layanan biaya penjualan',
    '44000 Pengiriman penjualan',
    '46100 Potongan penjualan',
    '46200 Loyalitas penjualan',
    '46300 Return penjualan',
    '50000 Pembelian',
    '50100 Pembelian antar cabang',
    '50300 Biaya pengiriman',
    '50400 Return pembelian',
    '50500 Potongan pembelian',
    '51000 Harga pokok penjualan',
    '60100 Biaya gaji',
    '60200 Biaya air listrik telephone',
    '60300 Biaya perlengkapan',
    '60400 Biaya penyusutan',
    '60500 Biaya transfer',
    '70000 Pendapatan lain lain',
    '70001 Pembulatan',
    '70002 Code Uniq Penjualan',
    '70003 Layanan Penjualan',
    '70009 Bank Example',
    '80000 Pengeluaran lain lain',
    '81000 Penyesuaian Barang'
  ];

  const [selectedAccount, setSelectedAccount] = useState('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef(null);

  // Table rows list state
  const [rows, setRows] = useState([]);

  // Modal: Rincian Jurnal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAccount, setModalAccount] = useState('');
  const [modalType, setModalType] = useState('Debit'); // 'Debit' | 'Kredit'
  const [modalAmount, setModalAmount] = useState('0,00');
  const [modalNotes, setModalNotes] = useState('');
  const [modalDocNo, setModalDocNo] = useState('');

  // Close custom selectors on click outside
  useEffect(() => {
    function clickOutside(e) {
      if (journalDropdownRef.current && !journalDropdownRef.current.contains(e.target)) {
        setIsJournalDropdownOpen(false);
      }
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target)) {
        setIsDeptDropdownOpen(false);
      }
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setIsAccountDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const handleAddCustomJournal = () => {
    const trimmed = newJournalName.trim();
    if (!trimmed) return;
    if (journalNames.includes(trimmed)) {
      notify({ type: 'warning', title: 'Nama Eksis', message: 'Nama jurnal kustom tersebut sudah ada.' });
      return;
    }
    setJournalNames((prev) => [...prev, trimmed]);
    setSelectedJournal(trimmed);
    setShowAddJournalInput(false);
    setNewJournalName('');
    notify({ type: 'success', title: 'Jurnal Ditambahkan', message: `Jurnal "${trimmed}" ditambahkan ke pilihan.` });
  };

  const handleRemoveCustomJournal = (name, e) => {
    e.stopPropagation();
    if (defaultJournalNames.includes(name)) return;
    setJournalNames((prev) => prev.filter((n) => n !== name));
    if (selectedJournal === name) setSelectedJournal('');
    notify({ type: 'success', title: 'Jurnal Dihapus', message: `Jurnal "${name}" berhasil dihapus.` });
  };

  const handleAddCustomDept = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    if (depts.includes(trimmed)) {
      notify({ type: 'warning', title: 'Departemen Eksis', message: 'Nama departemen tersebut sudah ada.' });
      return;
    }
    setDepts((prev) => [...prev, trimmed]);
    setSelectedDept(trimmed);
    setShowAddDeptInput(false);
    setNewDeptName('');
    notify({ type: 'success', title: 'Dept Ditambahkan', message: `Departemen "${trimmed}" ditambahkan ke pilihan.` });
  };

  const handleAccountSelect = (acc) => {
    if (!selectedJournal) return; // Disallowed
    setSelectedAccount(acc);
    setModalAccount(acc);
    setModalType('Debit');
    setModalAmount('0,00');
    setModalNotes('');
    setModalDocNo('');
    setIsModalOpen(true);
    setIsAccountDropdownOpen(false);
  };

  const handleAddRowFromModal = () => {
    const newRow = {
      id: Date.now(),
      account: modalAccount,
      description: modalNotes || 'Rincian jurnal internal',
      docNo: modalDocNo || '-',
      debit: modalType === 'Debit' ? parseFloat(modalAmount.replace(/\./g, '').replace(',', '.')) || 0 : 0,
      credit: modalType === 'Kredit' ? parseFloat(modalAmount.replace(/\./g, '').replace(',', '.')) || 0 : 0
    };

    setRows((prev) => [...prev, newRow]);
    setIsModalOpen(false);
    setSelectedAccount('');
    notify({
      type: 'success',
      title: 'Baris Ditambahkan',
      message: `Rincian akun ${modalAccount} berhasil ditambahkan ke tabel.`
    });
  };

  const handleDeleteRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    notify({ type: 'info', title: 'Baris Dihapus', message: 'Rincian jurnal berhasil dihapus dari daftar.' });
  };

  const handleSaveAll = () => {
    if (rows.length === 0) {
      notify({ type: 'warning', title: 'Daftar Kosong', message: 'Masukkan setidaknya satu rincian jurnal sebelum menyimpan.' });
      return;
    }
    notify({ type: 'success', title: 'Multi Jurnal Disimpan', message: 'Seluruh rincian multi jurnal berhasil disimpan ke kas.' });
    if (isHutang) {
      setSearchParams({ active: 'payable', subMenu: 'hutang-semua' });
    } else {
      setSearchParams({ active: 'receivable', subMenu: 'piutang-semua' });
    }
  };

  const handleCancelAll = () => {
    setRows([]);
    if (isHutang) {
      setSearchParams({ active: 'payable', subMenu: 'hutang-semua' });
    } else {
      setSearchParams({ active: 'receivable', subMenu: 'piutang-semua' });
    }
    notify({ type: 'info', title: 'Dibatalkan', message: 'Penyusunan multi jurnal dibatalkan.' });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fade-in text-xs font-semibold text-slate-700 w-full flex flex-col h-[calc(100vh-140px)] min-h-[750px]">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-[#F8FAFC]">
        <h3 className="text-sm font-bold text-slate-800 tracking-wide">Form Multi Jurnal</h3>
        <button
          disabled
          className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-350 font-extrabold text-[10px] flex items-center gap-1.5 cursor-not-allowed shadow-3xs"
        >
          <FileText size={12} />
          <span>Cetak jurnal ({rows.length})</span>
        </button>
      </div>

      {/* Main Workspace Form */}
      <div className="p-6 flex-1 space-y-6">
        
        {/* Two Column Layout for Fields */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          
          {/* Left Column Controls */}
          <div className="space-y-4">
            
            {/* Nama Jurnal */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Nama Jurnal <span className="text-[#E11D48]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1" ref={journalDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsJournalDropdownOpen(!isJournalDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg shadow-3xs cursor-pointer text-left"
                  >
                    <span>{selectedJournal || 'Pilih Nama Jurnal'}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  {isJournalDropdownOpen && (
                    <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50 w-full font-bold max-h-48 overflow-y-auto">
                      {journalNames.map((name) => {
                        const isCustom = !defaultJournalNames.includes(name);
                        return (
                          <div
                            key={name}
                            onClick={() => {
                              setSelectedJournal(name);
                              setIsJournalDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between px-3.5 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                              selectedJournal === name ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-700'
                            }`}
                          >
                            <span>{name}</span>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={(e) => handleRemoveCustomJournal(name, e)}
                                className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-md transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowAddJournalInput(true)}
                  className="px-3.5 py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg shadow-2xs cursor-pointer font-extrabold"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Inline input form for Nama Jurnal */}
              {showAddJournalInput && (
                <div className="pt-2 flex items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Nama Jurnal Baru"
                    value={newJournalName}
                    onChange={(e) => setNewJournalName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomJournal}
                    className="p-2 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddJournalInput(false);
                      setNewJournalName('');
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-205 text-slate-500 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Tanggal */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Tanggal <span className="text-[#E11D48]">*</span>
              </label>
              <div className="relative flex items-center bg-white border border-slate-205 rounded-lg px-3 py-2 shadow-3xs focus-within:border-[#0088E8] transition-all cursor-pointer">
                <Calendar size={13} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
                />
              </div>
            </div>

            {/* Mata Uang */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Mata Uang
              </label>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#0088E8] bg-[#E6F4FF]/30 text-[#0088E8] font-extrabold rounded-md text-[10px] tracking-wide select-none">
                  <Check size={12} className="stroke-[3]" />
                  {currency}
                </span>
              </div>
            </div>

          </div>

          {/* Right Column Controls */}
          <div className="space-y-4">
            
            {/* Departemen */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Departemen
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1" ref={deptDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg shadow-3xs cursor-pointer text-left"
                  >
                    <span>{selectedDept || 'Pilih Departemen'}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  {isDeptDropdownOpen && (
                    <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50 w-full font-bold max-h-48 overflow-y-auto">
                      {depts.length === 0 ? (
                        <div className="px-3.5 py-3 text-[11px] text-slate-400 font-semibold italic text-center select-none">
                          No data
                        </div>
                      ) : (
                        depts.map((dept) => (
                          <div
                            key={dept}
                            onClick={() => {
                              setSelectedDept(dept);
                              setIsDeptDropdownOpen(false);
                            }}
                            className={`px-3.5 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                              selectedDept === dept ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-700'
                            }`}
                          >
                            {dept}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowAddDeptInput(true)}
                  className="px-3.5 py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg shadow-2xs cursor-pointer font-extrabold"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Inline input form for Departemen */}
              {showAddDeptInput && (
                <div className="pt-2 flex items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Nama Departemen Baru"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomDept}
                    className="p-2 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddDeptInput(false);
                      setNewDeptName('');
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-205 text-slate-500 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Nama Akun */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Nama Akun <span className="text-[#E11D48]">*</span>
              </label>
              
              <div className="relative" ref={accountDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedJournal) {
                      setIsAccountDropdownOpen(!isAccountDropdownOpen);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg shadow-3xs text-left transition-all ${
                    selectedJournal
                      ? 'border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer'
                      : 'border-slate-150 bg-slate-100/60 text-slate-400 font-semibold cursor-not-allowed'
                  }`}
                  title={!selectedJournal ? 'Pilih Nama Jurnal terlebih dahulu' : ''}
                >
                  <span>{selectedAccount || 'Pilih Akun'}</span>
                  <ChevronDown size={14} className={selectedJournal ? 'text-slate-400' : 'text-slate-300'} />
                </button>
                
                {selectedJournal && isAccountDropdownOpen && (
                  <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50 w-full font-bold max-h-56 overflow-y-auto">
                    {accountsList.map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => handleAccountSelect(acc)}
                        className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors text-slate-750"
                      >
                        {acc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Multi Jurnal Data Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-white mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-5 py-3">Nama Akun</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3">No. Dokumen</th>
                <th className="px-5 py-3 text-right">Nilai Debit</th>
                <th className="px-5 py-3 text-right">Nilai Kredit</th>
                <th className="px-5 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-bold">
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-slate-750 font-bold">{row.account}</td>
                    <td className="px-5 py-3 text-slate-500 font-medium max-w-xs truncate">{row.description}</td>
                    <td className="px-5 py-3 text-slate-550 font-mono">{row.docNo}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-800">
                      {row.debit > 0 ? row.debit.toLocaleString('id-ID', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-800">
                      {row.credit > 0 ? row.credit.toLocaleString('id-ID', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer save/cancel split buttons (Screenshot 1: 50% / 50%) */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCancelAll}
            className="w-full py-3 border border-slate-205 bg-[#F4F5F7] hover:bg-slate-200 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer text-center text-xs transition-colors"
          >
            Batal
          </button>
          
          <button
            type="button"
            onClick={handleSaveAll}
            className="w-full py-3 bg-[#51a351] hover:bg-[#419241] text-white font-bold rounded-xl shadow-2xs cursor-pointer text-center text-xs transition-colors"
          >
            Simpan
          </button>
        </div>

      </div>

      {/* Rincian Jurnal Modal (Screenshot 2) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[560px] overflow-hidden text-xs font-semibold text-slate-700 animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-150 bg-[#F8FAFC]">
              <h4 className="text-sm font-bold text-slate-800">Rincian Jurnal</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddRowFromModal}
                  className="px-3.5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg font-bold text-[10px] cursor-pointer"
                >
                  Selanjutnya
                </button>
              </div>
            </div>

            {/* Modal Form Inputs */}
            <div className="p-5 space-y-4">
              
              {/* Akun (Disabled / Disallowed Cursor) */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Akun
                </label>
                <div>
                  <input
                    type="text"
                    disabled
                    value={modalAccount}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed font-bold"
                  />
                </div>
              </div>

              {/* Tipe: Debit/Kredit Toggle Button Tab */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Tipe <span className="text-[#E11D48]">*</span>
                </label>
                <div className="flex border border-slate-205 rounded-lg overflow-hidden bg-white shadow-3xs p-0.5">
                  <button
                    type="button"
                    onClick={() => setModalType('Debit')}
                    className={`flex-1 py-1.5 text-center rounded-md font-bold transition-all cursor-pointer ${
                      modalType === 'Debit'
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Debit
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalType('Kredit')}
                    className={`flex-1 py-1.5 text-center rounded-md font-bold transition-all cursor-pointer ${
                      modalType === 'Kredit'
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Kredit
                  </button>
                </div>
              </div>

              {/* Jumlah */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Jumlah <span className="text-[#E11D48]">*</span>
                </label>
                <div className="flex border border-slate-205 rounded-lg overflow-hidden bg-white shadow-3xs">
                  <span className="px-3 py-2 bg-slate-50 text-slate-500 font-bold border-r border-slate-205 select-none">
                    IDR
                  </span>
                  <input
                    type="text"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    className="flex-1 px-3 py-2 outline-none text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Catatan <span className="text-[#E11D48]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Masukkan catatan rincian..."
                  className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs resize-y"
                />
              </div>

              {/* No. Dokumen */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  No. Dokumen
                </label>
                <input
                  type="text"
                  value={modalDocNo}
                  onChange={(e) => setModalDocNo(e.target.value)}
                  placeholder="Masukkan no dokumen jika ada"
                  className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs"
                />
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
