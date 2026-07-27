import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, X, Trash2, HelpCircle, AlertCircle, Plus, FileText, ChevronDown, Calendar } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function HutangMultiJurnal() {
  const [searchParams, setSearchParams] = useSearchParams();

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
    '42005 Layanan biaya penjualan',
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
    if (!selectedJournal) return;
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
    setSearchParams({ active: 'payable', subMenu: 'hutang-semua' });
  };

  const handleCancelAll = () => {
    setRows([]);
    setSearchParams({ active: 'payable', subMenu: 'hutang-semua' });
    notify({ type: 'info', title: 'Dibatalkan', message: 'Penyusunan multi jurnal dibatalkan.' });
  };

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = totalDebit === totalCredit && rows.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fade-in text-xs font-semibold text-slate-700 w-full flex flex-col h-[calc(100vh-140px)] min-h-[750px]">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-[#F8FAFC]">
        <h3 className="text-sm font-bold text-slate-800 tracking-wide">Form Multi Jurnal (Hutang)</h3>
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

              {showAddJournalInput && (
                <div className="pt-2 flex items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Masukkan nama jurnal baru"
                    value={newJournalName}
                    onChange={(e) => setNewJournalName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-205 rounded-md outline-none focus:border-[#0088E8] text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomJournal}
                    className="px-3 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-md font-bold"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddJournalInput(false);
                      setNewJournalName('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-md"
                  >
                    Batal
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

        {/* Rincian Jurnal Table Grid */}
        <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-3xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                <th className="px-5 py-3 w-[30%]">Akun</th>
                <th className="px-5 py-3 w-[25%]">Deskripsi</th>
                <th className="px-5 py-3 w-[15%]">No. Dokumen</th>
                <th className="px-5 py-3 w-[12%] text-right">Debit (IDR)</th>
                <th className="px-5 py-3 w-[13%] text-right">Kredit (IDR)</th>
                <th className="px-5 py-3 w-[5%] text-center">Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-bold select-none">
                    Belum ada akun dimasukkan
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-slate-800 font-bold">{row.account}</td>
                    <td className="px-5 py-3 text-slate-600 font-semibold">{row.description}</td>
                    <td className="px-5 py-3 text-slate-600 font-mono font-semibold">{row.docNo}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                      {row.debit > 0 ? row.debit.toLocaleString('id-ID', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                      {row.credit > 0 ? row.credit.toLocaleString('id-ID', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer border border-slate-200"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {/* Summary balancing info */}
              <tr className="bg-slate-50/40 font-bold text-slate-850">
                <td colSpan={3} className="px-5 py-3 text-right text-[10px] uppercase tracking-wider text-slate-450">Total</td>
                <td className="px-5 py-3 text-right font-mono text-slate-900">
                  {totalDebit.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-right font-mono text-slate-900">
                  {totalCredit.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Balancing indicator box */}
        {rows.length > 0 && (
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          } animate-fade-in`}>
            <div className="flex items-center gap-2">
              {isBalanced ? <Check size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-rose-500" />}
              <span className="font-bold">
                {isBalanced
                  ? 'Debit dan Kredit Seimbang (Balance)'
                  : `Debit dan Kredit Tidak Seimbang! Selisih: IDR ${difference.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`}
              </span>
            </div>
          </div>
        )}

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

      {/* Rincian Jurnal Modal (Screenshot 2: Exact Match) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[600px] overflow-hidden text-xs font-semibold text-slate-700 animate-scale-up">
            
            {/* Modal Header (Screenshot 2: Rincian Jurnal title on left, Batal & Selanjutnya buttons on right) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-[#F8FAFC]">
              <h4 className="text-sm font-bold text-slate-800">Rincian Jurnal</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 border border-slate-200 bg-[#F4F5F7] hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddRowFromModal}
                  className="px-5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  Selanjutnya
                </button>
              </div>
            </div>

            {/* Modal Form Inputs */}
            <div className="p-6 space-y-4">
              
              {/* Akun (Disabled / Disallowed Cursor, Screenshot 2: Kas with light gray bg) */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Akun
                </label>
                <div>
                  <input
                    type="text"
                    disabled
                    value={modalAccount}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-100/70 text-slate-800 font-bold cursor-not-allowed text-xs"
                  />
                </div>
              </div>

              {/* Tipe: Debit/Kredit Segmented Control Button Group (Screenshot 2) */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Tipe <span className="text-[#E11D48]">*</span>
                </label>
                <div className="flex border border-slate-205 rounded-xl overflow-hidden bg-white shadow-3xs p-0.5">
                  <button
                    type="button"
                    onClick={() => setModalType('Debit')}
                    className={`flex-1 py-2 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      modalType === 'Debit'
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Debit
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalType('Kredit')}
                    className={`flex-1 py-2 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      modalType === 'Kredit'
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
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
                <div className="flex border border-slate-205 rounded-xl overflow-hidden bg-white shadow-3xs">
                  <span className="px-3.5 py-2.5 bg-slate-50 text-slate-500 font-bold border-r border-slate-205 select-none text-xs">
                    IDR
                  </span>
                  <input
                    type="text"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 outline-none text-xs font-semibold text-slate-800"
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
                  className="w-full px-3.5 py-2.5 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs resize-y text-xs"
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
                  className="w-full px-3.5 py-2.5 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs"
                />
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
