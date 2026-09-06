import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import PosHeaderBar from '../components/PosHeaderBar';
import AddCustomerModal from '../../customerSupplier/components/AddCustomerModal';

/**
 * Kasir sebelumnya tidak bisa membuat akun member (Pelanggan + loyalty)
 * tanpa keluar dari Kasir ke modul Pelanggan & Supplier — yang memang
 * sengaja dikunci untuk role kasir. Layar ini membuka kemampuan tambah
 * (bukan seluruh modul admin: tanpa filter/export/catatan/ulasan) langsung
 * di Kasir, memakai komponen form yang sama dengan modul aslinya supaya
 * tidak ada logika ganda.
 *
 * Tab "Supplier" (dan kemampuan tambah supplier dari Kasir) dihapus dari
 * layar ini atas instruksi user 2026-08-13 — kelola supplier sekarang
 * hanya lewat modul Pelanggan & Supplier penuh (Owner/Manager/Admin).
 */
export default function KasirPelangganSupplier({ onToggleSidebar }) {
  const [query, setQuery] = useState('');

  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await apiClient.get('/customers/');
      setCustomers(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await apiClient.get('/customer-groups/');
      setGroups(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('Error fetching customer groups:', err);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchGroups();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => `${c.nama} ${c.handphone} ${c.email}`.toLowerCase().includes(q));
  }, [customers, query]);

  // Paginasi -- sebelumnya render SEMUA hasil pencarian tanpa halaman sama
  // sekali, pola sama dengan halaman Produk (temuan user 2026-09-06).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const pagedCustomers = useMemo(
    () => filteredCustomers.slice((page - 1) * pageSize, page * pageSize),
    [filteredCustomers, page, pageSize]
  );

  const handleCustomerSaved = () => {
    setShowAddCustomer(false);
    fetchCustomers();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden w-full select-none">
      <PosHeaderBar onToggleSidebar={onToggleSidebar} />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200">
              <div className="flex-1 px-4 py-3 text-xs font-black flex items-center justify-center gap-1.5 text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40">
                <Users size={14} /> Pelanggan &amp; Member
              </div>
            </div>

            <div className="p-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama/telepon/email pelanggan"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomer(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <Plus size={14} /> Tambah Pelanggan
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                    <th className="px-4 py-2">Nama</th>
                    <th className="px-4 py-2">Telepon</th>
                    <th className="px-4 py-2">Tipe / Member</th>
                    <th className="px-4 py-2 text-right">Loyalty Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCustomers ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400 font-semibold">Memuat...</td></tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400 font-semibold">Belum ada pelanggan.</td></tr>
                  ) : (
                    pagedCustomers.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 text-xs font-semibold text-slate-700">
                        <td className="px-4 py-2 font-bold text-slate-800">{c.nama}</td>
                        <td className="px-4 py-2 text-slate-500">{c.handphone || '-'}</td>
                        <td className="px-4 py-2">
                          {c.customer_group_nama ? (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-black">{c.customer_group_nama}</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-black">Guest</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-black text-slate-800">{c.loyalty_points ?? 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loadingCustomers && filteredCustomers.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 text-[11px] font-bold text-slate-500">
                <div className="flex items-center gap-2">
                  <span>{filteredCustomers.length} pelanggan</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer text-slate-700"
                  >
                    <option value={10}>10/hal</option>
                    <option value={20}>20/hal</option>
                    <option value={50}>50/hal</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-1 cursor-pointer text-slate-700"
                  >
                    &lt;
                  </button>
                  <span>{page} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-1 cursor-pointer text-slate-700"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddCustomer && (
        <AddCustomerModal
          groups={groups}
          onClose={() => setShowAddCustomer(false)}
          onSaved={handleCustomerSaved}
        />
      )}
    </div>
  );
}
