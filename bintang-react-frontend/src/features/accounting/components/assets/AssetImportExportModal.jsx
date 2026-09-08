import { useState } from 'react';
import { Download, UploadCloud, X } from 'lucide-react';
import { downloadFile } from '../../../../utils/downloadFile';
import { notify, notifyApiError } from '../../../../utils/notify';
import { commitAssetImport, previewAssetImport } from '../../services/assets';
import AssetAccountSelect from './AssetAccountSelect';

const defaults = { asset_account: null, depreciation_expense_account: null, accumulated_depreciation_account: null, counter_account: null, is_opening_balance: false };

export default function AssetImportExportModal({ accounts, onClose, onImported }) {
  const [tab, setTab] = useState('import');
  const [file, setFile] = useState(null);
  const [config, setConfig] = useState(defaults);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setConfig((current) => ({ ...current, [key]: value }));

  const previewFile = async () => {
    if (!file) return;
    setBusy(true);
    try { setPreview(await previewAssetImport(file, config)); } catch (error) { notifyApiError(error, 'Gagal memvalidasi file aset'); } finally { setBusy(false); }
  };
  const commit = async () => {
    setBusy(true);
    try {
      const result = await commitAssetImport(preview.entries, config);
      await onImported();
      notify({ type: 'success', title: 'Import selesai', message: String(result.created_count) + ' aset dan jurnal perolehan dibuat.' });
      onClose();
    } catch (error) { notifyApiError(error, 'Import aset gagal'); } finally { setBusy(false); }
  };
  const download = (format) => downloadFile('/accounting/assets/?export=' + format + '&all_dates=true', 'daftar-aset.' + format);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col animate-scale-up">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <span className="text-xs font-bold text-slate-800">Import &amp; Export Aset</span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md text-slate-450 hover:text-slate-700 transition-all cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="px-4 pt-3 flex gap-1 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg cursor-pointer transition-colors ${tab === 'import' ? 'text-[#0088E8] border-b-2 border-[#0088E8]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setTab('export')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg cursor-pointer transition-colors ${tab === 'export' ? 'text-[#0088E8] border-b-2 border-[#0088E8]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Export
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {tab === 'export' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => download('xlsx')} className="rounded-xl border border-slate-200 p-5 text-left hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs">
                <Download className="mb-2 text-emerald-600" size={18} />
                <div className="font-bold text-xs text-slate-700">Download Excel</div>
              </button>
              <button type="button" onClick={() => download('pdf')} className="rounded-xl border border-slate-200 p-5 text-left hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs">
                <Download className="mb-2 text-rose-600" size={18} />
                <div className="font-bold text-xs text-slate-700">Download PDF</div>
              </button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => downloadFile('/accounting/assets/import/template/', 'template_aset.csv')} className="flex items-center gap-2 text-xs font-bold text-[#0088E8] cursor-pointer">
                <Download size={14} /> Unduh template CSV
              </button>
              <div className="grid gap-3 sm:grid-cols-2">
                <AssetAccountSelect label="Akun Aset" value={config.asset_account} onChange={(value) => set('asset_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && !a.is_contra} />
                <AssetAccountSelect label="Beban Penyusutan" value={config.depreciation_expense_account} onChange={(value) => set('depreciation_expense_account', value)} accounts={accounts} filter={(a) => a.account_type === 'expense'} />
                <AssetAccountSelect label="Akumulasi Penyusutan" value={config.accumulated_depreciation_account} onChange={(value) => set('accumulated_depreciation_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && a.is_contra} />
                {!config.is_opening_balance && <AssetAccountSelect label="Akun Kredit Perolehan" value={config.counter_account} onChange={(value) => set('counter_account', value)} accounts={accounts} filter={(a) => a.is_active} />}
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={config.is_opening_balance} onChange={(e) => set('is_opening_balance', e.target.checked)} /> Import sebagai saldo awal
              </label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-7 text-xs font-semibold text-slate-500 hover:border-[#0088E8] transition-colors">
                <UploadCloud className="text-[#0088E8]" size={20} />
                <span>{file ? file.name : 'Pilih file CSV (maks. 500 baris)'}</span>
                <input hidden type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} />
              </label>
              {preview && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs">
                  <b className="text-slate-700">{preview.valid_rows}/{preview.total_rows} baris valid</b>
                  {preview.entries.filter((row) => !row.is_valid).map((row) => (
                    <p key={row.row_number} className="mt-1 text-rose-600">Baris {row.row_number}: {row.errors.join(' ')}</p>
                  ))}
                </div>
              )}
              {preview ? (
                <button type="button" disabled={busy || preview.valid_rows !== preview.total_rows} onClick={commit} className="w-full py-2 bg-[#51a351] hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50">
                  {busy ? 'Memproses...' : 'Konfirmasi Import'}
                </button>
              ) : (
                <button type="button" disabled={busy || !file} onClick={previewFile} className="w-full py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50">
                  {busy ? 'Memvalidasi...' : 'Preview Import'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
