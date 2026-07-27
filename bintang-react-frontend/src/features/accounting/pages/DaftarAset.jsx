import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, Filter, Plus, FileSpreadsheet, X, Check } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function DaftarAset() {
  const [searchParams, setSearchParams] = useSearchParams();

  const subMenuParam = searchParams ? searchParams.get('subMenu') : null;
  const isAddingAsset = subMenuParam === 'aset-tambah';

  const openAddForm = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('active', 'asset');
      next.set('subMenu', 'aset-tambah');
      return next;
    });
  };

  const closeAddForm = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('active', 'asset');
      next.delete('subMenu');
      return next;
    });
  };

  // Tab Mode: 'semua' | 'per-tanggal'
  const [assetTab, setAssetTab] = useState('per-tanggal');

  // Filter dropdown state ('Tanpa Filter', 'No. Transaksi', 'Deskripsi', 'Status', 'Penyusutan Terakhir')
  const [filterType, setFilterType] = useState('Tanpa Filter');
  const [isFilterTypeOpen, setIsFilterTypeOpen] = useState(false);
  const filterTypeRef = useRef(null);

  // Date Filter Modal State
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedRangeOption, setSelectedRangeOption] = useState('Hari ini');
  const [startDate, setStartDate] = useState('2026-07-26');
  const [endDate, setEndDate] = useState('2026-07-26');
  const [displayDateText, setDisplayDateText] = useState('Hari ini 26 Jul 2026 - 26 Jul 2026');

  // Page limit size
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);

  // Asset Dataset State (empty by default)
  const [assets, setAssets] = useState([]);

  // ==========================================
  // FORM (+ TAMBAH) STATES - Screenshot 1 & 2
  // ==========================================
  const [journalNames, setJournalNames] = useState([
    'Akumulasi penyusutan',
    'Biaya',
    'Pembelian',
    'Penjualan',
    'Modal',
    'Hutang',
    'Piutang',
    'Pengembalian'
  ]);
  const [selectedJournal, setSelectedJournal] = useState('');
  const [isJournalDropdownOpen, setIsJournalDropdownOpen] = useState(false);
  const journalDropdownRef = useRef(null);

  // Inline custom journal name entry
  const [showAddJournalInput, setShowAddJournalInput] = useState(false);
  const [newJournalInput, setNewJournalInput] = useState('');

  // Date input for form
  const [txDate, setTxDate] = useState('2026-07-26');

  // Account Debit options
  const debitAccountOptions = [
    '11200 Investasi jangka pendek dan surat berharga',
    '11500 Peralatan',
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan',
    '12000 Aset Tetap',
    '13000 Aset tak berwujud'
  ];
  const [selectedDebitAccount, setSelectedDebitAccount] = useState('');
  const [isDebitDropdownOpen, setIsDebitDropdownOpen] = useState(false);
  const debitDropdownRef = useRef(null);

  // Account Kredit options
  const creditAccountOptions = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '11500 Peralatan',
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan',
    '12000 Aset Tetap',
    '13000 Aset tak berwujud',
    '21000 Hutang dagang',
    '21002 Cash Example',
    '22000 Hutang bank',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
    '31000 Modal',
    '32000 Prive',
    '33000 Laba rugi ditahan'
  ];
  const [selectedCreditAccount, setSelectedCreditAccount] = useState('');
  const [isCreditDropdownOpen, setIsCreditDropdownOpen] = useState(false);
  const creditDropdownRef = useRef(null);

  // Department State
  const [departments, setDepartments] = useState(['Pusat']);
  const [selectedDept, setSelectedDept] = useState('');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef(null);

  // Modal Tambah Departement (Screenshot 2)
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState('');

  // Other form fields
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('0,00');
  const [docNo, setDocNo] = useState('');

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterTypeRef.current && !filterTypeRef.current.contains(event.target)) {
        setIsFilterTypeOpen(false);
      }
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
      if (journalDropdownRef.current && !journalDropdownRef.current.contains(event.target)) {
        setIsJournalDropdownOpen(false);
      }
      if (debitDropdownRef.current && !debitDropdownRef.current.contains(event.target)) {
        setIsDebitDropdownOpen(false);
      }
      if (creditDropdownRef.current && !creditDropdownRef.current.contains(event.target)) {
        setIsCreditDropdownOpen(false);
      }
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target)) {
        setIsDeptDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter option items
  const filterOptions = [
    'Tanpa Filter',
    'No. Transaksi',
    'Deskripsi',
    'Status',
    'Penyusutan Terakhir'
  ];

  // Quick Date Range selector presets
  const handleSelectQuickRange = (rangeName) => {
    setSelectedRangeOption(rangeName);
    const todayStr = '2026-07-26';
    if (rangeName === 'Hari ini') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (rangeName === 'Kemarin') {
      setStartDate('2026-07-25');
      setEndDate('2026-07-25');
    } else if (rangeName === '7 Hari yang lalu') {
      setStartDate('2026-07-19');
      setEndDate(todayStr);
    } else if (rangeName === '30 Hari yang lalu') {
      setStartDate('2026-06-26');
      setEndDate(todayStr);
    } else if (rangeName === 'Bulan ini') {
      setStartDate('2026-07-01');
      setEndDate('2026-07-31');
    } else if (rangeName === 'Bulan lalu') {
      setStartDate('2026-06-01');
      setEndDate('2026-06-30');
    }
  };

  const handleApplyDateFilter = () => {
    setDisplayDateText(`${selectedRangeOption} ${startDate} - ${endDate}`);
    setIsDateModalOpen(false);
    notify({
      type: 'info',
      title: 'Filter Tanggal',
      message: `Filter aset diperbarui: ${selectedRangeOption}`
    });
  };

  const handleResetDateFilter = () => {
    setSelectedRangeOption('Hari ini');
    setStartDate('2026-07-26');
    setEndDate('2026-07-26');
    setDisplayDateText('Hari ini 26 Jul 2026 - 26 Jul 2026');
    setIsDateModalOpen(false);
  };

  const handleSaveCustomJournalName = () => {
    if (!newJournalInput.trim()) return;
    setJournalNames((prev) => [...prev, newJournalInput.trim()]);
    setSelectedJournal(newJournalInput.trim());
    setNewJournalInput('');
    setShowAddJournalInput(false);
    notify({
      type: 'success',
      title: 'Nama Jurnal Ditambahkan',
      message: `Nama jurnal kustom baru berhasil dibuat.`
    });
  };

  const handleSaveNewDepartment = () => {
    if (!newDeptInput.trim()) return;
    setDepartments((prev) => [...prev, newDeptInput.trim()]);
    setSelectedDept(newDeptInput.trim());
    setNewDeptInput('');
    setIsAddDeptModalOpen(false);
    notify({
      type: 'success',
      title: 'Departemen Ditambahkan',
      message: `Departemen baru berhasil disimpan.`
    });
  };

  const handleSaveForm = () => {
    const numAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0;
    const newAsset = {
      id: Date.now(),
      buyDate: txDate,
      name: selectedJournal || 'Aset Baru',
      description: notes || '-',
      initialValue: numAmount,
      residualValue: 0,
      remainingValue: numAmount,
      lastDepreciationDate: '-',
      docNo: docNo || '-'
    };

    setAssets((prev) => [newAsset, ...prev]);
    closeAddForm();

    // Reset Form
    setSelectedJournal('');
    setSelectedDebitAccount('');
    setSelectedCreditAccount('');
    setSelectedDept('');
    setNotes('');
    setAmount('0,00');
    setDocNo('');

    notify({
      type: 'success',
      title: 'Jurnal Disimpan',
      message: 'Transaksi jurnal aset baru berhasil disimpan.'
    });
  };

  const handleCancelForm = () => {
    closeAddForm();
  };

  const handleAddAsset = () => {
    notify({
      type: 'info',
      title: 'Segera Hadir',
      message: 'Fitur Import & Export Aset belum tersedia.'
    });
  };

  // ==========================================
  // RENDER: FORM + TAMBAH JURNAL (Screenshot 1)
  // ==========================================
  if (isAddingAsset) {
    return (
      <div className="space-y-6 animate-fade-in text-xs font-semibold text-slate-700">
        
        {/* Form Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 select-none bg-white p-4 rounded-xl shadow-xs">
          <span className="text-slate-400 font-medium text-xs">(*) Harus diisi</span>
          <h3 className="text-sm font-bold text-slate-800 tracking-wide">Jurnal</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-4 py-1.5 border border-slate-200 bg-[#F4F5F7] hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveForm}
              className="px-5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Centered Form Workspace */}
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xs p-8 space-y-5">
          
          {/* 1. Nama Jurnal * */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Nama Jurnal <span className="text-[#E11D48]">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1" ref={journalDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsJournalDropdownOpen(!isJournalDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer text-left"
                >
                  <span className={selectedJournal ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedJournal || 'Pilih Nama Jurnal'}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                
                {isJournalDropdownOpen && (
                  <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 w-full font-bold max-h-56 overflow-y-auto">
                    {journalNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setSelectedJournal(name);
                          setIsJournalDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                          selectedJournal === name ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-750'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAddJournalInput(!showAddJournalInput)}
                className="px-4 py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-xl shadow-2xs font-extrabold text-xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus size={14} />
                <span>Tambah Nama</span>
              </button>
            </div>

            {/* Inline input form for Nama Jurnal */}
            {showAddJournalInput && (
              <div className="pt-2 flex items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  placeholder="Masukkan nama jurnal baru"
                  value={newJournalInput}
                  onChange={(e) => setNewJournalInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomJournalName}
                  className="p-2 bg-[#51a351] hover:bg-[#419241] text-white rounded-xl transition-colors cursor-pointer"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddJournalInput(false);
                    setNewJournalInput('');
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-205 text-slate-500 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* 2. Tanggal * */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Tanggal <span className="text-[#E11D48]">*</span>
            </label>
            <div className="relative flex items-center bg-white border border-slate-205 rounded-xl px-3.5 py-2.5 shadow-3xs focus-within:border-[#0088E8] transition-all cursor-pointer">
              <Calendar size={14} className="text-slate-400 mr-2 shrink-0" />
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Akun Debit * */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Akun Debit <span className="text-[#E11D48]">*</span>
            </label>
            <div className="relative" ref={debitDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDebitDropdownOpen(!isDebitDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer text-left"
              >
                <span className={selectedDebitAccount ? 'text-slate-800' : 'text-slate-400'}>
                  {selectedDebitAccount || 'Pilih Akun Debit'}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {isDebitDropdownOpen && (
                <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 w-full font-bold max-h-56 overflow-y-auto">
                  {debitAccountOptions.map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        setSelectedDebitAccount(acc);
                        setIsDebitDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                        selectedDebitAccount === acc ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-750'
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Akun Kredit * */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Akun Kredit <span className="text-[#E11D48]">*</span>
            </label>
            <div className="relative" ref={creditDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCreditDropdownOpen(!isCreditDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer text-left"
              >
                <span className={selectedCreditAccount ? 'text-slate-800' : 'text-slate-400'}>
                  {selectedCreditAccount || 'Pilih Akun Kredit'}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {isCreditDropdownOpen && (
                <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 w-full font-bold max-h-56 overflow-y-auto">
                  {creditAccountOptions.map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => {
                        setSelectedCreditAccount(acc);
                        setIsCreditDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                        selectedCreditAccount === acc ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-750'
                      }`}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. Departemen (dengan tombol + memicu modal Screenshot 2) */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Departemen
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1" ref={deptDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer text-left"
                >
                  <span className={selectedDept ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedDept || 'Pilih Departemen'}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {isDeptDropdownOpen && (
                  <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 w-full font-bold max-h-48 overflow-y-auto">
                    {departments.length === 0 ? (
                      <div className="px-4 py-3 text-[11px] text-slate-400 italic text-center">
                        Belum ada departemen
                      </div>
                    ) : (
                      departments.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setSelectedDept(d);
                            setIsDeptDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                            selectedDept === d ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-750'
                          }`}
                        >
                          {d}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Blue '+' Button triggers Modal Tambah departement (Screenshot 2) */}
              <button
                type="button"
                onClick={() => setIsAddDeptModalOpen(true)}
                className="px-3.5 py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-xl shadow-2xs font-extrabold cursor-pointer shrink-0"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* 6. Catatan * */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Catatan <span className="text-[#E11D48]">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder=""
              className="w-full px-3.5 py-2.5 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs resize-y text-xs font-semibold text-slate-800"
            />
          </div>

          {/* 7. Jumlah * */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jumlah <span className="text-[#E11D48]">*</span>
            </label>
            <div className="flex border border-slate-205 rounded-xl overflow-hidden bg-white shadow-3xs focus-within:border-[#0088E8] transition-all">
              <span className="px-4 py-2.5 bg-slate-50 text-slate-500 font-bold border-r border-slate-205 select-none text-xs flex items-center justify-center">
                IDR
              </span>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-3.5 py-2.5 outline-none text-xs font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* 8. No. Dokumen */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              No. Dokumen
            </label>
            <input
              type="text"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              placeholder=""
              className="w-full px-3.5 py-2.5 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs font-semibold text-slate-800"
            />
          </div>

        </div>

        {/* Modal Tambah departement (Screenshot 2: Modal) */}
        {isAddDeptModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[440px] overflow-hidden text-xs font-semibold text-slate-700 animate-scale-up">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150">
                <h4 className="text-sm font-bold text-slate-800">Tambah departement</h4>
                <button
                  type="button"
                  onClick={() => setIsAddDeptModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Departemen
                  </label>
                  <input
                    type="text"
                    value={newDeptInput}
                    onChange={(e) => setNewDeptInput(e.target.value)}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs font-semibold text-slate-800"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddDeptModalOpen(false)}
                    className="px-4 py-1.5 border border-slate-200 bg-[#F4F5F7] hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNewDepartment}
                    className="px-5 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
                  >
                    Simpan
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN LIST VIEW
  // ==========================================
  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Main Container Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
        
        {/* Top Control Bar: Tab Toggle + Dropdown Filter on Left, Import/Export & +Tambah on Right */}
        <div className="flex flex-wrap items-center justify-between gap-4 select-none">
          
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Asset Tab Controls Box */}
            <div className="flex flex-col gap-1.5">
              <div className="flex border border-slate-205 rounded-xl overflow-hidden bg-white shadow-3xs p-0.5">
                <button
                  type="button"
                  onClick={() => setAssetTab('semua')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    assetTab === 'semua'
                      ? 'bg-[#0088E8] text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Semua Asset
                </button>
                <button
                  type="button"
                  onClick={() => setAssetTab('per-tanggal')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    assetTab === 'per-tanggal'
                      ? 'bg-[#0088E8] text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Asset Per-tanggal
                </button>
              </div>

              {/* Conditional Date Filter Pill (Shown ONLY when Asset Per-tanggal is selected) */}
              {assetTab === 'per-tanggal' && (
                <button
                  type="button"
                  onClick={() => setIsDateModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-600 rounded-lg text-[11px] font-bold cursor-pointer transition-colors w-fit shadow-3xs"
                >
                  <Filter size={11} className="text-slate-500" />
                  <span>{displayDateText}</span>
                </button>
              )}
            </div>

            {/* Filter Dropdown Selector (Tanpa Filter, No. Transaksi, Deskripsi, Status, Penyusutan Terakhir) */}
            <div className="relative" ref={filterTypeRef}>
              <button
                type="button"
                onClick={() => setIsFilterTypeOpen(!isFilterTypeOpen)}
                className="flex items-center justify-between gap-3 px-4 py-2.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer min-w-44 text-left"
              >
                <span>{filterType}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              
              {isFilterTypeOpen && (
                <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 w-52 font-bold animate-fade-in">
                  {filterOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setFilterType(opt);
                        setIsFilterTypeOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                        filterType === opt ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Action Buttons on Right */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddAsset}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-3xs font-bold text-xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet size={13} className="text-slate-500" />
              <span>Import & Export</span>
            </button>

            <button
              type="button"
              onClick={openAddForm}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#51a351] hover:bg-[#419241] text-white rounded-xl shadow-2xs font-extrabold text-xs cursor-pointer transition-colors"
            >
              <Plus size={14} />
              <span>Tambah</span>
            </button>
          </div>

        </div>

        {/* Table Grid */}
        <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-3xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-4 py-3.5 w-[4%] text-center">
                  <input type="checkbox" className="rounded border-slate-300 text-[#0088E8] focus:ring-0 cursor-pointer" />
                </th>
                <th className="px-4 py-3.5 w-[14%]">Tanggal Beli</th>
                <th className="px-4 py-3.5 w-[16%]">Aset</th>
                <th className="px-4 py-3.5 w-[20%]">Deskripsi</th>
                <th className="px-4 py-3.5 w-[12%] text-right">Nilai Awal</th>
                <th className="px-4 py-3.5 w-[12%] text-right">Nilai Residu</th>
                <th className="px-4 py-3.5 w-[10%] text-right">Sisa</th>
                <th className="px-4 py-3.5 w-[14%] text-center">Penyusutan Terakhir</th>
                <th className="px-4 py-3.5 w-[8%] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400 font-semibold select-none">
                    No Data
                  </td>
                </tr>
              ) : (
                assets.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-center">
                      <input type="checkbox" className="rounded border-slate-300 text-[#0088E8] focus:ring-0 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium">{item.buyDate}</td>
                    <td className="px-4 py-3.5 text-slate-800 font-bold">{item.name}</td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium">{item.description}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      IDR {item.initialValue.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-700">
                      IDR {item.residualValue.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      IDR {item.remainingValue.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-center text-slate-600 font-medium">
                      {item.lastDepreciationDate}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button type="button" className="text-[#0088E8] font-bold text-xs hover:underline cursor-pointer">
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: Items Limit on Left, Pagination Info on Right */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-500 select-none">
          
          {/* Items Limit Dropdown */}
          <div className="relative" ref={pageSizeRef}>
            <button
              type="button"
              onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-3xs cursor-pointer font-bold"
            >
              <span>{pageSize} item</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {isPageSizeOpen && (
              <div className="absolute left-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 w-28 text-left animate-fade-in font-bold">
                {[15, 25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setIsPageSizeOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                  >
                    {size} item
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-5">
            <span>Total {assets.length}</span>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-350 cursor-not-allowed"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white font-bold">
                1
              </span>
              <button
                type="button"
                disabled
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-350 cursor-not-allowed"
              >
                <ChevronRight size={12} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-9 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none select-none font-bold"
              />
            </div>
          </div>

        </div>

      </div>

      {/* Date Filter Modal */}
      {isDateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[440px] overflow-hidden text-xs font-semibold text-slate-700 animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150">
              <h4 className="text-sm font-bold text-slate-800">Filter</h4>
              <button
                type="button"
                onClick={() => setIsDateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              
              {/* Quick Range Options List */}
              <div className="flex flex-col items-center gap-2.5 py-1 text-xs font-bold border-b border-slate-100 pb-5">
                {[
                  'Hari ini',
                  'Kemarin',
                  '7 Hari yang lalu',
                  '30 Hari yang lalu',
                  'Bulan ini',
                  'Bulan lalu',
                  'Sesuaikan'
                ].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelectQuickRange(opt)}
                    className={`hover:text-[#0088E8] transition-colors cursor-pointer ${
                      selectedRangeOption === opt ? 'text-[#0088E8] font-extrabold' : 'text-slate-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs (Dari & Sampai) */}
              <div className="grid grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Dari
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-205 rounded-xl px-3 py-2 shadow-3xs focus-within:border-[#0088E8] transition-all">
                    <Calendar size={13} className="text-slate-400 mr-2 shrink-0" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Sampai
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-205 rounded-xl px-3 py-2 shadow-3xs focus-within:border-[#0088E8] transition-all">
                    <Calendar size={13} className="text-slate-400 mr-2 shrink-0" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
                    />
                  </div>
                </div>

              </div>

              {/* Action Buttons: Reset & Terapkan */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleResetDateFilter}
                  className="w-full py-2.5 bg-[#F87171] hover:bg-[#EF4444] text-white font-bold rounded-xl shadow-2xs cursor-pointer text-center text-xs transition-colors"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleApplyDateFilter}
                  className="w-full py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-xl shadow-2xs cursor-pointer text-center text-xs transition-colors"
                >
                  Terapkan
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
