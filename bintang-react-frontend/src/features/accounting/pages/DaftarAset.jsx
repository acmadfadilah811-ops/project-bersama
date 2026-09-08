import { useMemo, useState } from 'react';
import { Calendar, FileSpreadsheet, Loader2, Plus, Search } from 'lucide-react';
import AssetForm from '../components/assets/AssetForm';
import AssetImportExportModal from '../components/assets/AssetImportExportModal';
import AssetDisposeModal from '../components/assets/AssetDisposeModal';
import AssetEditModal from '../components/assets/AssetEditModal';
import AssetActionDropdown from '../components/assets/AssetActionDropdown';
import AssetDateModal from '../components/assets/AssetDateModal';
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
        className="text-left hover:underline cursor-pointer text-slate-700 font-semibold"
        title="Klik untuk ubah umur manfaat"
      >
        {asset.useful_life_months ? `${asset.useful_life_months} bln` : <span className="text-slate-400 font-normal">Belum diatur</span>}
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
    <input
      autoFocus
      type="number"
      min="1"
      disabled={saving}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold outline-none focus:border-[#0088E8]"
      placeholder="bulan"
    />
  );
}

function StatusBadge({ status }) {
  if (status === 'disposed') {
    return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">Dilepas</span>;
  }
  return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700">Aktif</span>;
}

export default function DaftarAset() {
  const { assets, accounts, loading, reload, save, update, postDepreciation, dispose, dateFilter, setDateFilter } = useAssets();
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
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
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      {/* Main Filter and Controls Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode atau nama aset"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 bg-white"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className="px-3.5 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5"
          >
            <Calendar size={13} className="text-slate-400" />
            <span>{dateFilter.label}{!dateFilter.allDates ? ` (${dateFilter.from} - ${dateFilter.to})` : ''}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handlePostDepreciation} disabled={posting} className="px-3.5 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold disabled:opacity-60">
            {posting ? 'Memposting...' : 'Posting Penyusutan Bulan Ini'}
          </button>
          <button onClick={() => setShowTransfer(true)} className="px-3.5 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5">
            <FileSpreadsheet size={14} />Import &amp; Export
          </button>
          <button onClick={() => setShowForm(true)} className="px-3.5 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] rounded-lg cursor-pointer transition-colors shadow-2xs font-bold text-white flex items-center gap-1.5">
            <Plus size={14} />Tambah
          </button>
        </div>
      </div>

      {showForm && <AssetForm accounts={accounts} onSave={save} onClose={() => setShowForm(false)} />}

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible min-h-[350px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-xs gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#0088E8]" />
            <span>Memuat daftar aset...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Kode</th>
                  <th className="px-5 py-3.5">Aset</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5 text-right">Nilai Awal</th>
                  <th className="px-5 py-3.5 text-right">Residu</th>
                  <th className="px-5 py-3.5">Umur Manfaat</th>
                  <th className="px-5 py-3.5 text-right">Akumulasi Penyusutan</th>
                  <th className="px-5 py-3.5 text-right">Nilai Buku</th>
                  <th className="px-5 py-3.5">Jurnal</th>
                  <th className="px-5 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-16 text-center text-slate-400 font-bold">
                      Belum ada aset pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filtered.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-[#0088E8]">{asset.asset_code}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-800">{asset.name}</div>
                        <div className="text-[10px] text-slate-400">{asset.asset_account_code} - {asset.asset_account_name}</div>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={asset.status} /></td>
                      <td className="px-5 py-3.5 text-slate-600">{asset.acquisition_date}</td>
                      <td className="px-5 py-3.5 text-right">{money.format(asset.acquisition_cost)}</td>
                      <td className="px-5 py-3.5 text-right">{money.format(asset.residual_value)}</td>
                      <td className="px-5 py-3.5"><UsefulLifeCell asset={asset} onSave={update} /></td>
                      <td className="px-5 py-3.5 text-right">{money.format(asset.accumulated_depreciation || 0)}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-800">{money.format(asset.book_value ?? asset.acquisition_cost)}</td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {asset.acquisition_journal_number || '-'}
                        {asset.disposal_journal_number ? <div className="text-[10px] text-slate-400">Pelepasan: {asset.disposal_journal_number}</div> : null}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <AssetActionDropdown
                          isDisposed={asset.status === 'disposed'}
                          onEditClick={() => setEditingAsset(asset)}
                          onDisposeClick={() => setDisposingAsset(asset)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTransfer && <AssetImportExportModal accounts={accounts} onClose={() => setShowTransfer(false)} onImported={reload} />}
      {editingAsset && <AssetEditModal asset={editingAsset} onSave={update} onClose={() => setEditingAsset(null)} />}
      {disposingAsset && <AssetDisposeModal asset={disposingAsset} accounts={accounts} onDispose={dispose} onClose={() => setDisposingAsset(null)} />}
      <AssetDateModal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} onApply={setDateFilter} initialLabel={dateFilter.label} />
    </div>
  );
}
