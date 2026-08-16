import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Wallet, Award, Plus, Edit2, ShoppingCart,
  FileText, Download, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { formatCurrency } from '../pages/customerSupplierData';
import { formatDisplayDate } from '../../../utils/date';

const GENDER_LABEL = { L: 'Laki-laki', P: 'Perempuan' };

function DetailRow({ label, value, valClass = 'text-slate-800' }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 text-xs md:text-sm">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={`font-semibold text-right break-all ml-4 ${valClass}`}>{value || '-'}</span>
    </div>
  );
}

/** Kartu statistik ringkas di atas (Total Transaksi, Nominal, Lunas, Hutang). */
function StatCard({ icon: Icon, label, value, warna }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${warna}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-base font-extrabold text-slate-800 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

const TX_TABS = [
  { id: 'pesanan', label: 'Pesanan' },
  { id: 'pengembalian', label: 'Pengembalian' },
  { id: 'item', label: 'Item' },
  { id: 'catatan', label: 'Catatan' },
];

export default function CustomerDetailPage({
  customer, notes = [], onBack, onEdit, onAddNote, onEditNote, onDownloadNotes,
}) {
  const c = customer;
  const [activeTab, setActiveTab] = useState('pesanan');
  const [showMore, setShowMore] = useState(false);
  const [tx, setTx] = useState(null);
  const [loadingTx, setLoadingTx] = useState(true);
  const [noteQuery, setNoteQuery] = useState('');
  const [showDownload, setShowDownload] = useState(false);
  const downloadRef = useRef(null);

  const fetchTx = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await apiClient.get(`/customers/${c.id}/transactions/`);
      setTx(res.data);
    } catch (err) {
      console.error('[CustomerDetailPage] gagal memuat transaksi:', err);
      setTx({ ringkasan: {}, pesanan: [], pengembalian: [], item: [] });
    } finally {
      setLoadingTx(false);
    }
  }, [c.id]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  useEffect(() => {
    const onClick = (e) => { if (downloadRef.current && !downloadRef.current.contains(e.target)) setShowDownload(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const r = tx?.ringkasan || {};
  const poin = r.loyalty_points ?? c.loyalty_points ?? 0;
  const initials = c.nama ? c.nama.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'C';

  const catatanPelanggan = notes.filter((n) => String(n.customer) === String(c.id));
  const catatanTerfilter = catatanPelanggan.filter((n) => {
    if (!noteQuery.trim()) return true;
    const q = noteQuery.toLowerCase();
    return (n.judul || '').toLowerCase().includes(q) ||
      (n.entries?.[0]?.content || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto animate-fade-in">
      {/* Header sticky dengan tombol kembali */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 rounded-full p-2 hover:bg-slate-100 cursor-pointer transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="flex-1 text-center text-base md:text-lg font-bold text-slate-800 pr-10">Rincian Pelanggan</h2>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5 pb-16">
        {/* Hero */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-extrabold text-slate-800 truncate">{c.nama}</h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                    {c.customer_group_nama || 'Guest'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{c.kode_pelanggan || '-'}</p>
              </div>
            </div>

            {/* Chip saldo / poin / pesanan + tombol catatan */}
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400"
                title="Saldo deposit belum tersedia (sistem akun saldo belum aktif)"
              >
                <Wallet size={16} />
                <span className="text-[11px] font-bold mt-0.5">IDR 0</span>
              </div>
              <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
                <Award size={16} />
                <span className="text-[11px] font-bold mt-0.5">{Number(poin).toLocaleString('id-ID')} pts</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('pesanan')}
                className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 cursor-pointer hover:bg-emerald-100"
              >
                <ShoppingCart size={16} />
                <span className="text-[11px] font-bold mt-0.5">Pesanan</span>
              </button>
              <button
                type="button"
                onClick={onAddNote}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-4 py-2 cursor-pointer shadow-sm"
              >
                <Plus size={16} /> Catatan
              </button>
            </div>
          </div>
        </div>

        {/* Statistik transaksi (real) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={ShoppingCart} label="Total Transaksi" warna="bg-indigo-50 text-indigo-600"
            value={loadingTx ? '…' : `${r.total_transaksi ?? 0}`} />
          <StatCard icon={Wallet} label="Nominal transaksi" warna="bg-blue-50 text-blue-600"
            value={loadingTx ? '…' : formatCurrency(r.nominal_transaksi)} />
          <StatCard icon={Wallet} label="Lunas" warna="bg-emerald-50 text-emerald-600"
            value={loadingTx ? '…' : formatCurrency(r.lunas)} />
          <StatCard icon={Wallet} label="Hutang" warna={Number(r.hutang) > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}
            value={loadingTx ? '…' : formatCurrency(r.hutang)} />
        </div>

        {/* Profil Pelanggan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-800">Profil Pelanggan</h3>
            <button
              type="button"
              onClick={() => onEdit(c)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-slate-600 hover:text-blue-600 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Edit2 size={14} /> Ubah
            </button>
          </div>
          <div className="grid gap-x-8 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Profil</p>
              <DetailRow label="Nama" value={c.nama} />
              <DetailRow label="Tipe Pelanggan" value={c.customer_group_nama || 'Guest'} />
              <DetailRow label="Jenis Kelamin" value={GENDER_LABEL[c.jenis_kelamin]} />
              <DetailRow label="Nomor HP" value={c.handphone} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Lainnya</p>
              <DetailRow label="Tanggal Lahir" value={formatDisplayDate(c.tanggal_lahir)} />
              <DetailRow label="Kode Pelanggan" value={c.kode_pelanggan} />
              <DetailRow label="Batas Kredit/Hutang" value={formatCurrency(c.batas_kredit)} />
              <DetailRow label="Perusahaan" value={c.nama_perusahaan} />
              <DetailRow label="Terima Buletin Berkala" value={c.terima_buletin ? 'Ya' : 'Tidak'} />
              {/* Beda dari "Tanggal Aktif" di tabel (= created_at, kapan record
                  dibuat di sistem ini). Ini histori sesungguhnya — manual atau
                  dari import data lama (mis. migrasi dari Olsera). */}
              <DetailRow label="Tanggal Gabung" value={formatDisplayDate(c.tanggal_bergabung)} />
              <DetailRow label="Transaksi Terakhir" value={formatDisplayDate(c.transaksi_terakhir)} />
            </div>
          </div>

          {showMore && (
            <div className="grid gap-x-8 md:grid-cols-2 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Login</p>
                <DetailRow label="Email" value={c.email} />
                <DetailRow label="Kata Sandi" value={c.email ? '••••••••' : '-'} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Alamat</p>
                <DetailRow label="Alamat" value={c.alamat} />
                <DetailRow label="Negara" value={c.negara} />
                <DetailRow label="Propinsi" value={c.provinsi} />
                <DetailRow label="Kota" value={c.kota} />
                <DetailRow label="Kecamatan" value={c.kecamatan} />
                <DetailRow label="Kode Pos" value={c.kode_pos} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="w-full mt-4 py-2 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 border-t border-slate-100 pt-3 cursor-pointer"
          >
            {showMore ? <>Sembunyikan <ChevronUp size={14} /></> : <>Selengkapnya <ChevronDown size={14} /></>}
          </button>
        </div>

        {/* Tabs transaksi */}
        <div>
          <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
            {TX_TABS.map((t) => {
              const jml = t.id === 'pesanan' ? tx?.pesanan?.length
                : t.id === 'pengembalian' ? tx?.pengembalian?.length
                  : t.id === 'item' ? tx?.item?.length
                    : catatanPelanggan.length;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer ${
                    isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}{jml != null ? ` (${jml})` : ''}
                </button>
              );
            })}
          </div>

          <div className="pt-4">
            {activeTab === 'pesanan' && (
              <TxTable
                loading={loadingTx}
                rows={tx?.pesanan || []}
                emptyText="Tidak ada pesanan"
                columns={[
                  { key: 'no_pesanan', label: 'No. Pesanan' },
                  { key: 'tanggal', label: 'Tanggal' },
                  { key: 'sumber', label: 'Sumber' },
                  { key: 'total', label: 'Total', money: true, align: 'right' },
                  { key: 'dibayar', label: 'Dibayar', money: true, align: 'right' },
                  { key: 'sisa', label: 'Sisa', money: true, align: 'right' },
                  { key: 'status', label: 'Status' },
                ]}
              />
            )}
            {activeTab === 'pengembalian' && (
              <TxTable
                loading={loadingTx}
                rows={tx?.pengembalian || []}
                emptyText="Tidak ada pengembalian"
                columns={[
                  { key: 'no_pesanan', label: 'No. Pesanan' },
                  { key: 'tanggal', label: 'Tanggal' },
                  { key: 'sumber', label: 'Sumber' },
                  { key: 'total', label: 'Total', money: true, align: 'right' },
                  { key: 'status', label: 'Status' },
                ]}
              />
            )}
            {activeTab === 'item' && (
              <TxTable
                loading={loadingTx}
                rows={tx?.item || []}
                emptyText="Tidak ada item"
                columns={[
                  { key: 'no_pesanan', label: 'No. Pesanan' },
                  { key: 'tanggal', label: 'Tanggal' },
                  { key: 'nama', label: 'Item' },
                  { key: 'qty', label: 'Qty', align: 'right' },
                  { key: 'harga', label: 'Harga', money: true, align: 'right' },
                  { key: 'total', label: 'Total', money: true, align: 'right' },
                ]}
              />
            )}
            {activeTab === 'catatan' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                {/* Toolbar: Download + Cari + Tambah */}
                <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                  <div className="relative" ref={downloadRef}>
                    <button
                      type="button"
                      onClick={() => setShowDownload((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Download size={14} /> Download <ChevronDown size={13} />
                    </button>
                    {showDownload && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-32 overflow-hidden">
                        {['excel', 'pdf'].map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => { setShowDownload(false); onDownloadNotes?.(fmt, c.id); }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer capitalize"
                          >
                            {fmt === 'excel' ? 'Excel (.xlsx)' : 'PDF'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={noteQuery}
                      onChange={(e) => setNoteQuery(e.target.value)}
                      placeholder="Cari"
                      className="pl-8 pr-3 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onAddNote}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-3 py-2 cursor-pointer"
                  >
                    <Plus size={14} /> Tambah
                  </button>
                </div>

                {catatanTerfilter.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-700">
                      {catatanPelanggan.length === 0 ? 'Belum ada catatan pelanggan' : 'Tidak ada hasil pencarian'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {catatanTerfilter.map((n) => (
                      <div key={n.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm font-bold text-slate-800">{n.judul || '(Tanpa Judul)'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">{formatDisplayDate(n.tanggal)}</span>
                            <button
                              type="button"
                              onClick={() => onEditNote?.(n)}
                              className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Ubah Catatan"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </div>
                        {n.entries?.length > 0 ? (
                          <p className="text-xs md:text-sm text-slate-600 mt-2 whitespace-pre-line">{n.entries[0].content}</p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-2 italic">Entri catatan kosong.</p>
                        )}
                        {(n.tags || []).length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mt-3">
                            {n.tags.map((tag) => (
                              <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100/50">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tabel transaksi generik dengan status loading & empty state. */
function TxTable({ loading, rows, columns, emptyText }) {
  const fmtVal = (col, val) => {
    if (col.money) return formatCurrency(val);
    if (col.key === 'tanggal') return formatDisplayDate(val);
    return val ?? '-';
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm font-semibold text-slate-400">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                {columns.map((col) => (
                  <th key={col.key} className={`px-4 py-3 whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''} ${col.key === 'status' ? 'capitalize' : ''}`}>
                      {fmtVal(col, row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
