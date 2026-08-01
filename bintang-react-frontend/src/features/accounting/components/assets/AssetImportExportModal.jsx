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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><h2 className="font-bold">Import & Export Aset</h2><button onClick={onClose}><X /></button></div>
        <div className="mb-5 flex gap-2 border-b"><button onClick={() => setTab('import')} className={tab === 'import' ? 'border-b-2 border-sky-500 px-3 py-2 font-bold text-sky-600' : 'px-3 py-2'}>Import CSV</button><button onClick={() => setTab('export')} className={tab === 'export' ? 'border-b-2 border-sky-500 px-3 py-2 font-bold text-sky-600' : 'px-3 py-2'}>Export</button></div>
        {tab === 'export' ? <div className="grid gap-3 sm:grid-cols-2"><button onClick={() => download('xlsx')} className="rounded-xl border p-5 text-left"><Download className="mb-2 text-emerald-600" />Download Excel</button><button onClick={() => download('pdf')} className="rounded-xl border p-5 text-left"><Download className="mb-2 text-rose-600" />Download PDF</button></div> : (
          <div className="space-y-4">
            <button onClick={() => downloadFile('/accounting/assets/import/template/', 'template_aset.csv')} className="flex items-center gap-2 text-sm font-bold text-sky-600"><Download size={16} /> Unduh template CSV</button>
            <div className="grid gap-3 md:grid-cols-2">
              <AssetAccountSelect label="Akun Aset" value={config.asset_account} onChange={(value) => set('asset_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && !a.is_contra} />
              <AssetAccountSelect label="Beban Penyusutan" value={config.depreciation_expense_account} onChange={(value) => set('depreciation_expense_account', value)} accounts={accounts} filter={(a) => a.account_type === 'expense'} />
              <AssetAccountSelect label="Akumulasi Penyusutan" value={config.accumulated_depreciation_account} onChange={(value) => set('accumulated_depreciation_account', value)} accounts={accounts} filter={(a) => a.account_type === 'asset' && a.is_contra} />
              {!config.is_opening_balance && <AssetAccountSelect label="Akun Kredit Perolehan" value={config.counter_account} onChange={(value) => set('counter_account', value)} accounts={accounts} filter={(a) => a.is_active} />}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.is_opening_balance} onChange={(e) => set('is_opening_balance', e.target.checked)} /> Import sebagai saldo awal</label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sky-300 p-7 text-sm"><UploadCloud className="text-sky-500" /><span>{file ? file.name : 'Pilih file CSV (maks. 500 baris)'}</span><input hidden type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} /></label>
            {preview && <div className="rounded-lg bg-slate-50 p-3 text-sm"><b>{preview.valid_rows}/{preview.total_rows} baris valid</b>{preview.entries.filter((row) => !row.is_valid).map((row) => <p key={row.row_number} className="mt-1 text-rose-600">Baris {row.row_number}: {row.errors.join(' ')}</p>)}</div>}
            {preview ? <button disabled={busy || preview.valid_rows !== preview.total_rows} onClick={commit} className="rounded-lg bg-[#51a351] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Memproses...' : 'Konfirmasi Import'}</button> : <button disabled={busy || !file} onClick={previewFile} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Memvalidasi...' : 'Preview Import'}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
