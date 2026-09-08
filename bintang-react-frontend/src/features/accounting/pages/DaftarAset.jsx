import { useMemo, useState } from 'react';
import { FileSpreadsheet, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import AssetForm from '../components/assets/AssetForm';
import AssetImportExportModal from '../components/assets/AssetImportExportModal';
import AssetDisposeModal from '../components/assets/AssetDisposeModal';
import AssetEditModal from '../components/assets/AssetEditModal';
import useAssets from '../hooks/useAssets';
import { notify, notifyApiError } from '../../../utils/notify';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function UsefulLifeCell({ asset, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(asset.useful_life_months ?? '');
  const [saving, setSaving] = useState(false);

  if (asset.status === 'disposed') {
    return <span className="text-slate-400">{asset.useful_life_months ? `${asset.useful_life_months} bln` : '-'}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(asset.useful_life_months ?? ''); setEditing(true); }}
        className="text-left hover:underline cursor-pointer"
        title="Klik untuk ubah umur manfaat"
      >
        {asset.useful_life_months ? `${asset.useful_life_months} bln` : <span className="text-slate-400">Belum diatur</span>}
      </button>
    );
  }

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(asset.id, { useful_life_months: value === '' ? null : Number(value) });
      setEditing(false);
    } catch (error) {
      notifyApiError(error, 'Gagal mengubah umur manfaat aset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="number"
        min="1"
        disabled={saving}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-20 rounded border p-1 text-xs"
        placeholder="bulan"
      />
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'disposed') {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Dilepas</span>;
  }
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">Aktif</span>;
}

export default function DaftarAset() {
  const { assets, accounts, loading, reload, save, update, postDepreciation, dispose } = useAssets();
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [posting, setPosting] = useState(false);
  const [query, setQuery] = useState('');
  const [editingAsset, setEditingAsset] = useState(null);
  const [disposingAsset, setDisposingAsset] = useState(null);
  const filtered = useMemo(
    () => assets.filter((asset) => (asset.asset_code + ' ' + asset.name).toLowerCase().includes(query.toLowerCase())),
    [assets, query],
  );

  const handlePostDepreciation = async () => {
    setPosting(true);
    try {
      const result = await postDepreciation();
      notify({
        type: 'success',
        title: 'Penyusutan diposting',
        message: result.posted_count > 0
          ? `${result.posted_count} jurnal penyusutan berhasil diposting untuk periode ${result.period}.`
          : `Tidak ada aset yang perlu disusutkan untuk periode ${result.period} (sudah diposting, belum ada umur manfaat, atau sudah lunas tersusutkan).`,
      });
    } catch (error) {
      notifyApiError(error, 'Gagal memposting penyusutan');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kode atau nama aset" className="rounded-lg border border-slate-200 py-2 pl-9 pr-3" /></div>
        <div className="flex gap-2">
          <button onClick={handlePostDepreciation} disabled={posting} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold disabled:opacity-60">{posting ? 'Memposting...' : 'Posting Penyusutan Bulan Ini'}</button>
          <button onClick={() => setShowTransfer(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold"><FileSpreadsheet size={16} />Import & Export</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-[#51a351] px-3 py-2 font-bold text-white"><Plus size={16} />Tambah</button>
        </div>
      </div>
      {showForm && <AssetForm accounts={accounts} onSave={save} onClose={() => setShowForm(false)} />}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1250px] text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Kode</th><th className="p-3">Aset</th><th className="p-3">Status</th><th className="p-3">Tanggal</th><th className="p-3 text-right">Nilai Awal</th><th className="p-3 text-right">Residu</th><th className="p-3">Umur Manfaat</th><th className="p-3 text-right">Akumulasi Penyusutan</th><th className="p-3 text-right">Nilai Buku</th><th className="p-3">Jurnal</th><th className="p-3">Aksi</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="11" className="p-10 text-center">Memuat aset...</td></tr> : filtered.length ? filtered.map((asset) => (
            <tr key={asset.id} className="border-t border-slate-100">
              <td className="p-3 font-bold text-sky-600">{asset.asset_code}</td>
              <td className="p-3"><b>{asset.name}</b><div className="text-xs text-slate-500">{asset.asset_account_code} - {asset.asset_account_name}</div></td>
              <td className="p-3"><StatusBadge status={asset.status} /></td>
              <td className="p-3">{asset.acquisition_date}</td>
              <td className="p-3 text-right">{money.format(asset.acquisition_cost)}</td>
              <td className="p-3 text-right">{money.format(asset.residual_value)}</td>
              <td className="p-3"><UsefulLifeCell asset={asset} onSave={update} /></td>
              <td className="p-3 text-right">{money.format(asset.accumulated_depreciation || 0)}</td>
              <td className="p-3 text-right font-bold">{money.format(asset.book_value ?? asset.acquisition_cost)}</td>
              <td className="p-3">{asset.acquisition_journal_number || '-'}{asset.disposal_journal_number ? <div className="text-xs text-slate-400">Pelepasan: {asset.disposal_journal_number}</div> : null}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <button type="button" title="Ubah" onClick={() => setEditingAsset(asset)} className="rounded p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><Pencil size={14} /></button>
                  {asset.status !== 'disposed' && (
                    <button type="button" title="Lepas aset" onClick={() => setDisposingAsset(asset)} className="rounded p-1 text-rose-500 hover:bg-rose-50 cursor-pointer"><Trash2 size={14} /></button>
                  )}
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan="11" className="p-10 text-center text-slate-400">Belum ada aset.</td></tr>}
        </tbody></table>
      </div>
      {showTransfer && <AssetImportExportModal accounts={accounts} onClose={() => setShowTransfer(false)} onImported={reload} />}
      {editingAsset && <AssetEditModal asset={editingAsset} onSave={update} onClose={() => setEditingAsset(null)} />}
      {disposingAsset && <AssetDisposeModal asset={disposingAsset} accounts={accounts} onDispose={dispose} onClose={() => setDisposingAsset(null)} />}
    </div>
  );
}
