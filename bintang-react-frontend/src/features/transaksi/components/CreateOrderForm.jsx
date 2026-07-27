import { useState } from 'react';
import { Calendar } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import CustomerSelector from './CustomerSelector';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

export default function CreateOrderForm({ onCancel, onSave }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  
  // Form customer baru
  const [newCustomer, setNewCustomer] = useState({
    nama: '',
    nama_perusahaan: '',
    email: '',
    handphone: '',
    alamat: '',
    kode_pos: ''
  });

  // Form order
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [catatan, setCatatan] = useState('');

  const handleSearchCustomer = async (val) => {
    setCustomerSearch(val);
    if (!val.trim()) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await apiClient.get(`/customers/?search=${val}`);
      setCustomers(res.data?.results || res.data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerSearch(`${c.nama} (${c.handphone || c.email})`);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.nama.trim() || !newCustomer.handphone.trim()) {
      return alert('Nama dan Telepon/HP wajib diisi.');
    }
    try {
      const res = await apiClient.post('/customers/', newCustomer);
      setSelectedCustomer(res.data);
      setCustomerSearch(`${res.data.nama} (${res.data.handphone || res.data.email})`);
      setShowDropdown(false);
      setShowAddCustomer(false);
      setNewCustomer({
        nama: '',
        nama_perusahaan: '',
        email: '',
        handphone: '',
        alamat: '',
        kode_pos: ''
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mendaftarkan pelanggan.');
    }
  };

  const handleSaveOrder = async () => {
    if (!selectedCustomer) return alert('Pilih pelanggan terlebih dahulu.');
    
    try {
      await apiClient.post('/orders/', {
        nomor_wa: selectedCustomer.handphone || '000000000000',
        nama: selectedCustomer.nama,
        waktu: new Date(tanggal).toISOString(),
        catatan_pelanggan: catatan,
        metode_pembayaran: 'tunai',
        status_global: 'review',
        dp_dibayar: 0,
        diskon_persen: 0
      });

      onSave?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan pesanan.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header - Olsera Style */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Tambah Pesanan</h3>
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={onCancel} 
              className="text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="button" 
              onClick={handleSaveOrder} 
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 cursor-pointer shadow-sm transition-all"
            >
              Simpan
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1: Pelanggan (Olsera Layout) */}
          <CustomerSelector
            customerSearch={customerSearch}
            onSearchCustomer={handleSearchCustomer}
            customers={customers}
            onSelectCustomer={handleSelectCustomer}
            showDropdown={showDropdown}
            setShowDropdown={setShowDropdown}
            showAddCustomer={showAddCustomer}
            setShowAddCustomer={setShowAddCustomer}
            newCustomer={newCustomer}
            setNewCustomer={setNewCustomer}
            onAddCustomer={handleAddCustomer}
          />

          {/* Section 2: Penjualan (Olsera Layout) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-bold text-blue-600">Penjualan</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Tanggal Beli</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar size={15} />
                  </div>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Mata Uang Penjualan</label>
                <select disabled className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-500 bg-slate-50 cursor-not-allowed">
                  <option value="IDR">Rupiah</option>
                </select>
              </div>
            </div>

            <div className="max-w-2xl">
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Catatan</label>
              <textarea
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Masukkan Catatan"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
