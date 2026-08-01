import { useState, useRef, useEffect } from 'react';
import { Trash2, ChevronDown, Plus, HelpCircle, X, ChevronUp, FileText, Calendar } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { notify } from '../../../utils/notify';
import { fetchAllPages } from '../../../utils/paginatedApi';
import apiClient from '../../../api/apiClient';

const parseAmount = (value) => Number(String(value || '').replace(/\./g, '').replace(',', '.')) || 0;

export default function JurnalTunggal() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Journal names list (initial defaults + custom items)
  const defaultNames = [
    'Akumulasi penyusutan',
    'Biaya',
    'Pembelian',
    'Penjualan',
    'Modal',
    'Hutang',
    'Piutang',
    'Pengembalian'
  ];
  const [journalNames, setJournalNames] = useState(defaultNames);
  const [selectedJournalName, setSelectedJournalName] = useState('');
  const [isJournalDropdownOpen, setIsJournalDropdownOpen] = useState(false);
  const [showInlineAddJournal, setShowInlineAddJournal] = useState(false);
  const [newJournalNameInput, setNewJournalNameInput] = useState('');
  const journalDropdownRef = useRef(null);

  // Left form states
  const isHutang = searchParams.get('active') === 'payable';
  const [txDate, setTxDate] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [debitAcc, setDebitAcc] = useState('');
  const [creditAcc, setCreditAcc] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [docNo, setDocNo] = useState('');

  // Right drafts list state
  const [drafts, setDrafts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Client suggestions data
  const clientsList = isHutang
    ? ['Supplier A', 'Supplier B', 'Supplier C', 'PT Sinar Cemerlang', 'Dika', 'Bella']
    : ['BAYU', 'AGUS', 'KEVIN', 'Budi Santoso', 'Siti Aminah', 'PT Maju Bersama', 'CV Karya Indah'];

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
    '46350 Return Penjualan',
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
  const accountOptions = accounts.length > 0
    ? accounts.map((account) => ({ id: account.id, label: `${account.code} ${account.name}` }))
    : accountsList.map((label) => ({ id: null, label }));
  const findAccountId = (label) => accountOptions.find((account) => account.label === label)?.id;

  // Close custom select dropdown on click outside
  useEffect(() => {
    function clickOutside(e) {
      if (journalDropdownRef.current && !journalDropdownRef.current.contains(e.target)) {
        setIsJournalDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  useEffect(() => {
    let active = true;
    const loadAccounts = async () => {
      try {
        const result = await fetchAllPages('/accounting/accounts/');
        if (active) setAccounts(result);
      } catch (error) {
        if (active) {
          notify({ type: 'error', title: 'Akun Tidak Tersedia', message: 'Daftar akun gagal dimuat dari server.' });
        }
      } finally {
        if (active) setAccountsLoading(false);
      }
    };
    loadAccounts();
    return () => { active = false; };
  }, []);

  const handleAddCustomJournalName = () => {
    setShowInlineAddJournal(true);
  };

  const handleRemoveCustomJournalName = (name, e) => {
    e.stopPropagation();
    if (defaultNames.includes(name)) return; // Prevent deleting defaults
    setJournalNames((prev) => prev.filter((n) => n !== name));
    if (selectedJournalName === name) {
      setSelectedJournalName('Penjualan');
    }
    notify({ type: 'success', title: 'Nama Dihapus', message: `Nama jurnal kustom "${name}" berhasil dihapus.` });
  };

  const handleAddDraft = () => {
    // Collect left form states and push as a new draft card item on the right
    const newDraft = {
      id: Date.now(),
      journalName: selectedJournalName,
      txDate,
      client: clientSearch || (isHutang ? 'Cari Supplier' : 'Cari Pelanggan'),
      debitAcc,
      creditAcc,
      notes: notes || 'Tidak ada catatan',
      amount: amount || '0,00',
      dueDate: dueDate || '2026-07-27',
      docNo: docNo || '',
      isExpanded: true
    };

    setDrafts((prev) => [...prev, newDraft]);
    notify({
      type: 'success',
      title: 'Jurnal Ditambahkan',
      message: 'Transaksi dimasukkan ke daftar draf jurnal sebelah kanan.'
    });

    // Reset left form inputs
    setClientSearch('');
    setNotes('');
    setAmount('0,00');
    setDueDate('');
    setDocNo('');
  };

  const handleDeleteDraft = (id) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    notify({
      type: 'info',
      title: 'Draf Dihapus',
      message: 'Item draf jurnal berhasil dihapus.'
    });
  };

  const toggleDraftCollapse = (id) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isExpanded: !d.isExpanded } : d))
    );
  };

  const handleDraftChange = (id, field, val) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: val } : d))
    );
  };

  const handleSaveAll = async () => {
    if (drafts.length === 0) {
      notify({ type: 'warning', title: 'Draf Kosong', message: 'Tambahkan minimal satu draf jurnal sebelum menyimpan.' });
      return;
    }

    const postedIds = [];
    try {
      for (const draft of drafts) {
        const debitAccount = findAccountId(draft.debitAcc);
        const kreditAccount = findAccountId(draft.creditAcc);
        const numericAmount = parseAmount(draft.amount);
        if (!draft.txDate || !debitAccount || !kreditAccount || debitAccount === kreditAccount || numericAmount <= 0 || !draft.notes.trim()) {
          throw new Error('Pastikan setiap draf memiliki tanggal, akun debit/kredit berbeda, catatan, dan jumlah valid.');
        }
        await apiClient.post('/accounting/journal-entries/', {
          date: draft.txDate,
          source_type: 'manual',
          description: `${draft.notes}${draft.client ? ` — ${isHutang ? 'Supplier' : 'Pelanggan'}: ${draft.client}` : ''}`,
          external_document_no: draft.docNo || '',
          amount: numericAmount,
          debit_account: debitAccount,
          kredit_account: kreditAccount,
        });
        postedIds.push(draft.id);
      }
    } catch (error) {
      if (postedIds.length > 0) setDrafts((current) => current.filter((draft) => !postedIds.includes(draft.id)));
      notify({
        type: 'error',
        title: 'Jurnal Belum Tersimpan Semua',
        message: error.response?.data?.detail || error.message || 'Periksa kembali data draf dan coba lagi.',
      });
      return;
    }

    setDrafts([]);
    notify({ type: 'success', title: 'Jurnal Disimpan', message: `${postedIds.length} jurnal berhasil diposting ke pembukuan.` });
    setSearchParams(isHutang ? { active: 'payable', subMenu: 'hutang-semua' } : { active: 'receivable', subMenu: 'piutang-semua' });
  };

  const handleCancelAll = () => {
    if (drafts.length > 0) {
      setDrafts([]);
      notify({
        type: 'info',
        title: 'Draf Dibatalkan',
        message: 'Seluruh draf jurnal telah dibersihkan.'
      });
    } else {
      if (isHutang) {
        setSearchParams({ active: 'payable', subMenu: 'hutang-semua' });
      } else {
        setSearchParams({ active: 'receivable', subMenu: 'piutang-semua' });
      }
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-fade-in text-xs font-semibold text-slate-700 w-full flex flex-col h-[calc(100vh-140px)] min-h-[750px]">
      
      {/* Header Bar matching Screenshots */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#F8FAFC]">
        <div className="flex items-center gap-1.5 text-slate-400 font-bold">
          <span className="text-[#E11D48]">*</span>
          <span>Harus diisi</span>
        </div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Jurnal</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancelAll}
            className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
          >
            {drafts.length > 0 ? 'Batal' : 'Tutup'}
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-4 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
          >
            Simpan
          </button>
        </div>
      </div>

      {/* Main Content Area Split Screen */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        
        {/* Left Column: Form Jurnal Tunggal (Sticky footer, scrollable content, takes 43% space) */}
        <div className="w-[43%] border-r border-slate-100 flex flex-col relative bg-slate-50/20">
          <div className="flex-1 overflow-y-auto p-5 pb-20 space-y-4">
            
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
                    className="w-full flex items-center justify-between px-3 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg shadow-3xs cursor-pointer text-left font-mono"
                  >
                    <span>{selectedJournalName || <span className="text-slate-400 font-sans font-semibold">Pilih Nama Jurnal</span>}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                {isJournalDropdownOpen && (
                  <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50 w-full font-bold max-h-56 overflow-y-auto">
                    {journalNames.map((name) => {
                      const isCustom = !defaultNames.includes(name);
                      return (
                        <div
                          key={name}
                          onClick={() => {
                            setSelectedJournalName(name);
                            setIsJournalDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between px-3.5 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                            selectedJournalName === name ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-700'
                          }`}
                        >
                          <span>{name}</span>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={(e) => handleRemoveCustomJournalName(name, e)}
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
                disabled={showInlineAddJournal}
                onClick={handleAddCustomJournalName}
                className={`px-3 py-2 rounded-lg shadow-2xs font-extrabold text-[10px] whitespace-nowrap transition-colors flex items-center gap-1 ${
                  showInlineAddJournal
                    ? 'bg-slate-105 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-650 cursor-pointer'
                }`}
              >
                <Plus size={12} className={showInlineAddJournal ? 'text-slate-450' : 'text-slate-500'} />
                <span>Tambah Nama</span>
              </button>
            </div>

            {/* Inline New Journal Name input field below the row */}
            {showInlineAddJournal && (
              <div className="pt-3.5 space-y-2 border-t border-slate-100/50 mt-2 animate-fade-in text-xs font-semibold text-slate-700">
                <label className="text-[10px] text-slate-500 font-bold">
                  Nama Jurnal Baru
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Jurnal"
                    value={newJournalNameInput}
                    onChange={(e) => setNewJournalNameInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-205 rounded-md bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs font-semibold"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineAddJournal(false);
                        setNewJournalNameInput('');
                      }}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-bold text-[10px] cursor-pointer transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newJournalNameInput.trim();
                        if (!trimmed) return;
                        if (journalNames.includes(trimmed)) {
                          notify({ type: 'warning', title: 'Nama Eksis', message: 'Nama jurnal kustom tersebut sudah ada.' });
                          return;
                        }
                        setJournalNames((prev) => [...prev, trimmed]);
                        setSelectedJournalName(trimmed);
                        setShowInlineAddJournal(false);
                        setNewJournalNameInput('');
                        notify({ type: 'success', title: 'Nama Ditambahkan', message: `Jurnal "${trimmed}" berhasil ditambahkan.` });
                      }}
                      className="px-3.5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg shadow-2xs font-bold text-[10px] cursor-pointer transition-colors"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
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
                type={txDate ? "date" : "text"}
                placeholder="Pilih hari"
                onFocus={(e) => e.target.type = 'date'}
                onBlur={(e) => { if (!txDate) e.target.type = 'text'; }}
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
              />
            </div>
          </div>

          {/* Pelanggan / Supplier */}
          <div className="space-y-1 relative">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {isHutang ? 'Supplier' : 'Pelanggan'} <span className="text-[#E11D48]">*</span>
            </label>
            <input
              type="text"
              placeholder={isHutang ? 'Cari Supplier' : 'Cari Pelanggan'}
              value={clientSearch}
              onFocus={() => setShowClientSuggestions(true)}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs"
            />
            {showClientSuggestions && (
              <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50 w-full font-bold max-h-44 overflow-y-auto">
                {clientsList
                  .filter((c) => c.toLowerCase().includes(clientSearch.toLowerCase()))
                  .map((clientName) => (
                    <button
                      key={clientName}
                      type="button"
                      onClick={() => {
                        setClientSearch(clientName);
                        setShowClientSuggestions(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
                    >
                      {clientName}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Akun Debit */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Akun Debit <span className="text-[#E11D48]">*</span>
            </label>
            <select
              value={debitAcc}
              onChange={(e) => setDebitAcc(e.target.value)}
              disabled={accountsLoading}
              className={`w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer ${
                debitAcc ? 'text-slate-700 font-bold' : 'text-slate-400 font-semibold'
              }`}
            >
              <option value="" disabled hidden>Pilih Akun Debit</option>
              {accountOptions.map((account) => (
                <option key={account.label} value={account.label}>{account.label}</option>
              ))}
            </select>
          </div>

          {/* Akun Kredit */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Akun Kredit <span className="text-[#E11D48]">*</span>
            </label>
            <select
              value={creditAcc}
              onChange={(e) => setCreditAcc(e.target.value)}
              disabled={accountsLoading}
              className={`w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer ${
                creditAcc ? 'text-slate-700 font-bold' : 'text-slate-400 font-semibold'
              }`}
            >
              <option value="" disabled hidden>Pilih Akun Kredit</option>
              {accountOptions.map((account) => (
                <option key={account.label} value={account.label}>{account.label}</option>
              ))}
            </select>
          </div>

          {/* Catatan */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Catatan <span className="text-[#E11D48]">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan di sini..."
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs resize-y"
            />
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-3 py-2 outline-none text-xs font-semibold"
              />
            </div>
          </div>

          {/* Jatuh Tempo */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jatuh Tempo
            </label>
            <div className="relative flex items-center bg-white border border-slate-205 rounded-lg px-3 py-2 shadow-3xs focus-within:border-[#0088E8] transition-all cursor-pointer">
              <Calendar size={13} className="text-slate-400 mr-2 shrink-0" />
              <input
                type={dueDate ? "date" : "text"}
                placeholder="Pilih hari"
                onFocus={(e) => e.target.type = 'date'}
                onBlur={(e) => { if (!dueDate) e.target.type = 'text'; }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs font-semibold text-slate-700 outline-none bg-transparent cursor-pointer"
              />
            </div>
          </div>

          {/* No. Dokumen */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              No. Dokumen
            </label>
            <input
              type="text"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              placeholder="Masukkan nomor dokumen (opsional)"
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs"
            />
          </div>

        </div>

        {/* Sticky footer for + Tambah Lainnya button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white/95 backdrop-blur-xs z-10 flex items-center justify-center">
          <button
            type="button"
            onClick={handleAddDraft}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 font-extrabold rounded-lg border border-slate-205 transition-colors cursor-pointer text-center text-xs flex items-center justify-center gap-1 shadow-3xs"
          >
            <Plus size={14} />
            <span>Tambah Lainnya</span>
          </button>
        </div>
      </div>

        {/* Right Column: Draf Jurnal (Scrollable, takes 57% space) */}
        <div className="w-[57%] p-5 overflow-y-auto space-y-4 bg-slate-50/10">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-800">Draf Jurnal</h4>
            <button
              type="button"
              disabled={drafts.length === 0}
              onClick={() => window.print()}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 border text-[10px] uppercase tracking-wide ${
                drafts.length > 0
                  ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer shadow-3xs'
                  : 'bg-slate-50 border-slate-200 text-slate-350 cursor-not-allowed'
              }`}
            >
              <FileText size={12} />
              <span>Cetak jurnal ({drafts.length})</span>
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="py-24 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
              <FileText size={28} className="mx-auto text-slate-300" />
              <p className="font-bold">Belum Ada Draf Jurnal</p>
              <p className="text-[10px] text-slate-400 font-medium">
                Isi form di sebelah kiri dan klik "+ Tambah Lainnya" untuk menyusun draf jurnal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft, idx) => (
                <div key={draft.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs animate-scale-up bg-white">
                  
                  {/* Draft Header Summary matching Screenshot 2 */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50/70 border-b border-slate-100">
                    <div className="space-y-1 min-w-0 pr-4">
                      <div className="font-bold text-slate-800 text-[11px] leading-tight break-words">
                        {draft.journalName} - {draft.debitAcc.split(' ')[0]} Piutang dagang & {draft.creditAcc.split(' ')[0]} Penjualan ({draft.txDate})
                      </div>
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        IDR {draft.amount}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="p-1.5 border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer shadow-3xs"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDraftCollapse(draft.id)}
                        className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg transition-colors cursor-pointer shadow-3xs"
                      >
                        {draft.isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded draft detailed form fields matching Screenshot 2 */}
                  {draft.isExpanded && (
                    <div className="p-4 bg-white grid grid-cols-2 gap-x-4 gap-y-3">
                      
                      {/* Nama Jurnal */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          Nama Jurnal <span className="text-[#E11D48]">*</span>
                        </label>
                        <select
                          value={draft.journalName}
                          onChange={(e) => handleDraftChange(draft.id, 'journalName', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold cursor-pointer outline-none focus:border-[#0088E8]"
                        >
                          {journalNames.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Tanggal */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          Tanggal <span className="text-[#E11D48]">*</span>
                        </label>
                        <input
                          type="date"
                          value={draft.txDate}
                          onChange={(e) => handleDraftChange(draft.id, 'txDate', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#0088E8]"
                        />
                      </div>

                      {/* Akun Debit */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          Akun Debit <span className="text-[#E11D48]">*</span>
                        </label>
                        <select
                          value={draft.debitAcc}
                          onChange={(e) => handleDraftChange(draft.id, 'debitAcc', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold cursor-pointer outline-none focus:border-[#0088E8]"
                        >
                          {accountOptions.map((account) => (
                            <option key={account.label} value={account.label}>{account.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Akun Kredit */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          Akun Kredit <span className="text-[#E11D48]">*</span>
                        </label>
                        <select
                          value={draft.creditAcc}
                          onChange={(e) => handleDraftChange(draft.id, 'creditAcc', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold cursor-pointer outline-none focus:border-[#0088E8]"
                        >
                          {accountOptions.map((account) => (
                            <option key={account.label} value={account.label}>{account.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Pelanggan / Supplier */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          {isHutang ? 'Supplier' : 'Pelanggan'} <span className="text-[#E11D48]">*</span>
                        </label>
                        <input
                          type="text"
                          value={draft.client}
                          onChange={(e) => handleDraftChange(draft.id, 'client', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#0088E8]"
                        />
                      </div>

                      {/* Jumlah */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          Jumlah <span className="text-[#E11D48]">*</span>
                        </label>
                        <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white">
                          <span className="px-2 py-1.5 bg-slate-50 text-slate-500 font-bold border-r border-slate-200 select-none">
                            IDR
                          </span>
                          <input
                            type="text"
                            value={draft.amount}
                            onChange={(e) => handleDraftChange(draft.id, 'amount', e.target.value)}
                            className="flex-1 px-2 py-1.5 outline-none text-xs font-semibold"
                          />
                        </div>
                      </div>

                      {/* Jatuh Tempo */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          Jatuh Tempo
                        </label>
                        <input
                          type="date"
                          value={draft.dueDate}
                          onChange={(e) => handleDraftChange(draft.id, 'dueDate', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#0088E8]"
                        />
                      </div>

                      {/* Catatan */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          Catatan <span className="text-[#E11D48]">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={draft.notes}
                          onChange={(e) => handleDraftChange(draft.id, 'notes', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#0088E8] resize-y"
                        />
                      </div>

                      {/* No. Dokumen */}
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                          No. Dokumen
                        </label>
                        <input
                          type="text"
                          value={draft.docNo}
                          onChange={(e) => handleDraftChange(draft.id, 'docNo', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#0088E8]"
                        />
                      </div>

                    </div>
                  )}

                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
