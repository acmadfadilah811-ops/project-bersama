import { useMemo, useState } from 'react';
import { FileSpreadsheet, Plus, Search } from 'lucide-react';
import AssetForm from '../components/assets/AssetForm';
import AssetImportExportModal from '../components/assets/AssetImportExportModal';
import useAssets from '../hooks/useAssets';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export default function DaftarAset() {
  const { assets, accounts, loading, reload, save } = useAssets();
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => assets.filter((asset) => (asset.asset_code + ' ' + asset.name).toLowerCase().includes(query.toLowerCase())),
    [assets, query],
  );
  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode atau nama aset" className="rounded-lg border border-slate-200 py-2 pl-9 pr-3" /></div>
        <div className="flex gap-2"><button onClick={() => setShowTransfer(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold"><FileSpreadsheet size={16} />Import & Export</button><button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-[#51a351] px-3 py-2 font-bold text-white"><Plus size={16} />Tambah</button></div>
      </div>
      {showForm && <AssetForm accounts={accounts} onSave={save} onClose={() => setShowForm(false)} />}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Kode</th><th className="p-3">Aset</th><th className="p-3">Tanggal</th><th className="p-3 text-right">Nilai Awal</th><th className="p-3 text-right">Residu</th><th className="p-3">Jurnal</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="6" className="p-10 text-center">Memuat aset...</td></tr> : filtered.length ? filtered.map((asset) => <tr key={asset.id} className="border-t border-slate-100"><td className="p-3 font-bold text-sky-600">{asset.asset_code}</td><td className="p-3"><b>{asset.name}</b><div className="text-xs text-slate-500">{asset.asset_account_code} - {asset.asset_account_name}</div></td><td className="p-3">{asset.acquisition_date}</td><td className="p-3 text-right">{money.format(asset.acquisition_cost)}</td><td className="p-3 text-right">{money.format(asset.residual_value)}</td><td className="p-3">{asset.acquisition_journal_number || '-'}</td></tr>) : <tr><td colSpan="6" className="p-10 text-center text-slate-400">Belum ada aset.</td></tr>}
        </tbody></table>
      </div>
      {showTransfer && <AssetImportExportModal accounts={accounts} onClose={() => setShowTransfer(false)} onImported={reload} />}
    </div>
  );
}
