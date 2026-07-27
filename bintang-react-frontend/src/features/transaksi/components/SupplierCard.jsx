import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function SupplierCard({ doc, isDraft, onSaved }) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchSupplier, setSearchSupplier] = useState('');
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  useEffect(() => {
    if (!searchSupplier.trim() || selectedSupplier) {
      setSupplierOptions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/suppliers/?search=${encodeURIComponent(searchSupplier)}`);
        setSupplierOptions(res.data.results || res.data || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchSupplier, selectedSupplier]);

  const handleSave = async () => {
    const activeSupplierName = selectedSupplier ? selectedSupplier.nama : searchSupplier;
    try {
      // Backend menautkan supplier_ref otomatis dari nama & mengembalikan kontaknya.
      await apiClient.patch(`/purchases/${doc.id}/`, { supplier: activeSupplierName });
      setIsEditing(false);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan supplier.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
          <span className="text-xs font-bold text-slate-800">Supplier</span>
          {isDraft && !isEditing && (
            <button
              onClick={() => {
                setSearchSupplier(doc.supplier || '');
                setSelectedSupplier(null);
                setIsEditing(true);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Ubah
            </button>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                Simpan
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Cari Supplier</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchSupplier}
                  onChange={(e) => {
                    setSearchSupplier(e.target.value);
                    setSelectedSupplier(null);
                  }}
                  placeholder="Ketik nama supplier..."
                  className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-2 bg-white focus:outline-none"
                />
              </div>
              {supplierOptions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-50">
                  {supplierOptions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedSupplier(s);
                        setSearchSupplier(s.nama);
                        setSupplierOptions([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 cursor-pointer block font-semibold"
                    >
                      {s.nama}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-xs text-slate-700">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Nama Supplier</span>
              <span className="font-semibold text-slate-800">{doc.supplier || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Telepon</span>
              <span className="font-semibold text-slate-800">{doc.supplier_telepon || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Personal Yg Dihubungi</span>
              <span className="font-semibold text-slate-800">{doc.supplier_kontak || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Email</span>
              <span className="font-semibold text-slate-800">{doc.supplier_email || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Alamat</span>
              <span className="font-semibold text-slate-800 block whitespace-pre-wrap">{doc.supplier_alamat || '-'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
