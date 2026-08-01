import { useState, useEffect } from 'react';
import { Calendar, User } from 'lucide-react';
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

  // Form order & Pelayan
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [catatan, setCatatan] = useState('');
  const [pelayanId, setPelayanId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/pos/sales/staff-list/');
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setStaffList(data);
        if (data.length > 0) {
          setPelayanId(data[0].id);
        }
      } catch {
        setStaffList([]);
      }
    })();
  }, []);

  const handleSearchCustomer = async (val) => {
    setCustomerSearch(val);
    if (!val.trim()) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await apiClient.get(`/contacts/?search=${encodeURIComponent(val)}`).catch(() => apiClient.get(`/customers/?search=${encodeURIComponent(val)}`));
      setCustomers(res.data?.results || res.data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerSearch(`${c.nama} (${c.handphone || c.no_hp || c.email || '-'})`);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.nama.trim() || (!newCustomer.handphone.trim() && !newCustomer.email.trim())) {
      return alert('Nama dan Telepon/HP/Email wajib diisi.');
    }
    try {
      const res = await apiClient.post('/contacts/', {
        nama: newCustomer.nama,
        nama_perusahaan: newCustomer.nama_perusahaan,
        email: newCustomer.email,
        no_hp: newCustomer.handphone,
        handphone: newCustomer.handphone,
        alamat: newCustomer.alamat,
        kode_pos: newCustomer.kode_pos,
        tipe: 'pelanggan'
      }).catch(() => apiClient.post('/customers/', newCustomer));
      const created = res.data;
      setSelectedCustomer(created);
      setCustomerSearch(`${created.nama} (${created.handphone || created.no_hp || created.email})`);
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
      alert(err.response?.data?.error || err.response?.data?.detail || 'Gagal mendaftarkan pelanggan.');
    }
  };

  const handleSaveOrder = async () => {
    if (!selectedCustomer) return alert('Pilih pelanggan terlebih dahulu.');
    if (!pelayanId) return alert('Pilih karyawan yang melayani (Dilayani Oleh) terlebih dahulu.');

    const rawWa = (selectedCustomer.handphone || selectedCustomer.no_hp || selectedCustomer.telepon || '081234567890').replace(/[^0-9]/g, '');
    const validWa = rawWa.length >= 8 ? rawWa : '081234567890';

    setSaving(true);
    try {
      const res = await apiClient.post('/orders/', {
        nomor_wa: validWa,
        nama: selectedCustomer.nama,
        dilayani_oleh: pelayanId,
        waktu: new Date(tanggal).toISOString(),
        catatan_pelanggan: catatan,
        metode_pembayaran: 'tunai',
        status_global: 'review',
        dp_dibayar: 0,
        diskon_persen: 0
      });

      onSave?.(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Gagal menyimpan pesanan.';
      alert(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header - Olsera Style */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Tambah Pesanan Penjualan</h3>
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
              disabled={saving}
              onClick={handleSaveOrder} 
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 cursor-pointer shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1: Pelanggan */}
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

          {/* Section 2: Detail Penjualan */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-bold text-blue-600">Detail Penjualan</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5 flex items-center gap-1">
                  <User size={13} className="text-slate-400" /> Dilayani Oleh <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pelayanId}
                  onChange={(e) => setPelayanId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 cursor-pointer"
                >
                  <option value="">— Pilih Karyawan —</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} {s.role ? `(${s.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

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

            <div className="max-w-3xl">
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Catatan</label>
              <textarea
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Masukkan Catatan Pesanan"
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
