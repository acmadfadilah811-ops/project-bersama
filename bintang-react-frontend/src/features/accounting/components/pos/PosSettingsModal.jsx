import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { notify } from '../../../../utils/notify';
import PosLogModal from './PosLogModal';

export default function PosSettingsModal({ isOpen, onClose }) {
  // Toggle states
  const [autoPost, setAutoPost] = useState(false);
  const [postDiscount, setPostDiscount] = useState(true);

  // Settings Logs State
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [settingLogs, setSettingLogs] = useState([
    { user: 'owner_brendy@gmail.com', action: 'ENABLE', timestamp: '26 Jul 2026 09:56:28' },
    { user: 'owner_brendy@gmail.com', action: 'DISABLE', timestamp: '26 Jul 2026 09:56:25' }
  ]);

  const appendLog = (actionMsg) => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setSettingLogs((prev) => [
      { user: 'owner_brendy@gmail.com', action: actionMsg, timestamp: timeStr },
      ...prev
    ]);
  };

  const handleToggleAutoPost = () => {
    const next = !autoPost;
    setAutoPost(next);
    appendLog(next ? 'ENABLE' : 'DISABLE');
  };

  const handleTogglePostDiscount = () => {
    const next = !postDiscount;
    setPostDiscount(next);
  };

  // Default Account Dropdown selections
  const [adminFee, setAdminFee] = useState('');
  const [depositIncomeDiff, setDepositIncomeDiff] = useState('');
  const [depositExpenseDiff, setDepositExpenseDiff] = useState('');
  const [purchaseTax, setPurchaseTax] = useState('');
  const [salesTaxMinus, setSalesTaxMinus] = useState('');
  const [salesTax, setSalesTax] = useState('');
  const [salesDelivery, setSalesDelivery] = useState('');
  const [salesRounding, setSalesRounding] = useState('');
  const [salesUniquePay, setSalesUniquePay] = useState('');

  if (!isOpen) return null;

  // Account dropdown lists definition
  const adminFeeOptions = [
    '40000 Penjualan',
    '41000 Penjualan antar cabang',
    '42000 Layanan biaya penjualan',
    '44000 Pengiriman penjualan',
    '46100 Potongan penjualan',
    '46200 Loyalitas penjualan',
    '46300 Return penjualan',
    '60100 Biaya gaji',
    '60200 Biaya air listrik telephone',
    '60300 Biaya perlengkapan',
    '60400 Biaya penyusutan',
    '60500 Biaya transfer',
    '80000 Pengeluaran lain lain',
    '81000 Penyesuaian Barang'
  ];

  const depositIncomeOptions = [
    '70000 Pendapatan lain lain',
    '70001 Pembulatan',
    '70002 Code Uniq Penjualan',
    '70003 Layanan Penjualan',
    '70009 Bank Example'
  ];

  const purchaseTaxOptions = [
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan'
  ];

  const salesTaxOptions = [
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
    '40000 Penjualan',
    '41000 Penjualan antar cabang',
    '42000 Layanan biaya penjualan',
    '44000 Pengiriman penjualan',
    '46100 Potongan penjualan',
    '46200 Loyalitas penjualan',
    '46300 Return penjualan'
  ];

  const salesRoundingOptions = [
    '40000 Penjualan',
    '41000 Penjualan antar cabang',
    '42000 Layanan biaya penjualan',
    '44000 Pengiriman penjualan',
    '46100 Potongan penjualan',
    '46200 Loyalitas penjualan',
    '46300 Return penjualan',
    '70000 Pendapatan lain lain',
    '70001 Pembulatan',
    '70002 Code Uniq Penjualan',
    '70003 Layanan Penjualan',
    '70009 Bank Example'
  ];

  // Full accounts list from 11101 to 81000
  const fullAccountsOptions = [
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

  const handleApplyDefaults = () => {
    // Fill required and standard defaults
    setAdminFee('42000 Layanan biaya penjualan');
    setDepositIncomeDiff('70001 Pembulatan');
    setDepositExpenseDiff('80000 Pengeluaran lain lain');
    setPurchaseTax('11750 PPN Masukan');
    setSalesTaxMinus('11750 PPN Masukan');
    setSalesTax('23500 PPN Keluaran');
    setSalesDelivery('44000 Pengiriman penjualan');
    setSalesRounding('70001 Pembulatan');
    setSalesUniquePay('70002 Code Uniq Penjualan');

    appendLog('Menerapkan default pemetaan akun POS');

    notify({
      type: 'success',
      title: 'Default Diterapkan',
      message: 'Nilai default untuk pengaturan akun pembukuan POS berhasil diisi.'
    });
  };

  const handleSave = () => {
    if (!salesDelivery || !salesRounding || !salesUniquePay) {
      notify({
        type: 'warning',
        title: 'Pengaturan Tidak Lengkap',
        message: 'Kolom dengan tanda * wajib diisi sebelum menyimpan.'
      });
      return;
    }

    appendLog('Menyimpan konfigurasi default akun POS');

    notify({
      type: 'success',
      title: 'Pengaturan Disimpan',
      message: 'Pengaturan pemetaan akun POS berhasil diperbarui.'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Drawer Layout matching OLSERA UI */}
      <div className="bg-white border-l border-slate-200 w-[560px] h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/20">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan POS</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          
          {/* Post Otomatis switch */}
          <div className="space-y-3.5 border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Memposting Otomatis Transaksi (POS) (POS & Marketplace)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold">
                  {autoPost ? 'Aktifkan' : 'Non-aktifkan'}
                </span>
                <button
                  type="button"
                  onClick={handleToggleAutoPost}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer ${
                    autoPost ? 'bg-[#0088E8]' : 'bg-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-all transform ${
                    autoPost ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsLogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 border border-slate-205 text-slate-500 hover:bg-slate-50 rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-2xs ml-2"
                >
                  <FileText size={11} className="text-slate-400" />
                  <span>Log</span>
                </button>
              </div>
            </div>

            {/* Bullet points: Removed POS App Update description */}
            <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100 space-y-1.5 text-[10px] text-slate-500 font-bold leading-relaxed">
              <div className="flex gap-1.5 items-start">
                <span className="text-slate-400">•</span>
                <span>Cara pembayaran yang belum di mapping otomatis akan di mapping ke akun default.</span>
              </div>
              <div className="flex gap-1.5 items-start">
                <span className="text-slate-400">•</span>
                <span>Aksi batal posting tidak akan dilakukan pemostingan kembali.</span>
              </div>
              <div className="flex gap-1.5 items-start">
                <span className="text-slate-400">•</span>
                <span>Diubah oleh : owner_brendy@gmail.com (26 Jul 2026 10:43:20)</span>
              </div>
            </div>
          </div>

          {/* Posting dengan Baris Diskon Switch */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <span className="font-bold text-slate-800">Posting dengan baris diskon</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold">
                {postDiscount ? 'Aktif' : 'Non-aktif'}
              </span>
              <button
                type="button"
                onClick={handleTogglePostDiscount}
                className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer ${
                  postDiscount ? 'bg-[#0088E8]' : 'bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-all transform ${
                  postDiscount ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          <PosLogModal
            isOpen={isLogOpen}
            onClose={() => setIsLogOpen(false)}
            title="Log aksi memposting otomatis"
            type="settings"
            logs={settingLogs}
          />

          {/* Pengaturan Akun Default section */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              Pengaturan Akun Default
            </h4>

            {/* Admin Fee Marketplace */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Admin Fee Market Place</label>
              <select
                value={adminFee}
                onChange={(e) => setAdminFee(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {adminFeeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Pendapatan dari selisih deposit */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Pendapatan dari selisih deposit</label>
              <select
                value={depositIncomeDiff}
                onChange={(e) => setDepositIncomeDiff(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {depositIncomeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Pengeluaran dari selisih deposit */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Pengeluaran dari selisih deposit</label>
              <select
                value={depositExpenseDiff}
                onChange={(e) => setDepositExpenseDiff(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {fullAccountsOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Pajak Pembelian */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Pajak Pembelian</label>
              <select
                value={purchaseTax}
                onChange={(e) => setPurchaseTax(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {purchaseTaxOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Total penjualan minus */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Total penjualan minus</label>
              <select
                value={salesTaxMinus}
                onChange={(e) => setSalesTaxMinus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {fullAccountsOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Pajak Penjualan */}
            <div className="space-y-1.5">
              <label className="text-slate-600 font-bold">Pajak Penjualan</label>
              <select
                value={salesTax}
                onChange={(e) => setSalesTax(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {salesTaxOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Pengiriman Penjualan (Required *) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-600 font-bold">Pengiriman Penjualan</label>
                <span className="text-rose-500 text-[10px] font-bold">* Harus diisi</span>
              </div>
              <select
                value={salesDelivery}
                onChange={(e) => setSalesDelivery(e.target.value)}
                className="w-full px-3 py-2 border border-rose-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {fullAccountsOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Pembulatan Penjualan (Required *) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-600 font-bold">Pembulatan penjualan</label>
                <span className="text-rose-500 text-[10px] font-bold">* Harus diisi</span>
              </div>
              <select
                value={salesRounding}
                onChange={(e) => setSalesRounding(e.target.value)}
                className="w-full px-3 py-2 border border-rose-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {salesRoundingOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Pembayaran Unik Penjualan (Required *) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-600 font-bold">Pembayaran unik penjualan</label>
                <span className="text-rose-500 text-[10px] font-bold">* Harus diisi</span>
              </div>
              <select
                value={salesUniquePay}
                onChange={(e) => setSalesUniquePay(e.target.value)}
                className="w-full px-3 py-2 border border-rose-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
              >
                <option value="">Pilih</option>
                {salesRoundingOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleApplyDefaults}
            className="px-5 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
          >
            Terapkan Default
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-200 bg-white text-slate-655 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            >
              Simpan
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
