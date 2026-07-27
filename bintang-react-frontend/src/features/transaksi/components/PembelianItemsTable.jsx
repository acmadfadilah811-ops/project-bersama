import { Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function PembelianItemsTable({ docId, items, isDraft, onRemoved }) {
  const handleRemoveItem = async (itemId) => {
    if (!window.confirm('Hapus produk ini dari pembelian?')) return;
    try {
      await apiClient.post(`/purchases/${docId}/remove-item/`, {
        item_id: itemId,
      });
      onRemoved();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus produk.');
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-xs">
        Belum ada produk yang ditambahkan ke pembelian ini.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto text-slate-700">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-100 text-slate-400 font-semibold">
            <th className="py-2">Produk</th>
            <th className="py-2 text-center">Jumlah</th>
            <th className="py-2 text-right">Harga Beli</th>
            <th className="py-2 text-right">Total</th>
            {isDraft && <th className="py-2 text-center">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 text-slate-700">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="py-2.5">
                <span className="font-bold text-slate-800 block">{item.product_nama}</span>
                {item.product_sku && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    SKU: {item.product_sku}
                  </span>
                )}
              </td>
              <td className="py-2.5 text-center font-semibold">
                {item.qty} {item.product_satuan || 'pcs'}
              </td>
              <td className="py-2.5 text-right font-mono">
                Rp {(item.harga_beli || 0).toLocaleString('id-ID')}
              </td>
              <td className="py-2.5 text-right font-mono font-bold text-slate-800">
                Rp {(item.qty * (item.harga_beli || 0)).toLocaleString('id-ID')}
              </td>
              {isDraft && (
                <td className="py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
