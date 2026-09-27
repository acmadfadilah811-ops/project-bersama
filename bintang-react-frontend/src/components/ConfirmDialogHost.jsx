import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, PencilLine } from 'lucide-react';
import { registerDialogHost } from '../utils/dialog';

// Satu tempat render dialog konfirmasi/input untuk seluruh aplikasi (lihat
// utils/dialog.js). Antrean: dialog berikutnya tampil setelah yang aktif ditutup.
export default function ConfirmDialogHost() {
  const [antrean, setAntrean] = useState([]);
  const [nilai, setNilai] = useState('');
  const inputRef = useRef(null);
  const aktif = antrean[0] || null;

  useEffect(() => {
    registerDialogHost((dialog) => setAntrean((a) => [...a, dialog]));
    return () => registerDialogHost(null);
  }, []);

  useEffect(() => {
    if (!aktif) return undefined;
    setNilai(aktif.kind === 'prompt' ? aktif.defaultValue : '');
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [aktif]);

  if (!aktif) return null;

  const selesai = (hasil) => {
    aktif.resolve(hasil);
    setAntrean((a) => a.slice(1));
  };
  const batal = () => selesai(aktif.kind === 'prompt' ? null : false);
  const setuju = () => selesai(aktif.kind === 'prompt' ? nilai : true);

  const Ikon = aktif.kind === 'prompt' ? PencilLine : aktif.danger ? AlertTriangle : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === 'Escape') batal();
        if (e.key === 'Enter' && aktif.kind === 'confirm') setuju();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 flex flex-col items-center text-center">
        <div className={`p-4 rounded-full mb-4 ${aktif.danger ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-600'}`}>
          <Ikon size={28} />
        </div>
        <h3 className="text-base font-extrabold text-slate-900 mb-2">{aktif.title}</h3>
        <p className="text-slate-600 text-xs font-semibold leading-relaxed mb-5 max-h-48 overflow-y-auto px-1 w-full whitespace-pre-wrap">
          {aktif.message}
        </p>
        {aktif.kind === 'prompt' && (
          <input
            ref={inputRef}
            value={nilai}
            onChange={(e) => setNilai(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setuju(); }}
            className="w-full mb-5 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={batal}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
          >
            {aktif.cancelText}
          </button>
          <button
            type="button"
            ref={aktif.kind === 'confirm' ? inputRef : undefined}
            onClick={setuju}
            className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer ${aktif.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {aktif.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
