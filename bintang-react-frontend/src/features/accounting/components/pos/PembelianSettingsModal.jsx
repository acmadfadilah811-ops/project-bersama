import { useState } from 'react';
import { X } from 'lucide-react';
import { notify } from '../../../../utils/notify';

export default function PembelianSettingsModal({ isOpen, onClose }) {
  const [discountAccount, setDiscountAccount] = useState('11102 Bank');
  const [shippingAccount, setShippingAccount] = useState('11101 Kas');
  const [orderPaymentAccount, setOrderPaymentAccount] = useState('11750 PPN Masukan');
  const [journalDateOption, setJournalDateOption] = useState('tanggal_diterima'); // 'tanggal_diterima' | 'tanggal_beli'

  if (!isOpen) return null;

  // Option lists
  const fullAccountsList = [
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
    { value: '70002 Code Uniq Penjualan', label: '70002 Code Uniq Penjualan' },
    '70002 Code Uniq Penjualan',
    '70003 Layanan Penjualan',
    '70009 Bank Example',
    '80000 Pengeluaran lain lain',
    '81000 Penyesuaian Barang'
  ].filter((opt) => typeof opt === 'string'); // Clean up check

  const orderPaymentAccountsList = [
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan'
  ];

  const handleSave = () => {
    notify({
      type: 'success',
      title: 'Pengaturan Disimpan',
      message: 'Pengaturan akun pembukuan pembelian POS berhasil diperbarui.'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-205 shadow-2xl w-[520px] max-h-[90vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-800">Pengaturan POS Pembelian</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Akun Diskon */}
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Akun Diskon</label>
            <select
              value={discountAccount}
              onChange={(e) => setDiscountAccount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-2xs"
            >
              {fullAccountsList.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Akun Pengiriman */}
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Akun Pengiriman</label>
            <select
              value={shippingAccount}
              onChange={(e) => setShippingAccount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-2xs"
            >
              {fullAccountsList.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Akun pembayaran order pembelian */}
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Akun pembayaran order pembelian</label>
            <select
              value={orderPaymentAccount}
              onChange={(e) => setOrderPaymentAccount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-2xs"
            >
              {orderPaymentAccountsList.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Tanggal Penjurnalan Pembelian */}
          <div className="space-y-2 pt-1">
            <span className="text-slate-650 font-bold">Tanggal penjurnalan pembelian</span>
            <div className="flex items-center gap-4">
              
              {/* Tanggal Diterima */}
              <button
                type="button"
                onClick={() => setJournalDateOption('tanggal_diterima')}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg shadow-2xs font-bold transition-all cursor-pointer ${
                  journalDateOption === 'tanggal_diterima'
                    ? 'border-[#0088E8] bg-[#E6F4FF] text-[#0088E8]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                  journalDateOption === 'tanggal_diterima' ? 'border-[#0088E8]' : 'border-slate-300'
                }`}>
                  {journalDateOption === 'tanggal_diterima' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0088E8]" />
                  )}
                </div>
                <span>Tanggal Diterima</span>
              </button>

              {/* Tanggal Beli */}
              <button
                type="button"
                onClick={() => setJournalDateOption('tanggal_beli')}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg shadow-2xs font-bold transition-all cursor-pointer ${
                  journalDateOption === 'tanggal_beli'
                    ? 'border-[#0088E8] bg-[#E6F4FF] text-[#0088E8]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                  journalDateOption === 'tanggal_beli' ? 'border-[#0088E8]' : 'border-slate-300'
                }`}>
                  {journalDateOption === 'tanggal_beli' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0088E8]" />
                  )}
                </div>
                <span>Tanggal beli</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-105 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Terapkan
          </button>
        </div>

      </div>
    </div>
  );
}
