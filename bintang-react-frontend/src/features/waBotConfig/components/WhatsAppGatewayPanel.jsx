import { useEffect, useState } from 'react';
import { AlertCircle, MessageSquare, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Tab "WhatsApp Gateway" di Pengaturan WA Bot -- status koneksi & QR
 * pairing Evolution API (dipindah dari Settings.jsx 2026-09-18, digabung
 * dengan konfigurasi AI supaya semua hal terkait bot WA ada di satu
 * menu). Murni baca status + tampilkan QR, tidak mengubah cara koneksi
 * itu sendiri dikelola (Evolution API).
 */
export default function WhatsAppGatewayPanel() {
  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(false);

  const fetchWaStatus = async () => {
    setWaLoading(true);
    try {
      const res = await apiClient.get('/whatsapp/status/');
      setWaStatus(res.data);
    } catch {
      setWaStatus(null);
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    fetchWaStatus();
  }, []);

  useEffect(() => {
    if (waStatus?.connected) return;
    const timer = setInterval(() => fetchWaStatus(), 20000);
    return () => clearInterval(timer);
  }, [waStatus?.connected]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-600" />
            <h3 className="font-semibold text-slate-800">WhatsApp Gateway — Status Koneksi</h3>
          </div>
          <button
            onClick={fetchWaStatus}
            disabled={waLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={waLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="p-6">
          {waLoading && !waStatus ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : waStatus ? (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                waStatus.connected
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                {waStatus.connected ? (
                  <Wifi size={22} className="text-emerald-600 shrink-0" />
                ) : (
                  <WifiOff size={22} className="text-amber-500 shrink-0" />
                )}
                <div>
                  <p className={`font-bold text-sm ${
                    waStatus.connected ? 'text-emerald-800' : 'text-amber-800'
                  }`}>
                    {waStatus.connected ? '✅ WhatsApp Terhubung' : '⚠️ Belum Terhubung — Scan QR Code'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instance: <span className="font-mono font-semibold">{waStatus.instance_name}</span>
                    {waStatus.connected && waStatus.owner_jid && (
                      <> &nbsp;|&nbsp; Nomor: <span className="font-semibold">{waStatus.owner_jid.split('@')[0]}</span></>
                    )}
                    {waStatus.connected && waStatus.profileName && (
                      <> &nbsp;|&nbsp; Nama: <span className="font-semibold">{waStatus.profileName}</span></>
                    )}
                  </p>
                </div>
              </div>

              {/* Connected Stats */}
              {waStatus.connected && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <p className="text-2xl font-extrabold text-slate-800">{waStatus.chatCount ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Chat Tersimpan</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <p className="text-2xl font-extrabold text-slate-800">{waStatus.messageCount ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Pesan Tersimpan</p>
                  </div>
                </div>
              )}

              {/* QR Code Section */}
              {!waStatus.connected && waStatus.qr_base64 && (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm inline-block">
                    <img
                      src={waStatus.qr_base64}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64 object-contain"
                    />
                  </div>
                  <div className="text-center space-y-1 max-w-sm">
                    <p className="text-sm font-bold text-slate-700">Cara Menghubungkan WhatsApp:</p>
                    <ol className="text-xs text-slate-500 text-left space-y-1 list-decimal list-inside">
                      <li>Buka WhatsApp di HP Anda</li>
                      <li>Ketuk ikon titik tiga (⋮) → <strong>Tautkan Perangkat</strong></li>
                      <li>Scan QR code di atas</li>
                      <li>Tunggu beberapa detik hingga status berubah hijau</li>
                    </ol>
                    <p className="text-[10px] text-slate-400 pt-1">QR Code diperbarui otomatis setiap 20 detik</p>
                  </div>
                </div>
              )}

              {/* No QR code yet */}
              {!waStatus.connected && !waStatus.qr_base64 && (
                <div className="text-center py-6 text-slate-400">
                  <WifiOff size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">QR Code belum tersedia. Coba klik <strong>Refresh</strong>.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Gagal memuat status WhatsApp. Pastikan Evolution API aktif.</p>
              <button onClick={fetchWaStatus} className="mt-3 text-xs text-indigo-600 hover:underline cursor-pointer">
                Coba lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
