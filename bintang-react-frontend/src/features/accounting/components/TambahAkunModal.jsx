import { useState, useEffect } from 'react';
import { X, Download, FileText, UploadCloud, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { downloadFile } from '../../../utils/downloadFile';
import {
  KATEGORI_AKUN,
  CONTRA_SUB_CATEGORIES,
  AKUMULASI_DARI_AKUN_SUB_CATEGORY,
  AKUMULASI_DARI_AKUN_CODES,
} from './wizard/kategoriAkunMap';

export default function TambahAkunModal({ isOpen, onClose, onCreated }) {
  const [activeTab, setActiveTab] = useState('form'); // 'form', 'import', 'copy'
  
  // States untuk Form Akun
  const [classifications, setClassifications] = useState([]);
  const [kategoriLabel, setKategoriLabel] = useState('');
  const [subKategoriName, setSubKategoriName] = useState('');
  const [namaAkun, setNamaAkun] = useState('');
  const [nomorAkun, setNomorAkun] = useState('');
  const [akumulasiDariAkun, setAkumulasiDariAkun] = useState('');
  const [ignoreMinusClosing, setIgnoreMinusClosing] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // States untuk Import Akun
  const [file, setFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // States untuk Copy dari Toko Lain
  const [selectedStore, setSelectedStore] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);

  // Load classifications on mount
  useEffect(() => {
    if (!isOpen) return;
    apiClient
      .get('/accounting/account-classifications/')
      .then((res) => setClassifications(res.data || []))
      .catch((err) => notifyApiError(err, 'Gagal memuat daftar klasifikasi akun'));
  }, [isOpen]);

  const kategori = KATEGORI_AKUN.find((k) => k.label === kategoriLabel);
  const needsSubKategori = !!kategori?.subCategories;
  const effectiveSubKategoriName = needsSubKategori ? subKategoriName : kategori?.singleClassification || '';
  const showAkumulasiDariAkun =
    effectiveSubKategoriName === 'Akumulasi penyusutan aset tetap' ||
    effectiveSubKategoriName === AKUMULASI_DARI_AKUN_SUB_CATEGORY;

  const isIgnoreMinusClosingVisible =
    ['Harta Lancar', 'Harta Tetap', 'Harta Tak Berwujud'].includes(kategoriLabel) &&
    !!subKategoriName;

  const selectedClassification = classifications.find((c) => c.name === effectiveSubKategoriName);

  // Auto-fill nomor akun
  useEffect(() => {
    if (!selectedClassification) {
      setNomorAkun('');
      return;
    }
    let cancelled = false;
    apiClient
      .get('/accounting/accounts/', {
        params: { classification: selectedClassification.name, semua_akun: 'true' },
      })
      .then((res) => {
        if (cancelled) return;
        const accounts = res.data || [];
        if (accounts.length === 0) {
          setNomorAkun(String(selectedClassification.code_range_start ?? ''));
          return;
        }
        const maxCode = Math.max(...accounts.map((a) => parseInt(a.code, 10) || 0));
        setNomorAkun(String(maxCode + 1));
      })
      .catch((err) => {
        if (!cancelled) notifyApiError(err, 'Gagal menghitung Nomor Akun otomatis');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClassification]);

  const handleKategoriChange = (label) => {
    setKategoriLabel(label);
    setSubKategoriName('');
    setAkumulasiDariAkun('');
    setIgnoreMinusClosing(false);
  };

  const isContra = CONTRA_SUB_CATEGORIES.has(effectiveSubKategoriName);

  const canSaveForm =
    !!kategoriLabel &&
    (!needsSubKategori || !!subKategoriName) &&
    namaAkun.trim() !== '' &&
    nomorAkun.trim() !== '' &&
    !!selectedClassification &&
    !savingForm;

  const handleSaveForm = async () => {
    if (!canSaveForm) return;
    setSavingForm(true);
    try {
      await apiClient.post('/accounting/accounts/', {
        code: nomorAkun.trim(),
        name: namaAkun.trim(),
        classification: selectedClassification.id,
        is_contra: isContra,
        ignore_minus_closing: isIgnoreMinusClosingVisible ? ignoreMinusClosing : false,
      });
      notifySuccess('Berhasil', `Akun ${nomorAkun} - ${namaAkun} berhasil dibuat.`);
      onCreated?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal membuat akun baru');
    } finally {
      setSavingForm(false);
    }
  };

  // Import functions
  const handleDownloadTemplate = () => downloadFile('/accounting/accounts/import/template/', 'template_daftar_akun.csv');

  const handleDownloadGuide = () => downloadFile('/accounting/accounts/import/guide/', 'panduan_kode_akun.csv');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportPreview(null);
    }
  };

  const handleUploadPreview = async () => {
    if (!file) return;
    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.post('/accounting/accounts/import/preview/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportPreview(res.data);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat pratinjau import file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview || !importPreview.entries) return;
    setImportLoading(true);
    try {
      const res = await apiClient.post('/accounting/accounts/import/commit/', {
        entries: importPreview.entries,
      });
      if (res.data.success) {
        notifySuccess('Berhasil', `Berhasil mengimpor ${res.data.created_count} akun.`);
        onCreated?.();
        onClose();
      } else {
        notifyApiError(res.data.errors.join(', '), 'Terjadi masalah saat proses import');
      }
    } catch (err) {
      notifyApiError(err, 'Gagal memproses import akun');
    } finally {
      setImportLoading(false);
    }
  };

  // Copy Store functions
  const handleCopyStore = async () => {
    if (!selectedStore) return;
    setCopyLoading(true);
    try {
      await apiClient.post('/accounting/accounts/copy-store/', {
        target_store: selectedStore,
      });
      notifySuccess('Berhasil', 'Daftar akun berhasil disalin dari toko terpilih.');
      onCreated?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menyalin akun');
    } finally {
      setCopyLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-xl w-full flex flex-col max-h-[90vh] p-6 relative">
        {/* Tombol Tutup X */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 mb-4">Tambah Akun</h3>

        {/* Tab Header Boxes */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg mb-5 text-xs font-bold text-center">
          <button
            type="button"
            onClick={() => {
              setActiveTab('form');
              setImportPreview(null);
            }}
            className={`py-2 rounded-md transition-all cursor-pointer ${
              activeTab === 'form' ? 'bg-[#0088E8] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            Form Akun
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-2 rounded-md transition-all cursor-pointer ${
              activeTab === 'import' ? 'bg-[#0088E8] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            Import Akun
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('copy');
              setImportPreview(null);
            }}
            className={`py-2 rounded-md transition-all cursor-pointer ${
              activeTab === 'copy' ? 'bg-[#0088E8] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            Copy dari Toko Lain
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          
          {/* TAB 1: FORM AKUN */}
          {activeTab === 'form' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">Kategori</label>
                <select
                  value={kategoriLabel}
                  onChange={(e) => handleKategoriChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                >
                  <option value="">Pilih Kategori</option>
                  {KATEGORI_AKUN.map((k) => (
                    <option key={k.label} value={k.label}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              {needsSubKategori && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-500">Sub Kategori</label>
                  <select
                    value={subKategoriName}
                    disabled={!kategoriLabel}
                    onChange={(e) => setSubKategoriName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <option value="">Pilih Sub Kategori</option>
                    {kategori?.subCategories.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {showAkumulasiDariAkun && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-500">Akumulasi dari akun</label>
                  <select
                    value={akumulasiDariAkun}
                    onChange={(e) => setAkumulasiDariAkun(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                  >
                    <option value="">Pilih Akun</option>
                    {AKUMULASI_DARI_AKUN_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">Nama Akun</label>
                <input
                  type="text"
                  placeholder="Nama Akun Baru"
                  value={namaAkun}
                  onChange={(e) => setNamaAkun(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">Nomor Akun</label>
                <input
                  type="text"
                  placeholder="Kode Nomor Akun"
                  value={nomorAkun}
                  onChange={(e) => setNomorAkun(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                />
              </div>

              {isIgnoreMinusClosingVisible && (
                <div className="space-y-1 mt-1">
                  <label className="block text-[11px] font-bold text-slate-500">Hiraukan minus closing</label>
                  <div className="flex items-center gap-4 py-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="ignore_minus_closing"
                        checked={ignoreMinusClosing === true}
                        onChange={() => setIgnoreMinusClosing(true)}
                        className="w-3.5 h-3.5 text-[#0088E8] border-slate-350 focus:ring-0 cursor-pointer"
                      />
                      <span>Ya</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="ignore_minus_closing"
                        checked={ignoreMinusClosing === false}
                        onChange={() => setIgnoreMinusClosing(false)}
                        className="w-3.5 h-3.5 text-[#0088E8] border-slate-350 focus:ring-0 cursor-pointer"
                      />
                      <span>Tidak</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  disabled={!canSaveForm || savingForm}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold text-white shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    canSaveForm ? 'bg-[#73C240] hover:bg-[#64B031]' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {savingForm && <Loader2 size={14} className="animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT AKUN */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              {/* Feature links */}
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  <Download size={14} className="text-slate-400" />
                  <span>Download Template</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadGuide}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  <FileText size={14} className="text-slate-400" />
                  <span>Download Panduan</span>
                </button>
              </div>

              {/* Upload Box Zone */}
              {!importPreview ? (
                <div>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center bg-slate-50/30 hover:bg-slate-50 transition-colors relative mb-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <UploadCloud size={24} className="text-slate-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      {file ? file.name : (
                        <>
                          Drop file here or <span className="text-[#0088E8] hover:underline cursor-pointer">click to upload</span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-4">
                    Import dari CSV (max. 500 baris)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-3 rounded-lg flex items-center gap-2 border text-xs font-semibold ${
                    importPreview.valid_rows > 0
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    {importPreview.valid_rows > 0 ? (
                      <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle size={16} className="text-rose-500 shrink-0" />
                    )}
                    <span>
                      Ditemukan {importPreview.valid_rows} baris valid dari total {importPreview.total_rows} baris.
                    </span>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Nama</th>
                          <th className="px-3 py-2">Klasifikasi</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {importPreview.entries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2">{entry.code}</td>
                            <td className="px-3 py-2 font-semibold">{entry.name}</td>
                            <td className="px-3 py-2">{entry.classification}</td>
                            <td className="px-3 py-2">
                              {entry.is_valid ? (
                                <span className="text-emerald-600 font-bold">Valid</span>
                              ) : (
                                <span className="text-rose-500 font-bold" title={entry.error}>Error</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {file && !importPreview && (
                  <button
                    type="button"
                    onClick={handleUploadPreview}
                    disabled={importLoading}
                    className="w-full py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {importLoading && <Loader2 size={14} className="animate-spin" />}
                    <span>Unggah & Tinjau</span>
                  </button>
                )}
                {importPreview && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setImportPreview(null);
                      }}
                      className="flex-1 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitImport}
                      disabled={importPreview.valid_rows === 0 || importLoading}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {importLoading && <Loader2 size={14} className="animate-spin" />}
                      <span>Mulai Import</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COPY DARI TOKO LAIN */}
          {activeTab === 'copy' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-800 font-semibold leading-relaxed">
                Fitur ini akan menyalin seluruh klasifikasi dan susunan daftar akun (COA) dari toko/cabang lain milik Anda untuk mempercepat pengaturan.
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">Pilih Toko Asal</label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                >
                  <option value="">Pilih Cabang / Toko</option>
                  <option value="bintang_pusat">StarPhoto & Advertising - Pusat</option>
                  <option value="bintang_gading">StarPhoto & Advertising - Gading Serpong</option>
                  <option value="bintang_karawaci">StarPhoto & Advertising - Karawaci</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleCopyStore}
                  disabled={!selectedStore || copyLoading}
                  className="w-full py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {copyLoading && <Loader2 size={14} className="animate-spin" />}
                  <span>Salin Daftar Akun</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
