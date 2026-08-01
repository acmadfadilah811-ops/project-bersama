import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { CONTRA_SUB_CATEGORIES, KATEGORI_AKUN } from '../../accounting/components/wizard/kategoriAkunMap';

const getCategoryLabel = (classificationName) => (
  KATEGORI_AKUN.find((category) => (
    (category.subCategories || [category.singleClassification]).includes(classificationName)
  ))?.label || '-'
);

const formatApiError = (data, fallback) => {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error || data.detail) return data.error || data.detail;
  const message = Object.entries(data)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' | ');
  return message || fallback;
};

/**
 * Side Drawer "Atur Akun" (Presisi 1:1 SS No. 2 Olsera).
 * Menampilkan form pendaftaran akun jurnal baru + tabel daftar akun (Nomor Akun & Name Akun).
 */
export default function AturAkunDrawer({ accounts, onRefreshAccounts, onClose }) {
  const [kategori, setKategori] = useState('');
  const [classificationId, setClassificationId] = useState('');
  const [namaAkun, setNamaAkun] = useState('');
  const [nomorAkun, setNomorAkun] = useState('');
  const [error, setError] = useState('');
  const [classifications, setClassifications] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/accounting/account-classifications/')
      .then(({ data }) => setClassifications(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Klasifikasi akun tidak dapat dimuat.'));
  }, []);

  const selectedCategory = KATEGORI_AKUN.find((item) => item.label === kategori);
  const allowedClassificationNames = selectedCategory
    ? (selectedCategory.subCategories || [selectedCategory.singleClassification])
    : [];
  const availableClassifications = classifications.filter((item) => allowedClassificationNames.includes(item.name));
  const selectedClassification = classifications.find((item) => String(item.id) === String(classificationId));

  const handleCategoryChange = (value) => {
    setKategori(value);
    const category = KATEGORI_AKUN.find((item) => item.label === value);
    const names = category ? (category.subCategories || [category.singleClassification]) : [];
    const firstClassification = classifications.find((item) => names.includes(item.name));
    setClassificationId(firstClassification ? String(firstClassification.id) : '');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!namaAkun.trim() || !nomorAkun.trim() || !kategori || !classificationId) {
      setError('Kategori, Sub Kategori, Nama Akun, dan Nomor Akun wajib diisi.');
      return;
    }
    const codeNumber = Number(nomorAkun.trim());
    if (!Number.isInteger(codeNumber) || (
      selectedClassification && (codeNumber < selectedClassification.code_range_start || codeNumber > selectedClassification.code_range_end)
    )) {
      setError(`Nomor akun harus berada pada rentang ${selectedClassification?.code_range_start || '-'}–${selectedClassification?.code_range_end || '-'} untuk Sub Kategori terpilih.`);
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/accounting/accounts/', {
        code: nomorAkun.trim(),
        name: namaAkun.trim(),
        classification: Number(classificationId),
        is_contra: CONTRA_SUB_CATEGORIES.has(
          classifications.find((item) => String(item.id) === String(classificationId))?.name,
        ),
        ignore_minus_closing: false,
      });
      await onRefreshAccounts?.();
      setNamaAkun('');
      setNomorAkun('');
      setKategori('');
      setClassificationId('');
      setError('');
    } catch (err) {
      setError(formatApiError(err.response?.data, 'Gagal menyimpan akun ke Akuntansi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-slide-left">
        
        {/* Header - Title & Close */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 text-lg">Atur Akun</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Form Tambah Akun */}
          <form onSubmit={handleAdd} className="space-y-4 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 cursor-pointer"
              >
                <option value="">Pilih Kategori</option>
                {KATEGORI_AKUN.map((item) => (
                  <option key={item.label} value={item.label}>{item.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Sub Kategori</label>
              <select
                value={classificationId}
                onChange={(e) => setClassificationId(e.target.value)}
                disabled={!kategori || availableClassifications.length === 0}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Pilih Sub Kategori</option>
                {availableClassifications.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {kategori && availableClassifications.length === 0 && (
                <p className="text-[10px] text-rose-500 mt-1">Klasifikasi untuk kategori ini belum tersedia di Akuntansi.</p>
              )}
              {selectedClassification && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Rentang Nomor Akun: {selectedClassification.code_range_start}–{selectedClassification.code_range_end}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Nama Akun</label>
                <input
                  type="text"
                  value={namaAkun}
                  onChange={(e) => setNamaAkun(e.target.value)}
                  placeholder="Nama Akun"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Nomor Akun</label>
                <input
                  type="text"
                  value={nomorAkun}
                  onChange={(e) => setNomorAkun(e.target.value)}
                  placeholder="Nomor Akun"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 font-mono"
                />
              </div>
            </div>

            {error && <p className="text-[11px] font-medium text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full text-xs font-bold bg-[#76CB39] hover:bg-[#65b52c] text-white py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Tambah'}
            </button>
          </form>

          {/* Tabel Daftar Akun */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 font-bold">
                  <th className="py-3 px-4 font-bold">Nomor Akun</th>
                  <th className="py-3 px-4 font-bold">Nama Akun</th>
                  <th className="py-3 px-4 font-bold">Kategori</th>
                  <th className="py-3 px-4 font-bold">Sub Kategori</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-800 font-semibold">{acc.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{acc.name}</td>
                    <td className="py-3 px-4 text-slate-600">{getCategoryLabel(acc.klasifikasi)}</td>
                    <td className="py-3 px-4 text-slate-600">{acc.klasifikasi || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
