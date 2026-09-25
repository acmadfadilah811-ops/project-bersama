import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import apiClient from '../api/apiClient';
import { useDynamicIsland } from '../context/DynamicIslandContext';

// Notifikasi keuangan dari HR (gaji siap diposting, reimbursement disetujui)
// untuk Owner, Manager, dan SPV Finance. Data: /accounting/notifikasi/.
const PERAN = ['owner', 'manager', 'spv_finance'];
const INTERVAL_MS = 60000;

function waktuRelatif(iso) {
  const detik = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotifikasiKeuanganBell({ role }) {
  const navigate = useNavigate();
  const { triggerNotification } = useDynamicIsland() || {};
  const [buka, setBuka] = useState(false);
  const [data, setData] = useState({ belum_dibaca: 0, hasil: [] });
  const sudahDilihat = useRef(null);
  const wadah = useRef(null);
  const boleh = PERAN.includes((role || '').toLowerCase());

  const muat = useCallback(async () => {
    try {
      const res = await apiClient.get('/accounting/notifikasi/');
      const baru = res.data || { belum_dibaca: 0, hasil: [] };
      const idBelum = (baru.hasil || []).filter((n) => !n.dibaca).map((n) => n.id);
      // Pop-up hanya untuk notifikasi yang muncul SETELAH halaman dibuka.
      if (sudahDilihat.current && triggerNotification) {
        const muncul = (baru.hasil || []).find((n) => !n.dibaca && !sudahDilihat.current.has(n.id));
        if (muncul) triggerNotification({ type: 'announcement', title: muncul.judul, message: muncul.pesan });
      }
      sudahDilihat.current = new Set([...(sudahDilihat.current || []), ...idBelum, ...(baru.hasil || []).map((n) => n.id)]);
      setData(baru);
    } catch {
      // diam: lonceng tidak boleh mengganggu halaman bila API sedang gagal
    }
  }, [triggerNotification]);

  useEffect(() => {
    if (!boleh) return undefined;
    muat();
    const t = setInterval(muat, INTERVAL_MS);
    return () => clearInterval(t);
  }, [boleh, muat]);

  useEffect(() => {
    if (!buka) return undefined;
    const tutup = (e) => { if (wadah.current && !wadah.current.contains(e.target)) setBuka(false); };
    document.addEventListener('mousedown', tutup);
    return () => document.removeEventListener('mousedown', tutup);
  }, [buka]);

  if (!boleh) return null;

  const tandai = async (body) => {
    try {
      await apiClient.post('/accounting/notifikasi/baca/', body);
      await muat();
    } catch {
      /* abaikan */
    }
  };

  const bukaItem = async (n) => {
    if (!n.dibaca) await tandai({ ids: [n.id] });
    setBuka(false);
    if (n.tautan) navigate(n.tautan);
  };

  return (
    <div className="relative" ref={wadah}>
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        className="relative p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        title="Notifikasi keuangan"
        aria-label="Notifikasi keuangan"
      >
        <Bell size={18} />
        {data.belum_dibaca > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {data.belum_dibaca > 99 ? '99+' : data.belum_dibaca}
          </span>
        )}
      </button>
      {buka && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Notifikasi Keuangan</span>
            {data.belum_dibaca > 0 && (
              <button type="button" onClick={() => tandai({ semua: true })} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
                <CheckCheck size={14} /> Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(data.hasil || []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Belum ada notifikasi.</div>
            ) : (
              data.hasil.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => bukaItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${n.dibaca ? '' : 'bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.dibaca && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                    <div className="min-w-0">
                      <div className={`text-sm ${n.dibaca ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>{n.judul}</div>
                      {n.pesan && <div className="text-xs text-slate-500 mt-0.5 line-clamp-3">{n.pesan}</div>}
                      <div className="text-[11px] text-slate-400 mt-1">{waktuRelatif(n.dibuat)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
