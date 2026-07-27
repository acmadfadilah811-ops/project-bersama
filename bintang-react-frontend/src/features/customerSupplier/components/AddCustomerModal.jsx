import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, Info, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const emptyForm = {
  nama: '',
  customer_group: '',
  handphone: '',
  jenis_kelamin: 'L',
  email: '',
  password: '',
  tanggal_lahir: '',
  kode_pelanggan: '',
  batas_kredit: '',
  nama_perusahaan: '',
  terima_buletin: false,
  bekukan: false,
  tanggal_berakhir: '',
  catatan: '',
  alamat: '',
  negara: 'Indonesia',
  provinsi: '',
  kota: '',
  kecamatan: '',
  kode_pos: '',
};

const inputCls =
  'w-full h-9 rounded-md border border-slate-300 px-2.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400';
const labelCls = 'text-xs font-semibold text-slate-700 mb-1 block';

function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function Section({ title, isOpen, onToggle, children }) {
  return (
    <div className="border-b border-slate-100">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 cursor-pointer"
      >
        <span className="text-sm font-bold text-slate-800">{title}</span>
        <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="pb-4 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

const toFormState = (c) => (c ? {
  nama: c.nama || '',
  customer_group: c.customer_group || '',
  handphone: c.handphone || '',
  jenis_kelamin: c.jenis_kelamin || 'L',
  email: c.email || '',
  password: '',
  tanggal_lahir: c.tanggal_lahir || '',
  kode_pelanggan: c.kode_pelanggan || '',
  batas_kredit: c.batas_kredit != null ? String(c.batas_kredit) : '',
  nama_perusahaan: c.nama_perusahaan || '',
  terima_buletin: !!c.terima_buletin,
  bekukan: !!c.bekukan,
  tanggal_berakhir: c.tanggal_berakhir || '',
  catatan: c.catatan || '',
  alamat: c.alamat || '',
  negara: c.negara || 'Indonesia',
  provinsi: c.provinsi || '',
  kota: c.kota || '',
  kecamatan: c.kecamatan || '',
  kode_pos: c.kode_pos || '',
} : emptyForm);

export default function AddCustomerModal({ onClose, onSaved, groups = [], customer = null }) {
  const [form, setForm] = useState(() => toFormState(customer));
  const [openSections, setOpenSections] = useState({ login: false, lainnya: false, alamat: false });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const handleSave = async () => {
    if (!form.nama.trim() || !form.handphone.trim()) {
      setError('Nama dan Handphone wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      nama: form.nama.trim(),
      customer_group: form.customer_group || null,
      handphone: form.handphone.trim(),
      jenis_kelamin: form.jenis_kelamin,
      email: form.email.trim(),
      password: form.password,
      tanggal_lahir: form.tanggal_lahir || null,
      kode_pelanggan: form.kode_pelanggan.trim(),
      batas_kredit: parseFloat(form.batas_kredit) || 0,
      nama_perusahaan: form.nama_perusahaan.trim(),
      terima_buletin: form.terima_buletin,
      bekukan: form.bekukan,
      tanggal_berakhir: form.tanggal_berakhir || null,
      catatan: form.catatan.trim(),
      alamat: form.alamat.trim(),
      negara: form.negara.trim(),
      provinsi: form.provinsi.trim(),
      kota: form.kota.trim(),
      kecamatan: form.kecamatan.trim(),
      kode_pos: form.kode_pos.trim(),
    };
    try {
      if (customer) {
        await apiClient.patch(`/customers/${customer.id}/`, payload);
      } else {
        await apiClient.post('/customers/', payload);
      }
      onSaved?.();
    } catch (err) {
      console.error('[AddCustomerModal] save error:', err);
      const data = err.response?.data;
      const msg = data && typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        : 'Gagal menyimpan pelanggan.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header (aksi Simpan/Batal ada di header, mengikuti referensi) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 text-lg">{customer ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-1.5 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-1.5 cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div className="space-y-3 pb-2">
            <Field label="Nama">
              <input value={form.nama} onChange={set('nama')} placeholder="Nama pelanggan" className={inputCls} />
            </Field>
            <Field label="Tipe Pelanggan">
              <select value={form.customer_group} onChange={set('customer_group')} className={`${inputCls} bg-white`}>
                <option value="">Cari</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.nama}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Handphone">
                <div className="flex">
                  <span className="flex items-center h-9 px-2.5 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500">+62</span>
                  <input value={form.handphone} onChange={set('handphone')} placeholder="812xxxxxxx" className={`${inputCls} rounded-l-none`} />
                </div>
              </Field>
              <Field label="Jenis Kelamin">
                <div className="flex h-9 border border-slate-300 rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, jenis_kelamin: 'L' }))}
                    className={`flex-1 text-xs font-bold cursor-pointer ${form.jenis_kelamin === 'L' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}
                  >
                    Laki-laki
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, jenis_kelamin: 'P' }))}
                    className={`flex-1 text-xs font-bold cursor-pointer border-l border-slate-300 ${form.jenis_kelamin === 'P' ? 'bg-blue-600 text-white' : 'bg-white text-rose-500'}`}
                  >
                    Perempuan
                  </button>
                </div>
              </Field>
            </div>
          </div>

          <Section title="Login" isOpen={openSections.login} onToggle={() => toggleSection('login')}>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Email dan password dapat digunakan pelanggan untuk mengakses layanan online toko Anda seperti Toko Online, Pesan Online, dan Mobile App.
              </p>
            </div>
            <Field label="Email">
              <input type="email" value={form.email} onChange={set('email')} placeholder="email@contoh.com" className={inputCls} />
            </Field>
            <Field label="Kata Sandi">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder={customer ? 'Kosongkan jika tidak diubah' : 'Tidak wajib diisi'}
                  className={`${inputCls} pr-8`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          </Section>

          <Section title="Lainnya" isOpen={openSections.lainnya} onToggle={() => toggleSection('lainnya')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tanggal Lahir">
                <input type="date" value={form.tanggal_lahir} onChange={set('tanggal_lahir')} className={inputCls} />
              </Field>
              <Field label="Kode Pelanggan">
                <input value={form.kode_pelanggan} onChange={set('kode_pelanggan')} placeholder="Opsional, harus unik" className={inputCls} />
              </Field>
              <Field label="Batas Kredit/Hutang">
                <input type="number" min="0" value={form.batas_kredit} onChange={set('batas_kredit')} placeholder="Rp 0,00" className={inputCls} />
              </Field>
              <Field label="Nama Perusahaan">
                <input value={form.nama_perusahaan} onChange={set('nama_perusahaan')} className={inputCls} />
              </Field>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-slate-700">Terima Buletin Berkala</span>
              <Toggle checked={form.terima_buletin} onChange={(v) => setForm((f) => ({ ...f, terima_buletin: v }))} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-slate-700">Bekukan <span className="font-normal text-slate-400">(Tidak dapat melakukan transaksi)</span></span>
              <Toggle checked={form.bekukan} onChange={(v) => setForm((f) => ({ ...f, bekukan: v }))} />
            </div>

            <Field label="Tanggal Berakhir">
              <input type="date" value={form.tanggal_berakhir} onChange={set('tanggal_berakhir')} className={inputCls} />
            </Field>
            <Field label="Catatan">
              <textarea value={form.catatan} onChange={set('catatan')} rows={3} className={`${inputCls} h-auto py-2 resize-none`} />
            </Field>
          </Section>

          <Section title="Alamat" isOpen={openSections.alamat} onToggle={() => toggleSection('alamat')}>
            <Field label="Alamat">
              <textarea value={form.alamat} onChange={set('alamat')} rows={2} className={`${inputCls} h-auto py-2 resize-none`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Negara">
                <input value={form.negara} onChange={set('negara')} className={inputCls} />
              </Field>
              <Field label="Propinsi">
                <input value={form.provinsi} onChange={set('provinsi')} className={inputCls} />
              </Field>
              <Field label="Kota">
                <input value={form.kota} onChange={set('kota')} className={inputCls} />
              </Field>
              <Field label="Kecamatan">
                <input value={form.kecamatan} onChange={set('kecamatan')} className={inputCls} />
              </Field>
            </div>
            <Field label="Kode Pos">
              <input value={form.kode_pos} onChange={set('kode_pos')} className={inputCls} />
            </Field>
          </Section>
        </div>
      </div>
    </div>
  );
}
