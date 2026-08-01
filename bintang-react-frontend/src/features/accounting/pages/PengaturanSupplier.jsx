import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { notify, notifyApiError } from '../../../utils/notify';
import EditSupplierModal from '../components/settings/EditSupplierModal';

export default function PengaturanSupplier() {
  const [suppliers, setSuppliers] = useState([]);
  const [payableAccounts, setPayableAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Items limit size dropdown
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editPayableAccount, setEditPayableAccount] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [supplierRows, accountRows] = await Promise.all([
        fetchAllPages('/suppliers/'),
        apiClient.get('/accounting/accounts/').then((res) => res.data),
      ]);
      setSuppliers(
        supplierRows.map((s) => ({
          id: s.id,
          name: s.nama,
          payableAccount: s.akun_hutang ?? '',
          payableAccountLabel: s.akun_hutang_display || '',
          dueDate: s.jatuh_tempo_hari ?? '',
        }))
      );
      setPayableAccounts(
        (accountRows || [])
          .filter((a) => a.account_type === 'liability')
          .map((a) => ({ id: a.id, label: `${a.code} - ${a.name}` }))
      );
    } catch (error) {
      setSuppliers([]);
      notify({ type: 'error', title: 'Gagal Memuat Supplier', message: 'Data supplier tidak dapat dimuat dari server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setEditDueDate(supplier.dueDate ?? '');
    setEditPayableAccount(supplier.payableAccount ?? '');
    setIsModalOpen(true);
  };

  const handleSaveUpdate = async () => {
    if (!editingSupplier) return;
    setSaving(true);
    try {
      const res = await apiClient.patch(`/suppliers/${editingSupplier.id}/`, {
        akun_hutang: editPayableAccount || null,
        jatuh_tempo_hari: editDueDate === '' ? null : Number(editDueDate),
      });

      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === editingSupplier.id
            ? {
                ...s,
                dueDate: res.data.jatuh_tempo_hari ?? '',
                payableAccount: res.data.akun_hutang ?? '',
                payableAccountLabel: res.data.akun_hutang_display || '',
              }
            : s
        )
      );

      notify({
        type: 'success',
        title: 'Supplier Diperbarui',
        message: `Pengaturan supplier ${editingSupplier.name} berhasil diperbarui.`
      });

      setIsModalOpen(false);
      setEditingSupplier(null);
    } catch (error) {
      notifyApiError(error, 'Pengaturan supplier tidak dapat disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">

      {/* Main Single Card Panel */}
      <div className="bg-white rounded-2xl shadow-xs p-6 space-y-6">

        {/* Header inside Card: Title on Left, Items per Page on Right */}
        <div className="flex items-center justify-between select-none border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-800 tracking-wide">
            Pengaturan Supplier
          </h3>

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
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 w-28 text-left animate-fade-in font-bold">
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
        </div>

        {/* Table grid */}
        <div className="rounded-xl overflow-hidden bg-white shadow-3xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-6 py-4 w-[35%]">Nama Supplier</th>
                <th className="px-6 py-4 w-[30%]">Akun Hutang</th>
                <th className="px-6 py-4 w-[25%]">Jatuh Tempo</th>
                <th className="px-6 py-4 w-[10%] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" size={22} /></td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-semibold select-none">No Data</td></tr>
              ) : suppliers.slice(0, pageSize).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-slate-700 font-semibold">{s.name}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {s.payableAccountLabel || '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {s.dueDate !== '' ? `${s.dueDate} Hari` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(s)}
                      className="text-[#0088E8] hover:text-[#0066BB] font-bold text-xs cursor-pointer transition-colors"
                    >
                      Ubah
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="pt-2 flex items-center justify-end gap-5 text-xs font-semibold text-slate-500 select-none">
          <span>Total {suppliers.length}</span>

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

      {/* Ubah Supplier Modal (Screenshot 2) */}
      {isModalOpen && (
        <EditSupplierModal
          supplier={editingSupplier}
          dueDate={editDueDate}
          onDueDateChange={setEditDueDate}
          payableAccount={editPayableAccount}
          onPayableAccountChange={setEditPayableAccount}
          payableAccounts={payableAccounts}
          saving={saving}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveUpdate}
        />
      )}

    </div>
  );
}
