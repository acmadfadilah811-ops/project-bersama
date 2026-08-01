import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notifyApiError } from '../../../../utils/notify';

// Kelola CashTransactionType (master Tipe Transaksi) per arah — real CRUD ke
// /cash-transaction-types/, dipakai bersama layar Pendapatan & Pengeluaran.
export default function TipeTransaksiModal({ isOpen, onClose, direction }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/cash-transaction-types/', { params: { tipe: direction } });
      setTypes(res.data.results || res.data || []);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat tipe transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isOpen) reload(); }, [isOpen, direction]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleAdd = async () => {
    const nama = newName.trim();
    if (!nama) return;
    setSaving(true);
    try {
      await apiClient.post('/cash-transaction-types/', { nama, tipe: direction });
      setNewName('');
      await reload();
    } catch (err) {
      notifyApiError(err, 'Gagal menambahkan tipe transaksi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus tipe transaksi ini?')) return;
    try {
      await apiClient.delete(`/cash-transaction-types/${id}/`);
      await reload();
    } catch (err) {
      notifyApiError(err, 'Tipe tidak bisa dihapus (mungkin sudah dipakai transaksi).');
    }
  };

  const title = direction === 'pendapatan' ? 'Tipe Transaksi Pendapatan' : 'Tipe Transaksi Pengeluaran';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[520px] overflow-hidden animate-scale-up">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-xs font-bold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 flex items-center gap-2 border-b border-slate-100">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama tipe baru..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="px-3 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Plus size={14} /> Tambah
          </button>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          {loading ? (
            <p className="text-center text-slate-400 py-6">Memuat...</p>
          ) : types.length === 0 ? (
            <p className="text-center text-slate-400 py-6">Belum ada tipe transaksi.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <tbody>
                {types.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-700">{t.nama}</td>
                    <td className="py-2.5 text-right w-10">
                      <button type="button" onClick={() => handleDelete(t.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-slate-50 bg-slate-50/30 text-[11px] text-slate-500 font-bold">
          Total {types.length} tipe
        </div>
      </div>
    </div>
  );
}
