import { useState, useEffect } from 'react';
import { MessageSquare, Settings, ShieldCheck, Database, RefreshCw, Key, Link2, Copy, Send } from 'lucide-react';

export default function WaSettings() {
  // Connection states
  const [apiType, setApiType] = useState('fonnte');
  const [apiKey, setApiKey] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Template states
  const [greetingTemplate, setGreetingTemplate] = useState(
    'Halo *{{nama}}*,\n\nTerima kasih telah menghubungi *Bintang Advertising*. Pesanan Anda dengan ID *{{order_id}}* telah masuk ke sistem kami dan sedang direview oleh kasir.\n\nMohon tunggu konfirmasi berikutnya.'
  );
  const [invoiceTemplate, setInvoiceTemplate] = useState(
    'Halo *{{nama}}*,\n\nPembayaran untuk pesanan *{{order_id}}* sebesar *{{total}}* telah kami terima dengan status *LUNAS* melalui metode *{{metode}}*.\n\nDetail item:\n{{items}}\n\nTerima kasih atas kepercayaannya!'
  );
  const [pendingTemplate, setPendingTemplate] = useState(
    'Halo *{{nama}}*,\n\nBerikut tagihan untuk pesanan *{{order_id}}*:\nTotal: *{{total}}*\nDP Masuk: *{{dp}}*\nSisa Tagihan: *{{sisa}}*\n\nSilakan lakukan pelunasan saat pengambilan barang. Terima kasih!'
  );
  const [readyTemplate, setReadyTemplate] = useState(
    'Halo *{{nama}}*,\n\nKabar gembira! Pesanan Anda *{{order_id}}* (*{{items}}*) telah *SELESAI* diproduksi dan siap diambil di workshop kami.\n\nHarap tunjukkan pesan ini atau sebutkan ID pesanan saat pengambilan. Terima kasih!'
  );

  // Load from local storage on mount
  useEffect(() => {
    const savedType = localStorage.getItem('wa_api_type');
    const savedKey = localStorage.getItem('wa_api_key');
    const savedDev = localStorage.getItem('wa_device_id');
    const savedWeb = localStorage.getItem('wa_webhook_url');
    const savedConn = localStorage.getItem('wa_is_connected');

    if (savedType) setApiType(savedType);
    if (savedKey) setApiKey(savedKey);
    if (savedDev) setDeviceId(savedDev);
    if (savedWeb) setWebhookUrl(savedWeb);
    if (savedConn === 'true') setIsConnected(true);

    const tGreeting = localStorage.getItem('wa_tpl_greeting');
    const tInvoice = localStorage.getItem('wa_tpl_invoice');
    const tPending = localStorage.getItem('wa_tpl_pending');
    const tReady = localStorage.getItem('wa_tpl_ready');

    if (tGreeting) setGreetingTemplate(tGreeting);
    if (tInvoice) setInvoiceTemplate(tInvoice);
    if (tPending) setPendingTemplate(tPending);
    if (tReady) setReadyTemplate(tReady);
  }, []);

  const handleSaveConnection = () => {
    localStorage.setItem('wa_api_type', apiType);
    localStorage.setItem('wa_api_key', apiKey);
    localStorage.setItem('wa_device_id', deviceId);
    localStorage.setItem('wa_webhook_url', webhookUrl);
    alert('Konfigurasi koneksi WhatsApp berhasil disimpan.');
  };

  const handleSaveTemplates = () => {
    localStorage.setItem('wa_tpl_greeting', greetingTemplate);
    localStorage.setItem('wa_tpl_invoice', invoiceTemplate);
    localStorage.setItem('wa_tpl_pending', pendingTemplate);
    localStorage.setItem('wa_tpl_ready', readyTemplate);
    alert('Template pesan WhatsApp berhasil disimpan.');
  };

  const checkConnectionStatus = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      const active = apiKey.length > 5;
      setIsConnected(active);
      localStorage.setItem('wa_is_connected', active ? 'true' : 'false');
      if (!active) {
        setShowQr(true);
      } else {
        setShowQr(false);
      }
    }, 1500);
  };

  // Mock template rendering for preview
  const renderPreview = (template) => {
    return template
      .replace(/{{nama}}/g, 'Budi Santoso')
      .replace(/{{order_id}}/g, 'ORD-20260701-A4F1')
      .replace(/{{total}}/g, 'Rp. 150.000')
      .replace(/{{dp}}/g, 'Rp. 50.000')
      .replace(/{{sisa}}/g, 'Rp. 100.000')
      .replace(/{{metode}}/g, 'Transfer Bank')
      .replace(/{{items}}/g, '- Cetak Banner Flexi 3x1m (x1)\n- Cetak Stiker Vinyl A3 (x5)');
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto w-full max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h4 className="font-extrabold text-slate-800 text-lg">Pengaturan Integrasi WhatsApp</h4>
        <p className="text-xs text-slate-500 font-semibold">Hubungkan nomor toko Anda dengan gateway Fonnte / Evolution API dan kelola template pesan otomatis.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Konfigurasi API Gateway */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h5 className="font-extrabold text-slate-800 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
              <Settings size={16} className="text-indigo-650" />
              <span>Konfigurasi Gateway</span>
            </h5>

            <div className="text-xs font-semibold text-slate-600 space-y-3">
              <div>
                <label className="block text-slate-550 mb-1">Pilih Gateway API</label>
                <select
                  value={apiType}
                  onChange={(e) => setApiType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
                >
                  <option value="fonnte">Fonnte Gateway</option>
                  <option value="evolution">Evolution API (Self-Hosted)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-550 mb-1">API Key / Token</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <Key size={12} className="text-slate-400 mr-2" />
                  <input
                    type="password"
                    placeholder="Masukkan token API..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-550 mb-1">Device ID / Instance Name</label>
                <input
                  type="text"
                  placeholder="Contoh: Bintang-01"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-550 mb-1">Webhook URL</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <Link2 size={12} className="text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="https://toko.com/api/wa/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[10px]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={handleSaveConnection}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer text-center"
              >
                Simpan
              </button>
              <button
                onClick={checkConnectionStatus}
                disabled={checking}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer border border-slate-200"
              >
                {checking ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
            </div>
          </div>

          {/* WhatsApp Status Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h5 className="font-extrabold text-slate-800 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span>Status Koneksi</span>
            </h5>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Status Gateway:</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}>
                {isConnected ? 'ONLINE / CONNECTED' : 'OFFLINE / SCANNED OUT'}
              </span>
            </div>

            {showQr && (
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold text-center mb-3">Scan QR Code ini dengan WhatsApp Anda untuk menyambungkan</p>
                {/* QR Mockup */}
                <div className="w-36 h-36 bg-white border border-slate-300 rounded-xl p-2 relative flex items-center justify-center shadow-inner">
                  <div className="grid grid-cols-5 gap-1.5 w-full h-full opacity-80">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-sm ${
                          (i % 3 === 0 || i % 7 === 0 || i === 0 || i === 4 || i === 20 || i === 24)
                            ? 'bg-slate-800'
                            : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 m-auto w-10 h-10 bg-indigo-600 rounded-2xl shadow-lg border-2 border-white flex items-center justify-center text-white">
                    <MessageSquare size={16} />
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsConnected(true);
                    setShowQr(false);
                    localStorage.setItem('wa_is_connected', 'true');
                  }}
                  className="mt-3 text-[10px] font-extrabold text-indigo-600 hover:text-indigo-850 cursor-pointer"
                >
                  Mock scan sukses
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Edit Templates & Live Mockup */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h5 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-500" />
                <span>Template Pesan Otomatis</span>
              </h5>
              <button
                onClick={handleSaveTemplates}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl shadow-md cursor-pointer transition-all"
              >
                Simpan Semua Template
              </button>
            </div>

            {/* Template Editors */}
            <div className="space-y-6 text-xs font-semibold text-slate-650">
              
              {/* 1. Greeting */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-extrabold text-slate-700">1. Template Sambutan Awal (Greeting)</label>
                  <span className="text-[10px] text-slate-400 font-medium block">Kirim saat order masuk dari bot.</span>
                  <textarea
                    rows="4"
                    value={greetingTemplate}
                    onChange={(e) => setGreetingTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-[11px] font-mono bg-slate-50/50"
                  />
                </div>
                {/* Chat Bubble Mockup */}
                <div className="bg-slate-150/40 rounded-2xl p-4 border border-slate-200/50 flex flex-col justify-end">
                  <div className="max-w-[85%] bg-[#E2F9C3] text-slate-800 text-[11px] p-3 rounded-xl rounded-tl-none border border-[#c1ebb6] self-start relative shadow-sm">
                    <span className="font-bold text-[9px] text-[#2b7d2b] block mb-0.5">WhatsApp Bot</span>
                    <p className="whitespace-pre-line leading-relaxed">{renderPreview(greetingTemplate)}</p>
                  </div>
                </div>
              </div>

              {/* 2. Paid Invoice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="block font-extrabold text-slate-700">2. Template Nota Lunas (Paid Receipt)</label>
                  <span className="text-[10px] text-slate-400 font-medium block">Kirim setelah verifikasi lunas di kasir.</span>
                  <textarea
                    rows="4"
                    value={invoiceTemplate}
                    onChange={(e) => setInvoiceTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-[11px] font-mono bg-slate-50/50"
                  />
                </div>
                {/* Chat Bubble Mockup */}
                <div className="bg-slate-150/40 rounded-2xl p-4 border border-slate-200/50 flex flex-col justify-end">
                  <div className="max-w-[85%] bg-[#E2F9C3] text-slate-800 text-[11px] p-3 rounded-xl rounded-tl-none border border-[#c1ebb6] self-start relative shadow-sm">
                    <span className="font-bold text-[9px] text-[#2b7d2b] block mb-0.5">WhatsApp Bot</span>
                    <p className="whitespace-pre-line leading-relaxed">{renderPreview(invoiceTemplate)}</p>
                  </div>
                </div>
              </div>

              {/* 3. Pending/DP Invoice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="block font-extrabold text-slate-700">3. Template Nota DP / Sisa Tagihan (Pending Receipt)</label>
                  <span className="text-[10px] text-slate-400 font-medium block">Kirim jika pembayaran belum lunas.</span>
                  <textarea
                    rows="4"
                    value={pendingTemplate}
                    onChange={(e) => setPendingTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-[11px] font-mono bg-slate-50/50"
                  />
                </div>
                {/* Chat Bubble Mockup */}
                <div className="bg-slate-150/40 rounded-2xl p-4 border border-slate-200/50 flex flex-col justify-end">
                  <div className="max-w-[85%] bg-[#E2F9C3] text-slate-800 text-[11px] p-3 rounded-xl rounded-tl-none border border-[#c1ebb6] self-start relative shadow-sm">
                    <span className="font-bold text-[9px] text-[#2b7d2b] block mb-0.5">WhatsApp Bot</span>
                    <p className="whitespace-pre-line leading-relaxed">{renderPreview(pendingTemplate)}</p>
                  </div>
                </div>
              </div>

              {/* 4. Ready to pickup */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="block font-extrabold text-slate-700">4. Template Notifikasi Selesai (Order Ready)</label>
                  <span className="text-[10px] text-slate-400 font-medium block">Kirim saat status global menjadi Ready.</span>
                  <textarea
                    rows="4"
                    value={readyTemplate}
                    onChange={(e) => setReadyTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-[11px] font-mono bg-slate-50/50"
                  />
                </div>
                {/* Chat Bubble Mockup */}
                <div className="bg-slate-150/40 rounded-2xl p-4 border border-slate-200/50 flex flex-col justify-end">
                  <div className="max-w-[85%] bg-[#E2F9C3] text-slate-800 text-[11px] p-3 rounded-xl rounded-tl-none border border-[#c1ebb6] self-start relative shadow-sm">
                    <span className="font-bold text-[9px] text-[#2b7d2b] block mb-0.5">WhatsApp Bot</span>
                    <p className="whitespace-pre-line leading-relaxed">{renderPreview(readyTemplate)}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
