import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1.5 md:gap-6 md:items-start">
      <label className="text-sm text-slate-500 md:pt-2.5">{label}</label>
      <div>{children}</div>
    </div>
  );
}

export default function ReturnOrderForm({ onCancel, onSave }) {
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [customer, setCustomer] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [tanggal, setTanggal] = useState('');
  const [mataUang, setMataUang] = useState('Rupiah');
  const [catatan, setCatatan] = useState('');

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await apiClient.get('/orders/', { params: { page: 1, page_size: 1000 } });
        // Filter only completed orders
        const completed = (res.data || []).filter((o) => o.status_global === 'selesai');
        setCompletedOrders(completed);
      } catch (err) {
        console.error('Gagal memuat pesanan selesai:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter completed orders based on input value
  const filteredOrders = completedOrders.filter(
    (o) =>
      String(o.id).toLowerCase().includes(orderNo.toLowerCase()) ||
      o.nama?.toLowerCase().includes(orderNo.toLowerCase())
  );

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setOrderNo(`ORD-${order.id}`);
    setCustomer(`${order.nama} (${order.email || 'sinar@cemerlang.com'})`);
    setDropdownOpen(false);
  };

  const handleSaveClick = () => {
    // Validate if selected order exists and is valid
    if (!selectedOrder) {
      alert('Pilih No. Pesanan yang valid dari daftar.');
      return;
    }
    onSave?.({
      orderId: selectedOrder.id,
      customer,
      tanggal,
      mataUang,
      catatan,
    });
  };

  const canSave = selectedOrder !== null && tanggal.trim().length > 0;

  return (
    <div className="p-6">
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <h3 className="text-slate-800 font-bold text-[15px]">Tambah Pengembalian Pesanan</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSaveClick}
              className={`text-sm font-semibold rounded-lg px-5 py-2 transition-colors ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Simpan
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Pelanggan */}
          <section>
            <h4 className="text-blue-600 font-bold text-sm mb-4">
              Pelanggan <span className="text-rose-500">*</span>
            </h4>
            <div className="space-y-4">
              <Field label="No. Pesanan">
                <div className="relative" ref={dropdownRef}>
                  <input
                    value={orderNo}
                    onChange={(e) => {
                      setOrderNo(e.target.value);
                      setSelectedOrder(null);
                      setCustomer('');
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder={loading ? 'Memuat pesanan selesai...' : 'Cari No. Pesanan'}
                    className={inputClass}
                    disabled={loading}
                  />
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  {dropdownOpen && filteredOrders.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                      {filteredOrders.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => handleSelectOrder(o)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs text-slate-700 flex justify-between items-center cursor-pointer border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <span className="font-bold text-slate-800 font-mono">ORD-{o.id}</span>
                            <span className="text-slate-400 mx-2">|</span>
                            <span className="font-semibold text-slate-600">{o.nama}</span>
                          </div>
                          {selectedOrder?.id === o.id && <Check size={14} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                  {dropdownOpen && filteredOrders.length === 0 && !loading && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-3 px-4 text-xs text-slate-400 text-center">
                      Hanya pesanan yang statusnya "Selesai" yang dapat diajukan pengembalian.
                    </div>
                  )}
                </div>
              </Field>

              <Field label="Nama atau email">
                <input
                  value={customer}
                  readOnly
                  placeholder="Terisi otomatis setelah memilih No. Pesanan"
                  className={`${inputClass} bg-slate-50/70 border-slate-200 cursor-not-allowed`}
                />
              </Field>
            </div>
          </section>

          {/* Pengembalian */}
          <section>
            <h4 className="text-blue-600 font-bold text-sm mb-4">
              Pengembalian <span className="text-rose-500">*</span>
            </h4>
            <div className="space-y-4">
              <Field label="Tanggal Pengembalian">
                <div className="relative max-w-xs">
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </Field>
              <Field label="Mata Uang Dasar">
                <select
                  value={mataUang}
                  onChange={(e) => setMataUang(e.target.value)}
                  className={`${inputClass} max-w-xs cursor-pointer`}
                >
                  <option value="Rupiah">Rupiah</option>
                  <option value="USD">USD</option>
                  <option value="SGD">SGD</option>
                </select>
              </Field>
              <Field label="Catatan">
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={3}
                  placeholder="Masukkan Catatan"
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
