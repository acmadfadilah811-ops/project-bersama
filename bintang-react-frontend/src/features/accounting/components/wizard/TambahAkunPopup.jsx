import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../../utils/notify';
import {
  KATEGORI_AKUN,
  CONTRA_SUB_CATEGORIES,
  AKUMULASI_DARI_AKUN_SUB_CATEGORY,
  AKUMULASI_DARI_AKUN_CODES,
} from './kategoriAkunMap';

export default function TambahAkunPopup({ onClose, onCreated }) {
  const [classifications, setClassifications] = useState([]);
  const [kategoriLabel, setKategoriLabel] = useState('');
  const [subKategoriName, setSubKategoriName] = useState('');
  const [namaAkun, setNamaAkun] = useState('');
  const [nomorAkun, setNomorAkun] = useState('');
  const [akumulasiDariAkun, setAkumulasiDariAkun] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get('/accounting/account-classifications/')
      .then((res) => setClassifications(res.data || []))
      .catch((err) => notifyApiError(err, 'Gagal memuat daftar klasifikasi akun'));
  }, []);

  const kategori = KATEGORI_AKUN.find((k) => k.label === kategoriLabel);
  const needsSubKategori = !!kategori?.subCategories;
  const effectiveSubKategoriName = needsSubKategori ? subKategoriName : kategori?.singleClassification || '';
  const showAkumulasiDariAkun = effectiveSubKategoriName === AKUMULASI_DARI_AKUN_SUB_CATEGORY;

  const selectedClassification = useMemo(
    () => classifications.find((c) => c.name === effectiveSubKategoriName),
    [classifications, effectiveSubKategoriName],
  );

  // Auto-fill Nomor Akun begitu klasifikasi diketahui: kode tertinggi yang
  // sudah dipakai di klasifikasi itu + 1, atau code_range_start kalau kosong.
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
  };

  const isContra = CONTRA_SUB_CATEGORIES.has(effectiveSubKategoriName);

  const canSave =
    !!kategoriLabel &&
    (!needsSubKategori || !!subKategoriName) &&
    namaAkun.trim() !== '' &&
    nomorAkun.trim() !== '' &&
    !!selectedClassification &&
    !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await apiClient.post('/accounting/accounts/', {
        code: nomorAkun.trim(),
        name: namaAkun.trim(),
        classification: selectedClassification.id,
        is_contra: isContra,
      });
      notifySuccess('Berhasil', `Akun ${nomorAkun} - ${namaAkun} berhasil dibuat.`);
      onCreated?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal membuat akun baru');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute z-20 top-full left-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#0088E8]">Tambah Akun</h4>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            canSave
              ? 'bg-[#0088E8] hover:bg-sky-600 text-white cursor-pointer'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          Simpan
        </button>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-slate-500">Kategori</label>
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
          <label className="block text-[11px] font-medium text-slate-500">Sub Kategori</label>
          <select
            value={subKategoriName}
            disabled={!kategoriLabel}
            onChange={(e) => setSubKategoriName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <option value="">Pilih Kategori</option>
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
          <label className="block text-[11px] font-medium text-slate-500">Akumulasi dari akun</label>
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
        <label className="block text-[11px] font-medium text-slate-500">Nama Akun</label>
        <input
          type="text"
          value={namaAkun}
          onChange={(e) => setNamaAkun(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-slate-500">Nomor Akun</label>
        <input
          type="text"
          value={nomorAkun}
          onChange={(e) => setNomorAkun(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
        />
      </div>
    </div>
  );
}
