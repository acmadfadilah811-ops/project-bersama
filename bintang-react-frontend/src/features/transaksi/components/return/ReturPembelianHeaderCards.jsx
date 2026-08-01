import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Pencil, Check, X } from 'lucide-react';

/**
 * Top Header & 3 Information Cards — Presisi SS No. 1, 2, 3
 */
export default function ReturPembelianHeaderCards({
  doc,
  onBack,
  onPost,
  onCancel,
  onSaveCatatan,
}) {
  const [isEditingCatatan, setIsEditingCatatan] = useState(false);
  const [catatanText, setCatatanText] = useState(doc.catatan || '');
  const [savingCatatan, setSavingCatatan] = useState(false);

  useEffect(() => {
    setCatatanText(doc.catatan || '');
  }, [doc.catatan]);

  const isDraft = doc.status === 'draft';
  const isSelesai = doc.status === 'selesai';
  const isCancelled = doc.status === 'batal';

  const fmtDate = (val) => {
    if (!val) return '-';
    return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fmtIDR = (num) => `IDR ${Math.round(Number(num) || 0).toLocaleString('id-ID')}`;

  const refDetails = doc.retur_ref_details || {};

  const handleSaveCatatan = async () => {
    setSavingCatatan(true);
    try {
      await onSaveCatatan?.(catatanText);
      setIsEditingCatatan(false);
    } catch (err) {
      console.error('Gagal menyimpan catatan:', err);
    } finally {
      setSavingCatatan(false);
    }
  };

  return (
    <div className="space-y-4 text-xs font-semibold text-slate-700">
      {/* Alert Banner Informasional */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-2.5 text-slate-600">
        <span className="text-slate-400 text-sm">ⓘ</span>
        <span className="text-xs font-medium">
          Pastikan data sudah benar sebelum diposting. Setelah terposting, data tidak diperbolehkan diubah.
        </span>
      </div>

      {/* Card Title Box & Action Buttons */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors"
            title="Kembali ke Daftar Pembelian"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            📦
          </div>
          <div>
            <span className="font-mono font-bold text-slate-800 text-sm block leading-tight">{doc.nomor}</span>
            <span className="text-[10px] font-bold text-amber-600 capitalize">
              {isSelesai ? 'Terposting' : isCancelled ? 'Dibatalkan' : 'Pending'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 border border-slate-200 text-blue-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
            title="Cetak retur"
          >
            <Printer size={16} />
          </button>
          {isDraft && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg px-4 py-2 cursor-pointer shadow-2xs transition-colors"
            >
              Batalkan
            </button>
          )}
          <button
            type="button"
            disabled={!isDraft}
            onClick={onPost}
            className={`text-xs font-bold rounded-lg px-4 py-2 transition-colors ${
              isDraft
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-2xs'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            ✓ Post Sekarang
          </button>
        </div>
      </div>

      {/* Grid 3 Cards: Supplier, Pembelian, Catatan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Supplier */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100 font-bold text-slate-800">
            <span>🚚</span> Supplier
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Nama Supplier</span>
              <span className="font-bold text-slate-800 text-right">{doc.supplier || 'Tanpa supplier'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Personal Yg Dihubungi</span>
              <span className="font-medium text-slate-700 text-right">{doc.supplier_kontak || doc.supplier_alamat || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Telepon</span>
              <span className="font-medium text-slate-700 text-right">{doc.supplier_telepon || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Alamat</span>
              <span className="font-medium text-slate-700 text-right">{doc.supplier_alamat || '-'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pembelian Asli */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100 font-bold text-slate-800">
            <span>🛍️</span> Pembelian
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">No. Pembelian</span>
              <span className="font-mono font-bold text-slate-800 text-right">
                {refDetails.nomor || doc.retur_ref_nomor || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Tanggal Beli</span>
              <span className="font-medium text-slate-700 text-right">{fmtDate(refDetails.tanggal || doc.tanggal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Status Bayar</span>
              <span className="font-bold text-emerald-600 text-right capitalize">
                {refDetails.payment_status === 'lunas' ? 'Lunas' : refDetails.payment_status || 'Lunas'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">QTY Produk</span>
              <span className="font-bold text-slate-800 text-right">{refDetails.total_qty || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Jumlah</span>
              <span className="font-mono font-bold text-slate-800 text-right">
                {fmtIDR(refDetails.total || doc.total || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Catatan (Inline Editable) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 font-bold text-slate-800">
            <div className="flex items-center gap-2">
              <span>💬</span> Catatan
            </div>
            {!isEditingCatatan && (
              <button
                type="button"
                onClick={() => setIsEditingCatatan(true)}
                className="text-blue-600 hover:text-blue-800 p-1 cursor-pointer transition-colors"
                title="Ubah catatan secara langsung"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>

          {isEditingCatatan ? (
            <div className="space-y-2 pt-1">
              <textarea
                rows={2}
                autoFocus
                value={catatanText}
                onChange={(e) => setCatatanText(e.target.value)}
                placeholder="Tulis catatan..."
                className="w-full text-xs font-medium border border-blue-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none bg-blue-50/20"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCatatanText(doc.catatan || '');
                    setIsEditingCatatan(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingCatatan}
                  onClick={handleSaveCatatan}
                  className="px-3 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Check size={12} /> {savingCatatan ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingCatatan(true)}
              className="text-xs font-medium text-slate-500 pt-1 cursor-pointer hover:text-slate-800 transition-colors"
              title="Klik untuk mengubah catatan"
            >
              {doc.catatan || 'Tidak ada Catatan'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

