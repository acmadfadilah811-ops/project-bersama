import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  FileText,
  Phone,
  ArrowRight,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import loginBg from '../../../assets/login_bg.jpg';

export default function UploadDesain() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  // Verification states
  const [formOrderId, setFormOrderId] = useState(orderId || '');
  const [nomorWa, setNomorWa] = useState('');
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [errorVerify, setErrorVerify] = useState('');

  // Order data states
  const [orderData, setOrderData] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState('');

  // Upload/Submit states
  const [uploadType, setUploadType] = useState('link'); // 'link' | 'file'
  const [gdriveLink, setGdriveLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (orderId) {
      setFormOrderId(orderId);
    }
  }, [orderId]);

  const handleVerifyOrder = async (e) => {
    e.preventDefault();
    setLoadingVerify(true);
    setErrorVerify('');
    setOrderData(null);
    setSuccessMsg('');

    try {
      const res = await apiClient.post('/public/get-order-details/', {
        order_id: formOrderId,
        nomor_wa: nomorWa
      });
      setOrderData(res.data);
      if (res.data.items && res.data.items.length > 0) {
        setSelectedItemId(res.data.items[0].id);
      }
    } catch (err) {
      setErrorVerify(err.response?.data?.error || 'Gagal memverifikasi pesanan. Periksa kembali ID Pesanan dan Nomor WhatsApp Anda.');
    } finally {
      setLoadingVerify(false);
    }
  };

  const handleSubmitDesign = async (e) => {
    e.preventDefault();
    setLoadingSubmit(true);
    setErrorSubmit('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('order_id', orderData.order_id);
      formData.append('nomor_wa', nomorWa);
      formData.append('item_id', selectedItemId);

      if (uploadType === 'link') {
        if (!gdriveLink) {
          setErrorSubmit('Sertakan link Google Drive atau Dropbox desain Anda.');
          setLoadingSubmit(false);
          return;
        }
        formData.append('gdrive_link', gdriveLink);
      } else {
        if (!selectedFile) {
          setErrorSubmit('Pilih file desain terlebih dahulu.');
          setLoadingSubmit(false);
          return;
        }
        formData.append('file', selectedFile);
      }

      const res = await apiClient.post('/public/submit-design/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccessMsg(res.data.message || 'Desain berhasil dikirim!');
      
      // Refresh order details to show new link
      const refreshRes = await apiClient.post('/public/get-order-details/', {
        order_id: orderData.order_id,
        nomor_wa: nomorWa
      });
      setOrderData(refreshRes.data);
      setGdriveLink('');
      setSelectedFile(null);
    } catch (err) {
      setErrorSubmit(err.response?.data?.error || 'Gagal mengunggah desain.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-900 font-sans p-4">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 opacity-80"
        style={{
          backgroundImage: `url(${loginBg})`,
        }}
      ></div>

      {/* Modern Gradient Light effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[450px] bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 blur-[120px] z-0 rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-[500px] bg-slate-950/85 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 md:p-8 flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Upload size={24} />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-wide mt-2">Kirim File Desain</h1>
          <p className="text-xs text-slate-400 font-medium max-w-sm">
            Kirimkan file desain susulan untuk pesanan Anda agar bisa segera masuk tahap produksi.
          </p>
        </div>

        {/* STEP 1: VERIFICATION */}
        {!orderData ? (
          <form onSubmit={handleVerifyOrder} className="flex flex-col gap-5">
            {errorVerify && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5 shadow-lg shadow-rose-950/15">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{errorVerify}</span>
              </div>
            )}

            {/* Order ID Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">ID Pesanan</label>
              <div className="flex h-12 shadow-md rounded-xl overflow-hidden border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all bg-slate-900/50">
                <div className="w-12 h-full flex items-center justify-center text-slate-400 border-r border-slate-800/80">
                  <FileText size={18} />
                </div>
                <input
                  type="text"
                  value={formOrderId}
                  onChange={(e) => setFormOrderId(e.target.value)}
                  className="flex-1 h-full bg-transparent px-4 outline-none text-white placeholder-slate-500 text-xs font-semibold uppercase tracking-wider"
                  placeholder="Contoh: ORD-20260606-XXXX"
                  required
                />
              </div>
            </div>

            {/* WhatsApp Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">Nomor WhatsApp Terdaftar</label>
              <div className="flex h-12 shadow-md rounded-xl overflow-hidden border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all bg-slate-900/50">
                <div className="w-12 h-full flex items-center justify-center text-slate-400 border-r border-slate-800/80">
                  <Phone size={18} />
                </div>
                <input
                  type="text"
                  value={nomorWa}
                  onChange={(e) => setNomorWa(e.target.value)}
                  className="flex-1 h-full bg-transparent px-4 outline-none text-white placeholder-slate-500 text-xs font-semibold"
                  placeholder="Contoh: 08123456789"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingVerify}
              className="w-full mt-2 h-12 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs"
            >
              {loadingVerify ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  Lanjutkan
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: DESIGN UPLOAD FORM */
          <div className="flex flex-col gap-5">
            {/* Success and Error Alerts */}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5 shadow-lg">
                <CheckCircle size={18} className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorSubmit && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold p-3.5 rounded-xl flex items-start gap-2.5 shadow-lg">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{errorSubmit}</span>
              </div>
            )}

            {/* Order Info Card */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-2.5 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="font-semibold text-slate-400">Nama Pelanggan</span>
                <span className="font-bold text-white">{orderData.nama}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">ID Pesanan</span>
                <span className="font-bold text-white tracking-wide">{orderData.order_id}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitDesign} className="flex flex-col gap-4">
              {/* Select Item */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">Pilih Item Pesanan</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setSuccessMsg('');
                    setErrorSubmit('');
                  }}
                  className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl px-3 text-xs text-white font-semibold outline-none focus:border-indigo-500"
                >
                  {orderData.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.jenis_produk} ({item.bahan}) - Qty: {item.qty} {item.gdrive_customer_link ? '✔️' : '⚠️ Belum Ada'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Option Selector */}
              <div className="flex border border-slate-800 rounded-xl overflow-hidden p-0.5 bg-slate-950">
                <button
                  type="button"
                  onClick={() => setUploadType('link')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    uploadType === 'link'
                      ? 'bg-slate-850 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LinkIcon size={14} />
                  Link Google Drive
                </button>
                <button
                  type="button"
                  onClick={() => setUploadType('file')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    uploadType === 'file'
                      ? 'bg-slate-850 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload size={14} />
                  Unggah File
                </button>
              </div>

              {/* Input Fields depending on selection */}
              {uploadType === 'link' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Link Desain (Google Drive / Dropbox)</label>
                  <div className="flex h-11 shadow-md rounded-xl overflow-hidden border border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all bg-slate-900/50">
                    <div className="w-11 h-full flex items-center justify-center text-slate-400 border-r border-slate-800/80">
                      <LinkIcon size={16} />
                    </div>
                    <input
                      type="url"
                      value={gdriveLink}
                      onChange={(e) => setGdriveLink(e.target.value)}
                      className="flex-1 h-full bg-transparent px-3 outline-none text-white placeholder-slate-500 text-xs font-semibold"
                      placeholder="https://drive.google.com/..."
                      required={uploadType === 'link'}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    *Pastikan link Google Drive Anda sudah diatur agar *siapa saja yang memiliki link* dapat mengakses/melihat.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Pilih File Desain</label>
                  <label className="flex flex-col items-center justify-center border border-dashed border-slate-800 hover:border-indigo-500/80 rounded-xl p-5 bg-slate-900/30 cursor-pointer transition-all gap-2">
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="hidden"
                      required={uploadType === 'file'}
                    />
                    <FolderOpen size={24} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">
                      {selectedFile ? selectedFile.name : 'Pilih file dari perangkat'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Format didukung: PNG, JPG, JPEG, PDF (Maks. 10MB)
                    </span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loadingSubmit}
                className="w-full mt-2 h-12 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs"
              >
                {loadingSubmit ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    Kirim Desain
                  </>
                )}
              </button>
            </form>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => {
                setOrderData(null);
                setSuccessMsg('');
                setErrorSubmit('');
              }}
              className="text-center text-xs text-slate-400 hover:text-slate-200 transition-colors font-bold cursor-pointer"
            >
              Cek Pesanan Lain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
