import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MonitorCog, Printer, RefreshCw, Settings2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { notify, notifyApiError } from '../../../utils/notify';
import PrinterTestReceipt from '../components/PrinterTestReceipt';
import {
  getLocalPrinterSettings,
  getPrintErrorMessage,
  getPrintPolicy,
  printReceipt,
  saveLocalPrinterSettings,
} from '../services/printService';
import { getQzPrinters } from '../services/qzTrayService';

export default function PrinterSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, businessSettings, updateBusinessSettings } = useAuth();
  const [localSettings, setLocalSettings] = useState(getLocalPrinterSettings);
  const [savingLocal, setSavingLocal] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [qzPrinters, setQzPrinters] = useState([]);
  const [qzState, setQzState] = useState({ status: 'idle', message: '' });
  const isManager = ['owner', 'manager'].includes(user?.role?.toLowerCase());
  const isKasirPage = location.pathname.startsWith('/kasir/');
  const policy = useMemo(() => getPrintPolicy(businessSettings), [businessSettings]);

  const refreshQzTray = useCallback(async () => {
    setQzState({ status: 'loading', message: 'Menghubungkan QZ Tray...' });
    try {
      const printers = await getQzPrinters();
      setQzPrinters(printers);
      setQzState({
        status: 'connected',
        message: printers.length ? `${printers.length} printer ditemukan di PC ini.` : 'QZ Tray terhubung, tetapi belum ada printer Windows.',
      });
    } catch (error) {
      setQzPrinters([]);
      setQzState({ status: 'error', message: getPrintErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (localSettings.connectionMode === 'qz') void refreshQzTray();
  }, [localSettings.connectionMode, refreshQzTray]);

  const saveLocal = () => {
    if (localSettings.connectionMode === 'qz' && !localSettings.printerName) {
      notify({ type: 'warning', title: 'Printer belum dipilih', message: 'Pilih printer yang terdeteksi QZ Tray terlebih dahulu.' });
      return;
    }
    setSavingLocal(true);
    try {
      const saved = saveLocalPrinterSettings(localSettings);
      setLocalSettings(saved);
      notify({ type: 'success', title: 'Perangkat tersimpan', message: 'Profil printer hanya berlaku di PC dan browser kasir ini.' });
    } finally {
      setSavingLocal(false);
    }
  };

  const testPrint = async () => {
    const receipt = {
      nomor: 'UJI-CETAK',
      created_at: new Date().toISOString(),
      kasir_name: user?.username || 'Kasir',
      items: [{ nama_snapshot: 'Tes koneksi printer', qty: 1, uom_kode: 'pcs', harga_snapshot: 0, subtotal: 0 }],
      subtotal: 0,
      diskon: 0,
      pajak: 0,
      total: 0,
      dibayar: 0,
      kembalian: 0,
    };
    try {
      const result = await printReceipt({ receipt, businessSettings, localSettings });
      if (result.channel === 'qz') notify({ type: 'success', title: 'Uji cetak dikirim', message: 'Periksa antrean printer dan hasil cetaknya.' });
    } catch (error) {
      notify({ type: 'error', title: 'Uji cetak gagal', message: getPrintErrorMessage(error) });
    }
  };

  const saveGlobal = async (key, value) => {
    if (!isManager) return;
    setSavingGlobal(true);
    try {
      const posExtSettings = { ...(businessSettings?.pos_ext_settings || {}), [key]: value };
      const response = await apiClient.patch('/business-settings/', { pos_ext_settings: posExtSettings });
      updateBusinessSettings(response.data);
      notify({ type: 'success', title: 'Kebijakan cetak tersimpan', message: 'Pengaturan ini berlaku untuk seluruh kasir.' });
    } catch (error) {
      notifyApiError(error, 'Gagal menyimpan kebijakan cetak.');
    } finally {
      setSavingGlobal(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate(isKasirPage ? '/kasir/dashboard' : '/settings/point-of-sale')}
            className="mt-0.5 rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            title="Kembali"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Pengaturan Cetak & Printer</h1>
            <p className="mt-1 text-sm text-slate-500">Konfigurasi perangkat PC kasir dan kebijakan cetak POS.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><MonitorCog size={20} /></div>
            <div>
              <h2 className="font-bold text-slate-800">Perangkat di PC kasir ini</h2>
              <p className="text-xs text-slate-500">Tidak dibagikan ke komputer kasir lain.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Metode cetak</span>
              <select
                value={localSettings.connectionMode}
                onChange={(event) => setLocalSettings((current) => ({ ...current, connectionMode: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-medium outline-none focus:border-blue-500"
              >
                <option value="browser">Dialog cetak browser</option>
                <option value="qz">QZ Tray — cetak otomatis</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Printer di Windows</span>
              {localSettings.connectionMode === 'qz' ? (
                <select
                  value={localSettings.printerName}
                  onChange={(event) => setLocalSettings((current) => ({ ...current, printerName: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-medium outline-none focus:border-blue-500"
                >
                  <option value="">Pilih printer dari QZ Tray</option>
                  {qzPrinters.map((printer) => <option key={printer} value={printer}>{printer}</option>)}
                </select>
              ) : (
                <input
                  value={localSettings.printerName}
                  onChange={(event) => setLocalSettings((current) => ({ ...current, printerName: event.target.value }))}
                  placeholder="Contoh: EPSON TM-T82X Receipt"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-medium outline-none focus:border-blue-500"
                />
              )}
            </label>
            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Ukuran kertas resi</span>
              <select
                value={localSettings.paperSize}
                onChange={(event) => setLocalSettings((current) => ({ ...current, paperSize: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-medium outline-none focus:border-blue-500"
              >
                <option value="58mm">Thermal 58 mm</option>
                <option value="80mm">Thermal 80 mm</option>
              </select>
            </label>
          </div>

          {localSettings.connectionMode === 'qz' && (
            <div className={`mt-4 rounded-xl border p-3 text-xs ${qzState.status === 'connected' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : qzState.status === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>QZ Tray:</strong> {qzState.message || 'Belum diperiksa.'}</span>
                <button type="button" onClick={refreshQzTray} disabled={qzState.status === 'loading'} className="inline-flex items-center gap-1 font-bold underline disabled:opacity-60">
                  <RefreshCw size={13} className={qzState.status === 'loading' ? 'animate-spin' : ''} /> Hubungkan ulang
                </button>
              </div>
            </div>
          )}

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={localSettings.autoPrintReceipt}
              onChange={(event) => setLocalSettings((current) => ({ ...current, autoPrintReceipt: event.target.checked }))}
              className="mt-0.5"
            />
            <span><strong>Cetak resi otomatis di PC ini</strong><br />Aktif hanya jika kebijakan global juga mengizinkan cetak otomatis.</span>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={saveLocal} disabled={savingLocal} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              {savingLocal ? 'Menyimpan...' : 'Simpan Perangkat'}
            </button>
            <button type="button" onClick={testPrint} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Printer size={15} /> Uji Cetak
            </button>
          </div>

          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            QZ Tray mencetak melalui driver Windows sehingga Epson dan merek lain didukung. Mode QZ membutuhkan aplikasi QZ Tray aktif serta sertifikat digital yang telah dipasang aman di server; tanpa keduanya, cetak senyap sengaja ditolak.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-xl bg-violet-50 p-2 text-violet-600"><Settings2 size={20} /></div>
            <div>
              <h2 className="font-bold text-slate-800">Kebijakan cetak POS</h2>
              <p className="text-xs text-slate-500">Berlaku untuk semua akun kasir.</p>
            </div>
          </div>

          {isManager ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-xs text-slate-700">
                <input type="checkbox" checked={policy.autoPrintPosReceipt} disabled={savingGlobal} onChange={(event) => saveGlobal('auto_print_pos_receipt', event.target.checked)} className="mt-0.5" />
                <span><strong>Izinkan cetak resi otomatis</strong><br />PC kasir tetap harus mengaktifkannya pada profil perangkat masing-masing.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-xs text-slate-700">
                <input type="checkbox" checked={policy.useA4ReceiptLayout} disabled={savingGlobal} onChange={(event) => saveGlobal('pos_custom_resi_windows', event.target.checked)} className="mt-0.5" />
                <span><strong>Gunakan layout faktur A4</strong><br />Matikan untuk memakai resi thermal sesuai profil PC kasir.</span>
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><CheckCircle2 size={15} className="text-emerald-600" /> Kebijakan global hanya dapat diubah oleh Owner atau Manager.</div>
          )}
        </section>
      </div>
      <PrinterTestReceipt printerName={localSettings.printerName} paperSize={localSettings.paperSize} />
    </div>
  );
}
