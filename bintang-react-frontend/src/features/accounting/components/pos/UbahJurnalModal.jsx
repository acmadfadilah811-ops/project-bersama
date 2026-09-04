import { useState } from 'react';
import { notify } from '../../../../utils/notify';

export default function UbahJurnalModal({ isOpen, onClose, initialData = {}, onUpdate }) {
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

  const clientsList = ['BAYU', 'AGUS', 'KEVIN', 'Budi Santoso', 'Siti Aminah', 'PT Maju Bersama', 'CV Karya Indah'];

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

  const [journalName, setJournalName] = useState(initialData.journalName || 'Penjualan');
  const [txDate, setTxDate] = useState('2026-07-24');
  const [client, setClient] = useState(initialData.client || 'BAYU');
  const [debitAcc, setDebitAcc] = useState('11300 Piutang dagang');
  const [creditAcc, setCreditAcc] = useState('40000 Penjualan');
  const [dueDate, setDueDate] = useState('2026-07-24');
  const [notes, setNotes] = useState(`Penjualan ke ${client}`);
  const [amount, setAmount] = useState(initialData.amount ? initialData.amount.toLocaleString('id-ID', { minimumFractionDigits: 2 }) : '25.000,00');
  const [docNo, setDocNo] = useState(initialData.txNo ? initialData.txNo.replace('EFC8260724', '32FB260724') : '32FB26072400000001');

  if (!isOpen) return null;

  const handleUpdateClick = () => {
    if (onUpdate) {
      onUpdate({
        journalName,
        txDate,
        client,
        debitAcc,
        creditAcc,
        dueDate,
        notes,
        amount: parseFloat(amount.replace(/\./g, '').replace(',', '.')) || 0,
        docNo
      });
    }
    notify({
      type: 'success',
      title: 'Jurnal Diperbarui',
      message: 'Rincian transaksi jurnal berhasil diperbarui.'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-205 rounded-2xl shadow-2xl w-[520px] max-h-[85vh] overflow-y-auto relative animate-scale-up">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-[#F8FAFC]">
          <h4 className="text-sm font-bold text-slate-800">
            Jurnal
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-[10px] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUpdateClick}
              className="px-3.5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg font-bold text-[10px] cursor-pointer"
            >
              Perbarui
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <div className="p-6 space-y-4">
          
          {/* Nama Jurnal */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Nama Jurnal
            </label>
            <select
              value={journalName}
              onChange={(e) => setJournalName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer"
            >
              {defaultJournalNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Tanggal */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Tanggal
            </label>
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer"
            />
          </div>

          {/* Pelanggan */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Pelanggan <span className="text-[#E11D48]">*</span>
            </label>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer"
            >
              {clientsList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Akun Debit */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Akun Debit
            </label>
            <select
              value={debitAcc}
              onChange={(e) => setDebitAcc(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer"
            >
              {accountsList.map((acc) => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>

          {/* Akun Kredit */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Akun Kredit
            </label>
            <select
              value={creditAcc}
              onChange={(e) => setCreditAcc(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer"
            >
              {accountsList.map((acc) => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>

          {/* Jatuh Tempo */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jatuh Tempo
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer"
            />
          </div>

          {/* Catatan */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Catatan
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs resize-y"
            />
          </div>

          {/* Jumlah IDR */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jumlah
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

          {/* No. Dokumen */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              No. Dokumen
            </label>
            <input
              type="text"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs"
            />
          </div>

        </div>

      </div>
    </div>
  );
}
